const assert=require("node:assert");
const {fork}=require("node:child_process");
const http=require("node:http");
const path=require("node:path");

const port=24780;

function waitForMessage(child,event) {
    return new Promise(function (resolve,reject) {
        const timer=setTimeout(function () {
            cleanup();
            reject(new Error("Timed out waiting for "+event));
        },5000);
        function cleanup() {
            clearTimeout(timer);
            child.off("message",receive);
            child.off("exit",exit);
        }
        function receive(message) {
            if (!message || message.event !== event) return;
            cleanup();
            resolve(message);
        }
        function exit(code) {
            cleanup();
            reject(new Error("Fixture exited before "+event+": "+code));
        }
        child.on("message",receive);
        child.once("exit",exit);
    });
}

function request(target) {
    return new Promise(function (resolve,reject) {
        const request=http.get({host:"127.0.0.1",port:port,path:target},function (response) {
            const chunks=[];
            response.on("data",chunk => chunks.push(chunk));
            response.on("end",function () {
                resolve({
                    status:response.statusCode,
                    body:Buffer.concat(chunks).toString("utf8")
                });
            });
        });
        request.setTimeout(5000,function () {
            request.destroy(new Error("Request timeout: "+target));
        });
        request.on("error",reject);
    });
}

function applicationLocation(body,sourcePath) {
    return new RegExp("(?:^| )"+sourcePath.replace(/\./g,"\\.")+":\\d+:\\d+$").test(body);
}

function assertSanitized(body) {
    assert(!body.includes("C:/projects"),"POSIX-style absolute path leaked: "+body);
    assert(!body.includes("C:\\projects"),"Windows absolute path leaked: "+body);
    assert(!body.includes("?achieve-mtime="),"ESM reload marker leaked: "+body);
}

async function expectFailure(target,fileName,message,excludedSource) {
    const response=await request(target);
    assert.strictEqual(response.status,500,target+" status");
    assert(response.body.includes(message),target+" lost error information: "+response.body);
    assert(applicationLocation(response.body,fileName),target+" did not report application frame: "+response.body);
    if (excludedSource) {
        assert(!response.body.includes(excludedSource),target+" reported implementation frame: "+response.body);
    }
    assertSanitized(response.body);

    const healthy=await request("/health.txt");
    assert.strictEqual(healthy.status,200,target+" damaged server status");
    assert.strictEqual(healthy.body,"healthy\n",target+" damaged server response");
    return response.body;
}

(async function () {
    const child=fork(path.join(__dirname,"fixture.js"),[],{
        silent:true,
        env:Object.assign({},process.env,{
            ACHIEVE_SERVLET_ERROR_PORT:String(port),
            NODE_PATH:path.join(__dirname,"third_party_modules")
        })
    });
    let output="";
    child.stdout.on("data",chunk => output+=chunk);
    child.stderr.on("data",chunk => output+=chunk);
    try {
        await waitForMessage(child,"ready");

        const results={};
        results.esmCore=await expectFailure(
            "/servlets/core-esm.jss.mjs",
            "servlets/core-esm.jss.mjs",
            "ENOENT",
            "node:fs:"
        );
        assert(results.esmCore.includes("missing-esm.txt"),"ESM missing filename was lost.");

        results.commonJSCore=await expectFailure(
            "/servlets/core-cjs.jss.cjs",
            "servlets/core-cjs.jss.cjs",
            "ENOENT",
            "node:fs:"
        );
        assert(results.commonJSCore.includes("missing-cjs.txt"),"CommonJS missing filename was lost.");

        results.esmHelper=await expectFailure(
            "/servlets/helper-esm.jss.mjs",
            "helpers/core-helper.jss.mjs",
            "ENOENT",
            "node:fs:"
        );
        assert(results.esmHelper.includes("missing-helper-esm.txt"),"ESM helper filename was lost.");

        results.commonJSHelper=await expectFailure(
            "/servlets/helper-cjs.jss.cjs",
            "helpers/direct-helper.jss.cjs",
            "Application helper failure"
        );

        results.thirdParty=await expectFailure(
            "/servlets/third-party.jss.cjs",
            "servlets/third-party.jss.cjs",
            "Third-party fixture failure",
            "index.js:"
        );

        console.log("PASS servlet error frame verification");
        for (const [name,value] of Object.entries(results)) {
            console.log(name+": "+value);
        }
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send("stop");
            await exited;
        }
        if (output) process.stdout.write(output);
    }
})().catch(function (error) {
    console.error(error.stack || error);
    process.exitCode=1;
});
