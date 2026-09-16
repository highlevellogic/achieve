const assert=require("node:assert");
const http=require("node:http");
const https=require("node:https");
const http2=require("node:http2");
const path=require("node:path");
const {fork}=require("node:child_process");

const protocols=["http","https","http2","http2s"];
const ports={http:24830,https:24831,http2:24832,http2s:24833};

function waitForMessage(child,event) {
    return new Promise(function (resolve,reject) {
        const timer=setTimeout(function () { cleanup(); reject(new Error("Timed out waiting for "+event)); },5000);
        function cleanup() { clearTimeout(timer); child.off("message",receive); child.off("exit",exit); }
        function receive(message) {
            if (!message || message.event !== event) return;
            cleanup();
            resolve(message);
        }
        function exit(code) { cleanup(); reject(new Error("Fixture exited before "+event+": "+code)); }
        child.on("message",receive);
        child.once("exit",exit);
    });
}

function httpRequest(protocol,method,target) {
    return new Promise(function (resolve,reject) {
        const transport=protocol === "https" ? https : http;
        let settled=false;
        function finish(value) { if (!settled) { settled=true; resolve(value); } }
        const request=transport.request({
            host:"127.0.0.1",port:ports[protocol],method:method,path:target,rejectUnauthorized:false
        },function (response) {
            const chunks=[];
            response.on("data",chunk => chunks.push(chunk));
            response.on("end",function () {
                finish({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString("utf8"),aborted:false});
            });
            response.on("aborted",function () {
                finish({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString("utf8"),aborted:true});
            });
        });
        request.setTimeout(5000,function () { request.destroy(new Error("request timeout")); });
        request.on("error",function (error) { if (!settled) reject(error); });
        request.end();
    });
}

function http2Request(protocol,method,target) {
    return new Promise(function (resolve,reject) {
        const secure=protocol === "http2s";
        const client=http2.connect((secure ? "https" : "http")+"://127.0.0.1:"+ports[protocol],{
            rejectUnauthorized:false
        });
        const stream=client.request({":method":method,":path":target});
        const chunks=[];
        let status;
        let settled=false;
        function finish(value) {
            if (settled) return;
            settled=true;
            client.close();
            resolve(value);
        }
        client.on("error",reject);
        stream.on("response",headers => { status=headers[":status"]; });
        stream.on("data",chunk => chunks.push(chunk));
        stream.on("end",function () {
            finish({status:status,headers:undefined,body:Buffer.concat(chunks).toString("utf8"),aborted:false});
        });
        stream.on("aborted",function () {
            finish({status:status,headers:undefined,body:Buffer.concat(chunks).toString("utf8"),aborted:true});
        });
        stream.on("error",function (error) {
            if (!settled) { client.destroy(); reject(error); }
        });
        stream.end();
    });
}

function request(protocol,method,target) {
    return protocol.startsWith("http2")
        ? http2Request(protocol,method,target)
        : httpRequest(protocol,method,target);
}

async function expect(protocol,method,target,status,body) {
    const response=await request(protocol,method,target);
    assert.strictEqual(response.status,status,protocol+" "+method+" "+target+" status");
    assert.strictEqual(response.body,body,protocol+" "+method+" "+target+" body");
    return response;
}

function checkApplicationError(response,marker,filename) {
    assert.strictEqual(response.status,500);
    assert(response.body.includes(marker),response.body);
    assert(new RegExp(filename.replace(/\./g,"\\.")+":\\d+:\\d+$").test(response.body),response.body);
    assert(!response.body.includes("?achieve-mtime="),response.body);
    assert(!response.body.includes("C:\\projects"),response.body);
}

async function abortPendingRequest() {
    await new Promise(function (resolve) {
        const request=http.get({host:"127.0.0.1",port:ports.http,path:"/servlets/promise.jss.cjs?kind=pending"});
        request.on("response",response => response.resume());
        request.on("error",function () {});
        setTimeout(function () { request.destroy(); resolve(); },10);
    });
    await new Promise(resolve => setTimeout(resolve,100));
}

