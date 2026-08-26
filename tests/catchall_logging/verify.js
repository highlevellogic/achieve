const assert=require("node:assert");
const childProcess=require("node:child_process");
const http=require("node:http");
const path=require("node:path");

let nextPort=19330;

function start(logging) {
    return new Promise(function (resolve,reject) {
        const port=nextPort++;
        const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
            silent:true,
            env:Object.assign({},process.env,{
                ACHIEVE_CATCHALL_LOGGING:logging,
                ACHIEVE_CATCHALL_PORT:String(port)
            })
        });
        let stdout="";
        let stderr="";
        child.stdout.on("data",data => stdout+=data);
        child.stderr.on("data",data => stderr+=data);
        child.on("message",function (message) {
            if (message.event === "ready") resolve({child,port,stdout:() => stdout,stderr:() => stderr});
        });
        child.once("exit",code => reject(new Error("Catchall fixture exited before readiness: "+code+"\n"+stderr)));
    });
}

function stop(testCase) {
    return new Promise(function (resolve) {
        if (testCase.child.exitCode !== null) return resolve();
        testCase.child.once("exit",resolve);
        testCase.child.send({command:"stop"});
    });
}

function request(port,requestPath) {
    return new Promise(function (resolve,reject) {
        const req=http.get({host:"127.0.0.1",port:port,path:requestPath},function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                resolve({status:res.statusCode,body:Buffer.concat(chunks).toString("utf8")});
            });
        });
        req.on("error",reject);
    });
}

(async function () {
    for (const logging of ["disabled","enabled"]) {
        const testCase=await start(logging);
        try {
            let response=await request(testCase.port,"/unexpected");
            assert.strictEqual(response.status,500);
            assert.strictEqual(response.body,"Internal Server Error");
            response=await request(testCase.port,"/");
            assert.strictEqual(response.status,200);
            assert.strictEqual(response.body,"catchall server remains available\n");
            await new Promise(resolve => setTimeout(resolve,25));
            if (logging === "disabled") {
                assert.strictEqual(testCase.stdout(),"");
                assert.strictEqual(testCase.stderr(),"");
            } else {
                assert(testCase.stderr().includes("Catchall error in achieveApp."));
                assert(!testCase.stderr().includes("injected catchall failure"));
            }
            console.log("PASS catchall "+logging+" logging and server survival");
        } finally {
            await stop(testCase);
        }
    }
    console.log("All catchall logging verification tests passed.");
}()).catch(function (err) {
    console.error(err);
    process.exitCode=1;
});