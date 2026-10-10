const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const zlib=require("node:zlib");

const port=24411;
const root=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-same-handle-"));
const staticA="STATIC-A-".repeat(16),staticB="STATIC-B-".repeat(16);
const mediaA=Buffer.from("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const mediaB=Buffer.from("abcdefghijklmnopqrstuvwxyz0123456789");
const rangeA=Buffer.from("RANGE-A-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const rangeB=Buffer.from("RANGE-B-abcdefghijklmnopqrstuvwxyz-0123456789");
const compressedA="COMPRESSED-A-".repeat(32),compressedB="COMPRESSED-B-".repeat(32);

function write(relative,value) {
    const target=path.join(root,relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,value);
    return target;
}
const staticPath=write("static.txt",staticA);
const mediaPath=write("media.mp4",mediaA);
const rangePath=write("range.mp4",rangeA);
write("large.bin",Buffer.alloc(4*1024*1024,65));
write("compressed.txt",compressedA);
const artifactPath=write(path.join(".compression-cache","compressed.txt.gz"),zlib.gzipSync(compressedA));
const future=new Date(Date.now()+2000);
fs.utimesSync(artifactPath,future,future);

function assert(condition,message) { if (!condition) throw new Error(message); }
function wait(child,event) {
    return new Promise(function (resolve,reject) {
        const timer=setTimeout(function () { cleanup(); reject(new Error("Timed out waiting for "+event)); },10000);
        function cleanup() { clearTimeout(timer); child.off("message",listener); child.off("exit",exited); }
        function listener(message) { if (message.event !== event) return; cleanup(); resolve(message); }
        function exited(code) { cleanup(); reject(new Error("Fixture exited before "+event+": "+code)); }
        child.on("message",listener); child.once("exit",exited);
    });
}
async function command(child,message,event) {
    const result=wait(child,event); child.send(message); return result;
}
function request(options) {
    return new Promise(function (resolve,reject) {
        const req=http.request({host:"127.0.0.1",port,method:options.method || "GET",
            path:options.path,headers:options.headers || {}},function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",() => resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
        });
        req.on("error",reject); req.end();
    });
}
function abortRequest() {
    return new Promise(function (resolve,reject) {
        const req=http.get({host:"127.0.0.1",port,path:"/large.bin"},function (res) {
            res.once("data",function () {
                res.destroy();
                resolve();
            });
        });
        req.on("error",function (err) {
            if (err.code === "ECONNRESET") resolve();
            else reject(err);
        });
    });
}
async function arm(child,target,replacementName,value) {
    const replacement=write(replacementName,value);
    await command(child,{command:"arm",target,replacement,oldPath:target+".opened"},"armed");
}
async function assertClosed(child,description,options) {
    await command(child,{command:"reset-counts"},"counts-reset");
    const response=await request(options);
    const counts=(await command(child,{command:"counts"},"counts")).counts;
    assert(counts.openCount === counts.closeCount && counts.liveDescriptors === 0,
        description+" leaked a descriptor: "+JSON.stringify(counts));
    return response;
}

(async function () {
    const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{silent:true,
        env:Object.assign({},process.env,{ACHIEVE_SAME_HANDLE_APP:root,ACHIEVE_SAME_HANDLE_PORT:String(port)})});
    child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
    try {
        await wait(child,"ready");

        const staticBaseline=await request({path:"/static.txt",headers:{"Accept-Encoding":"identity"}});
        await arm(child,staticPath,"static-next.txt",staticB);
        const staticReplaced=wait(child,"replaced");
        const staticResponse=await request({path:"/static.txt",
            headers:{"Accept-Encoding":"identity","If-None-Match":'"stale"'}});
        await staticReplaced;
        assert(staticResponse.status === 200 && staticResponse.body.toString() === staticA,
            "Conditional static response did not use the opened file.");
        assert(staticResponse.headers.etag === staticBaseline.headers.etag,
            "Static metadata did not match the opened file.");

        const mediaBaseline=await request({path:"/media.mp4"});
        await arm(child,mediaPath,"media-next.mp4",mediaB);
        const mediaReplaced=wait(child,"replaced");
        const mediaResponse=await request({path:"/media.mp4"});
        await mediaReplaced;
        assert(mediaResponse.status === 200 && mediaResponse.body.equals(mediaA),
            "Full media response did not use the opened file.");
        assert(mediaResponse.headers.etag === mediaBaseline.headers.etag &&
            Number(mediaResponse.headers["content-length"]) === mediaA.length,
            "Full media metadata did not match the opened file.");

        const rangeBaseline=await request({path:"/range.mp4"});
        await arm(child,rangePath,"range-next.mp4",rangeB);
        const rangeReplaced=wait(child,"replaced");
        const rangeResponse=await request({path:"/range.mp4",
            headers:{Range:"bytes=8-17","If-Range":rangeBaseline.headers.etag}});
        await rangeReplaced;
        assert(rangeResponse.status === 206 && rangeResponse.body.equals(rangeA.subarray(8,18)),
            "Media range response did not use the opened file.");
        assert(rangeResponse.headers["content-range"] === "bytes 8-17/"+rangeA.length,
            "Media range metadata did not match the opened file.");

        const compressedBaseline=await request({path:"/compressed.txt",headers:{"Accept-Encoding":"gzip"}});
        assert(compressedBaseline.headers["content-encoding"] === "gzip","Compressed artifact was not selected.");
        await arm(child,artifactPath,path.join(".compression-cache","compressed-next.txt.gz"),zlib.gzipSync(compressedB));
        const compressedReplaced=wait(child,"replaced");
        const compressedResponse=await request({path:"/compressed.txt",headers:{"Accept-Encoding":"gzip"}});
        await compressedReplaced;
        assert(compressedResponse.headers["content-encoding"] === "gzip" &&
            zlib.gunzipSync(compressedResponse.body).toString() === compressedA,
            "Compressed response did not use the opened artifact.");
        assert(compressedResponse.headers.etag === compressedBaseline.headers.etag,
            "Compressed metadata did not match the opened artifact.");

        const currentTag=(await request({path:"/static.txt",headers:{"Accept-Encoding":"identity"}})).headers.etag;
        let response=await assertClosed(child,"static HEAD",{method:"HEAD",path:"/static.txt",
            headers:{"Accept-Encoding":"identity"}});
        assert(response.status === 200 && response.body.length === 0,"Static HEAD changed.");
        response=await assertClosed(child,"static 304",{path:"/static.txt",
            headers:{"Accept-Encoding":"identity","If-None-Match":currentTag}});
        assert(response.status === 304,"Static 304 changed.");
        response=await assertClosed(child,"static 412",{path:"/static.txt",
            headers:{"Accept-Encoding":"identity","If-Match":'"stale"'}});
        assert(response.status === 412,"Static 412 changed.");
        response=await assertClosed(child,"media 416",{path:"/media.mp4",headers:{Range:"bytes=999999-"}});
        assert(response.status === 416,"Media 416 changed.");
        response=await assertClosed(child,"resource OPTIONS",{method:"OPTIONS",path:"/static.txt"});
        assert(response.status === 204,"Resource OPTIONS changed.");
        response=await assertClosed(child,"CORS rejection",{path:"/static.txt",
            headers:{Origin:"https://denied.example"}});
        assert(response.status === 403,"CORS rejection changed.");

        await command(child,{command:"reset-counts"},"counts-reset");
        await abortRequest();
        const abortCounts=(await command(child,{command:"counts"},"counts")).counts;
        assert(abortCounts.openCount === abortCounts.closeCount && abortCounts.liveDescriptors === 0,
            "Aborted response leaked a descriptor: "+JSON.stringify(abortCounts));

        const counts=(await command(child,{command:"counts"},"counts")).counts;
        assert(counts.pathnameStreams === 0,"A response body reopened a pathname: "+JSON.stringify(counts));
        console.log("PASS same-handle file serving verification");
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send({command:"stop"}); await exited;
        }
        fs.rmSync(root,{recursive:true,force:true});
    }
})().catch(function (err) { console.error(err); process.exitCode=1; });