async function runProtocol(protocol) {
    const child=fork(path.join(__dirname,"fixture.js"),[],{
        silent:true,
        env:Object.assign({},process.env,{
            ACHIEVE_PROMISE_PROTOCOL:protocol,
            ACHIEVE_PROMISE_PORT:String(ports[protocol])
        })
    });
    let output="";
    child.stdout.on("data",chunk => output+=chunk);
    child.stderr.on("data",chunk => output+=chunk);
    try {
        await waitForMessage(child,"ready");

        await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=string",200,"hello");
        await expect(protocol,"GET","/servlets/promise.jss.mjs?kind=string",200,"hello");
        await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=undefined",204,"");
        await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=null",204,"");
        await expect(protocol,"GET","/servlets/promise.jss.mjs?kind=undefined",204,"");
        await expect(protocol,"GET","/servlets/promise.jss.mjs?kind=null",204,"");

        let response=await request(protocol,"GET","/servlets/promise.jss.cjs?kind=reject-after-await");
        checkApplicationError(response,"CJS_ASYNC_AFTER_AWAIT_MARKER","servlets/promise.jss.cjs");
        response=await request(protocol,"GET","/servlets/promise.jss.mjs?kind=reject-after-await");
        checkApplicationError(response,"ESM_ASYNC_AFTER_AWAIT_MARKER","servlets/promise.jss.mjs");
        await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=allow-async",201,"application owned");
        await expect(protocol,"GET","/health.txt",200,"healthy\n");

        if (protocol === "http") {
            await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=buffer",200,"buffer hello");
            response=await request(protocol,"GET","/servlets/promise.jss.cjs?kind=reject-immediate");
            checkApplicationError(response,"CJS_ASYNC_MARKER","servlets/promise.jss.cjs");

            await expect(protocol,"GET","/servlets/promise.jss.mjs?kind=buffer",200,"buffer hello");
            response=await request(protocol,"GET","/servlets/promise.jss.mjs?kind=reject-immediate");
            checkApplicationError(response,"ESM_ASYNC_MARKER","servlets/promise.jss.mjs");

            await expect(protocol,"GET","/servlets/synchronous.jss.cjs?kind=string",200,"sync hello");
            await expect(protocol,"GET","/servlets/synchronous.jss.cjs?kind=buffer",200,"sync buffer");
            response=await expect(protocol,"GET","/servlets/synchronous.jss.cjs?kind=undefined",204,"");
            assert.strictEqual(response.headers["content-length"],undefined);
            await expect(protocol,"GET","/servlets/synchronous.jss.cjs?kind=null",204,"");
            await expect(protocol,"GET","/servlets/synchronous.jss.cjs?kind=no-return",204,"");
            await expect(protocol,"GET","/servlets/synchronous.jss.cjs?kind=return",204,"");
            await expect(protocol,"GET","/servlets/synchronous.jss.cjs?kind=missing-property",204,"");
            response=await request(protocol,"GET","/servlets/synchronous.jss.cjs?kind=throw");
            checkApplicationError(response,"SYNC_MARKER","servlets/synchronous.jss.cjs");

            await expect(protocol,"GET","/servlets/thenable.jss.cjs",200,"thenable hello");
            await expect(protocol,"PATCH","/anything",200,"registered promise");

            let started=Date.now();
            await expect(protocol,"HEAD","/servlets/promise.jss.cjs?kind=head-delay",200,"");
            assert(Date.now()-started >= 45,"HEAD completed before its Promise settled");
            started=Date.now();
            await expect(protocol,"HEAD","/servlets/promise.jss.cjs?kind=undefined",204,"");
            started=Date.now();
            response=await request(protocol,"HEAD","/servlets/promise.jss.cjs?kind=head-reject");
            assert.strictEqual(response.status,500);
            assert.strictEqual(response.body,"");
            assert(Date.now()-started >= 45,"rejected HEAD completed before its Promise settled");

            response=await request(protocol,"GET","/servlets/promise.jss.cjs?kind=headers-reject");
            assert.strictEqual(response.status,200);
            assert.strictEqual(response.body,"prefix");
            assert(response.aborted,"response was not terminated after rejection with headers sent");
            await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=allow-rejection",202,"application caught rejection");
            await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=ended-rejection",200,"already ended");
            await abortPendingRequest();
            await expect(protocol,"GET","/health.txt",200,"healthy\n");
        }

        child.send("state");
        const state=await waitForMessage(child,"state");
        assert.deepStrictEqual(state.unhandled,[],protocol+" had an unhandled process error");
        assert(!output.includes("ERR_INVALID_ARG_TYPE"),protocol+" wrote a Promise as response content");
        assert(output.includes("INFO: Return from /servlets/promise.jss.cjs is undefined."),protocol+" missing undefined development INFO");
        assert(output.includes("INFO: Return from /servlets/promise.jss.cjs is null."),protocol+" missing null development INFO");
        return output;
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send("stop");
            await exited;
        }
    }
}

async function verifyProductionLogging() {
    const protocol="http";
    const child=fork(path.join(__dirname,"fixture.js"),[],{
        silent:true,
        env:Object.assign({},process.env,{
            ACHIEVE_PROMISE_PROTOCOL:protocol,
            ACHIEVE_PROMISE_PORT:String(ports[protocol]),
            ACHIEVE_PROMISE_MODE:"production"
        })
    });
    let output="";
    child.stdout.on("data",chunk => output+=chunk);
    child.stderr.on("data",chunk => output+=chunk);
    try {
        await waitForMessage(child,"ready");
        await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=undefined",204,"");
        await expect(protocol,"GET","/servlets/promise.jss.cjs?kind=null",204,"");
        assert(!output.includes("INFO: Return from "),"production emitted empty-return development INFO");
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send("stop");
            await exited;
        }
    }
}

(async function () {
    for (const protocol of protocols) await runProtocol(protocol);
    await verifyProductionLogging();
    console.log("PASS managed Promise servlet verification (HTTP, HTTPS, h2c, secure HTTP/2)");
})().catch(function (error) {
    console.error(error.stack || error);
    process.exitCode=1;
});
