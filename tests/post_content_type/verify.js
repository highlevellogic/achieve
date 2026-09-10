const assert=require("node:assert");
const childProcess=require("node:child_process");
const http=require("node:http");
const path=require("node:path");

const port=19470;
const warning="WARNING: POST request has no Content-Type; Achieve is treating the input as application/x-www-form-urlencoded.";

function request(headers,body) {
    return new Promise(function (resolve,reject) {
        const req=http.request({
            host:"127.0.0.1",
            port:port,
            path:"/servlets/echo.jss",
            method:"POST",
            headers:headers
        },function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                resolve({status:res.statusCode,body:Buffer.concat(chunks).toString("utf8")});
            });
        });
        req.on("error",reject);
        req.end(body);
    });
}

function waitForReady(child) {
    return new Promise(function (resolve,reject) {
        child.on("message",function (message) {
            if (message.event === "ready") resolve();
        });
        child.once("exit",code => reject(new Error("Fixture exited before readiness: "+code)));
    });
}

function stop(child) {
    return new Promise(function (resolve) {
        if (child.exitCode !== null) return resolve();
        child.once("exit",resolve);
        child.send({command:"stop"});
    });
}

(async function () {
    const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
        silent:true,
        env:Object.assign({},process.env,{ACHIEVE_POST_CONTENT_TYPE_PORT:String(port)})
    });
    let stdout="";
    let stderr="";
    child.stdout.on("data",data => stdout+=data);
    child.stderr.on("data",data => stderr+=data);

    try {
        await waitForReady(child);

        let start=stdout.length;
        let response=await request({},"x=legacy&value=one%20two");
        await new Promise(resolve => setTimeout(resolve,25));
        let trace=stdout.substring(start);
        assert.strictEqual(response.status,200);
        assert.deepStrictEqual(JSON.parse(response.body),{x:"legacy",value:"one two"});
        assert.strictEqual(trace.split(warning).length-1,1,"Missing Content-Type warning was not emitted exactly once.");

        start=stdout.length;
        response=await request({"Content-Type":"application/x-www-form-urlencoded"},"x=form");
        await new Promise(resolve => setTimeout(resolve,25));
        trace=stdout.substring(start);
        assert.strictEqual(response.status,200);
        assert.deepStrictEqual(JSON.parse(response.body),{x:"form"});
        assert(!trace.includes(warning),"Explicit form Content-Type produced the missing-header warning.");

        start=stdout.length;
        response=await request({"Content-Type":"application/json"},JSON.stringify({x:"json"}));
        await new Promise(resolve => setTimeout(resolve,25));
        trace=stdout.substring(start);
        assert.strictEqual(response.status,200);
        assert.deepStrictEqual(JSON.parse(response.body),{x:"json"});
        assert(!trace.includes(warning),"JSON Content-Type produced the missing-header warning.");
        assert.strictEqual(stderr,"","Unexpected fixture stderr output.");

        console.log("All POST Content-Type warning verification tests passed.");
    } finally {
        await stop(child);
    }
}()).catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
