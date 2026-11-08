const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");

const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-static-lookup-"));
const directoryPath=path.join(testRoot,"directory");
fs.mkdirSync(directoryPath,{recursive:true});
const staticBody="Achieve static lookup verification. ".repeat(4);
const unknownBody=Buffer.from([0x00,0x41,0x80,0xff,0x0a]);
fs.writeFileSync(path.join(testRoot,"tiny.txt"),staticBody);
fs.writeFileSync(path.join(testRoot,"unknown.unregistered"),unknownBody);
fs.writeFileSync(path.join(testRoot,"open-error.txt"),"open error fixture");
fs.writeFileSync(path.join(testRoot,"fstat-error.txt"),"fstat error fixture");
fs.writeFileSync(path.join(testRoot,"secret.jss.js"),"exports.servlet=()=>\"protected\";\n");
fs.writeFileSync(path.join(directoryPath,"index.html"),"directory index");
const dottedDirectory=path.join(testRoot,"folder.txt");
fs.mkdirSync(dottedDirectory);
fs.writeFileSync(path.join(dottedDirectory,"index.htm"),"dotted directory index");
fs.writeFileSync(path.join(testRoot,"hello.jss"),
    "exports.servlet=function () { return 'servlet'; };\n");
fs.writeFileSync(path.join(testRoot,"legacy.js"),
    "exports.servlet=function () { return 'legacy servlet'; };\n");
const raceOutside=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-static-lookup-outside-"));
const raceInside=path.join(testRoot,"race-inside");
const raceLink=path.join(testRoot,"race-link");
fs.mkdirSync(raceInside);
fs.writeFileSync(path.join(raceInside,"race.txt"),"INSIDE\n");
fs.writeFileSync(path.join(raceOutside,"race.txt"),"OUTSIDE\n");
let raceSkip;
try {
    fs.symlinkSync(raceInside,raceLink,process.platform === "win32" ? "junction" : "dir");
} catch (err) {
    raceSkip=err.code+" "+err.message;
}

function assert(condition,message) {
    if (!condition) throw new Error(message);
}
function wait(child,event) {
    return new Promise(function (resolve,reject) {
        const timer=setTimeout(function () {
            cleanup();
            reject(new Error("Timed out waiting for "+event));
        },10000);
        function cleanup() {
            clearTimeout(timer);
            child.off("message",listener);
            child.off("exit",exited);
        }
        function listener(message) {
            if (message.event !== event) return;
            cleanup();
            resolve(message);
        }
        function exited(code) {
            cleanup();
            reject(new Error("Fixture exited before "+event+": "+code));
        }
        child.on("message",listener);
        child.once("exit",exited);
    });
}
function request(target,headers={}) {
    return new Promise(function (resolve,reject) {
        const req=http.request({
            host:"127.0.0.1",
            port:24410,
            path:target,
            headers:headers
        },function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                const bytes=Buffer.concat(chunks);
                resolve({
                    status:res.statusCode,
                    headers:res.headers,
                    bytes:bytes,
                    body:bytes.toString()
                });
            });
        });
        req.on("error",reject);
        req.end();
    });
}
async function command(child,name,event) {
    const result=wait(child,event);
    child.send(typeof name === "string" ? {command:name} : name);
    return result;
}

