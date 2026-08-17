const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");

const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-report-error-"));
const invalidServlet=path.join(testRoot,"invalid.jss");
fs.writeFileSync(invalidServlet,"exports.value='invalid';\n");

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
function request(target) {
    return new Promise(function (resolve,reject) {
        http.get("http://127.0.0.1:24420"+target,function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()});
            });
        }).on("error",reject);
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
            ACHIEVE_REPORT_ERROR_APP:testRoot,
            ACHIEVE_REPORT_ERROR_PORT:"24420"
        })
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    try {
        await wait(child,"ready");

        await command(child,"count-start","count-started");
        let response=await request("/does-not-exist");
        const missingCount=(await command(child,"count-stop","count")).moduleResolveCount;
        assert(response.status === 404 &&
            response.body === "File not found: "+path.normalize("/does-not-exist"),
            "Ordinary missing-resource response changed: "+JSON.stringify(response));
        assert(missingCount === 0,
            "Ordinary 404 performed CommonJS module resolution: "+missingCount);

        response=await request("/invalid.jss");
        assert(response.status === 500 &&
            response.body.includes("does not have a valid servlet() function"),
            "Invalid servlet export did not fail normally.");
        fs.writeFileSync(invalidServlet,
            "exports.servlet=function () { return 'recovered'; };\n");
        response=await request("/invalid.jss");
        assert(response.status === 200 && response.body === "recovered",
            "Invalid servlet module remained cached after repair.");

        console.log("PASS reportError verification");
        console.log("MISSING_404_MODULE_RESOLVE_COUNT "+missingCount);
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
