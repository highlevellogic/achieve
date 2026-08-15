const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");

const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-static-lookup-"));
const directoryPath=path.join(testRoot,"directory");
fs.mkdirSync(directoryPath,{recursive:true});
const staticBody="Achieve static lookup verification. ".repeat(4);
fs.writeFileSync(path.join(testRoot,"tiny.txt"),staticBody);
fs.writeFileSync(path.join(directoryPath,"index.html"),"directory index");
fs.writeFileSync(path.join(testRoot,"hello.jss"),
    "exports.servlet=function () { return 'servlet'; };\n");

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
                resolve({
                    status:res.statusCode,
                    headers:res.headers,
                    body:Buffer.concat(chunks).toString()
                });
            });
        });
        req.on("error",reject);
        req.end();
    });
}
async function command(child,name,event) {
    const result=wait(child,event);
    child.send({command:name});
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
            "Static file did not serve correctly.");
        assert(response.headers["content-type"] === "text/plain",
            "Static content type changed.");
        assert(response.headers.etag,"Static ETag is missing.");
        assert(counts.statSync === 1,
            "Static request did not perform exactly one statSync: "+JSON.stringify(counts));
        assert(counts.existsSync === 0,
            "Static request retained existsSync: "+JSON.stringify(counts));
        assert(counts.createReadStream === 1,
            "Static request did not stream the physical file: "+JSON.stringify(counts));

        response=await request("/directory");
        assert(response.status === 301 && response.headers.location === "/directory/",
            "Directory redirect behavior changed.");
        response=await request("/directory/");
        assert(response.status === 200 && response.body === "directory index",
            "Directory index behavior changed.");

        response=await request("/missing");
        assert(response.status === 404,"Missing resource behavior changed.");

        response=await request("/hello");
        assert(response.status === 200 && response.body === "servlet",
            "First servlet resolution changed.");

        const staticResponse=await request("/tiny.txt");
        const conditional=await request("/tiny.txt",{"If-None-Match":staticResponse.headers.etag});
        assert(conditional.status === 304,
            "Static conditional response changed.");

        console.log("PASS static lookup verification");
        console.log("STATIC_LOOKUP_COUNTS "+JSON.stringify(counts));
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send({command:"stop"});
            await exited;
        }
        fs.rmSync(testRoot,{recursive:true,force:true});
    }
})().catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