(async function () {
    const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
        silent:true,
        env:Object.assign({},process.env,{
            ACHIEVE_STATIC_LOOKUP_APP:testRoot,
            ACHIEVE_STATIC_LOOKUP_PORT:"24410"
        })
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    try {
        await wait(child,"ready");

        await command(child,"count-start","count-started");
        let response=await request("/tiny.txt",{"Accept-Encoding":"identity"});
        const counts=(await command(child,"count-stop","counts")).counts;
        assert(response.status === 200 && response.body === staticBody,
            "Static file did not serve correctly: "+JSON.stringify({status:response.status,body:response.body,headers:response.headers}));
        assert(response.headers["content-type"] === "text/plain",
            "Static content type changed.");
        assert(response.headers.etag,"Static ETag is missing.");
        assert(Number(response.headers["content-length"]) === Buffer.byteLength(staticBody),
            "Static Content-Length changed: "+JSON.stringify(response.headers));
        assert(counts.statSync === 0 && counts.discoveryStatSync === 0,
            "Eligible static request performed a pathname discovery statSync: "+JSON.stringify(counts));
        assert(counts.existsSync === 0,
            "Static request retained existsSync: "+JSON.stringify(counts));
        assert(counts.realpathSyncNative === 1,
            "Static request did not resolve physical containment exactly once: "+JSON.stringify(counts));
        assert(counts.openSync === 1,
            "Static request did not open the final representation exactly once: "+JSON.stringify(counts));
        assert(counts.fstatSync === 1,
            "Static request did not inspect the opened representation exactly once: "+JSON.stringify(counts));
        assert(counts.createReadStream === 1,
            "Static request did not stream the opened physical file: "+JSON.stringify(counts));
        assert(counts.paths.some(value => value.startsWith("createReadStream:") && value.includes("tiny.txt")),
            "Static request did not retain its selected representation identity: "+JSON.stringify(counts));

        response=await request("/unknown.unregistered",{"Accept-Encoding":"identity"});
        assert(response.status === 200,
            "Unknown static extension did not return 200: "+JSON.stringify({status:response.status,headers:response.headers}));
        assert(response.headers["content-type"] === "text/plain",
            "Unknown static extension did not use text/plain: "+JSON.stringify(response.headers));
        assert(response.bytes.equals(unknownBody),
            "Unknown static extension changed response bytes: "+JSON.stringify({expected:[...unknownBody],actual:[...response.bytes]}));

        response=await request("/directory");
        assert(response.status === 301 && response.headers.location === "/directory/",
            "Directory redirect behavior changed.");
        response=await request("/directory/");
        assert(response.status === 200 && response.body === "directory index",
            "Directory index behavior changed.");
        response=await request("/folder.txt");
        assert(response.status === 301 && response.headers.location === "/folder.txt/",
            "Suffix-bearing directory redirect behavior changed.");
        response=await request("/folder.txt/");
        assert(response.status === 200 && response.body === "dotted directory index",
            "Suffix-bearing directory default document behavior changed.");

        await command(child,"count-start","count-started");
        response=await request("/missing");
        const missingCounts=(await command(child,"count-stop","counts")).counts;
        assert(response.status === 404,"Missing resource behavior changed.");
        assert(!missingCounts.paths.some(value => value.endsWith("missing.jss")),
            "Missing extensionless request retained a .jss probe: "+JSON.stringify(missingCounts));

        response=await request("/hello.jss");
        assert(response.status === 200 && response.body === "servlet",
            "Explicit .jss servlet resolution changed.");
        response=await request("/hello");
        assert(response.status === 404,
            "Extensionless request unexpectedly resolved the .jss servlet.");

        await command(child,"count-start","count-started");
        response=await request("/legacy");
        const legacyCounts=(await command(child,"count-stop","counts")).counts;
        assert(response.status === 200 && response.body === "legacy servlet",
            "Legacy extensionless .js servlet resolution changed.");
        assert(legacyCounts.discoveryStatSync === 2,
            "Legacy discovery did not use the exact target plus one .js statSync: "+JSON.stringify(legacyCounts));
        assert(legacyCounts.discoveryExistsSync === 0,
            "Legacy discovery retained existsSync: "+JSON.stringify(legacyCounts));
        assert(legacyCounts.discoveryPaths.filter(value => value.endsWith("legacy.js")).length === 1,
            "Legacy discovery did not perform exactly one .js metadata lookup: "+JSON.stringify(legacyCounts));

        response=await request("/secret.jss.js");
        assert(response.status === 404,"Protected servlet source became directly accessible.");

        await command(child,"count-start","count-started");
        await command(child,{command:"fault",mode:"open"},"fault-armed");
        response=await request("/open-error.txt",{"Accept-Encoding":"identity"});
        await command(child,{command:"fault"},"fault-armed");
        const openFailureCounts=(await command(child,"count-stop","counts")).counts;
        assert(response.status === 500 && openFailureCounts.openSync === 1,
            "Failed open was retried or returned the wrong status: "+JSON.stringify({response,openFailureCounts}));

        await command(child,"count-start","count-started");
        await command(child,{command:"fault",mode:"fstat"},"fault-armed");
        response=await request("/fstat-error.txt",{"Accept-Encoding":"identity"});
        await command(child,{command:"fault"},"fault-armed");
        const fstatFailureCounts=(await command(child,"count-stop","counts")).counts;
        assert(response.status === 500 && fstatFailureCounts.openSync === 1 &&
            fstatFailureCounts.fstatSync === 1 && fstatFailureCounts.closeSync === 1,
            "Failed fstat retried or closed the descriptor incorrectly: "+
            JSON.stringify({response,fstatFailureCounts}));

        if (raceSkip) {
            console.log("SKIP final-junction retarget: "+raceSkip);
        } else {
            await command(child,{command:"retarget",trigger:path.join(raceLink,"race.txt"),
                junction:raceLink,outside:raceOutside},"retarget-armed");
            const retargeted=wait(child,"retargeted");
            response=await request("/race-link/race.txt",{"Accept-Encoding":"identity"});
            await retargeted;
            assert(response.status === 200 && response.body === "INSIDE\n",
                "Final-junction retarget escaped the validated physical file: "+JSON.stringify(response));
        }

        const staticResponse=await request("/tiny.txt");
        const conditional=await request("/tiny.txt",{"If-None-Match":staticResponse.headers.etag});
        assert(conditional.status === 304,
            "Static conditional response changed.");

        console.log("PASS static lookup verification");
        console.log("STATIC_LOOKUP_COUNTS "+JSON.stringify(counts));
        console.log("MISSING_LOOKUP_COUNTS "+JSON.stringify(missingCounts));
        console.log("LEGACY_LOOKUP_COUNTS "+JSON.stringify(legacyCounts));
        console.log("OPEN_FAILURE_COUNTS "+JSON.stringify(openFailureCounts));
        console.log("FSTAT_FAILURE_COUNTS "+JSON.stringify(fstatFailureCounts));
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send({command:"stop"});
            await exited;
        }
        fs.rmSync(testRoot,{recursive:true,force:true});
        fs.rmSync(raceOutside,{recursive:true,force:true});
    }
})().catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
