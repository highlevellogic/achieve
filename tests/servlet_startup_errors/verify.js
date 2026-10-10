const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");

const port=19440;
const temporaryRoot=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-servlet-startup-errors-"));
const applicationPath=path.join(temporaryRoot,"application");
const logPath=path.join(temporaryRoot,"logs");
let child;
let failures=0;
let unhandledRejections=[];
let childExit;

function check(name,condition,detail) {
    console.log((condition ? "PASS" : "FAIL")+" "+name+
        (detail === undefined ? "" : ": "+detail));
    if (!condition) failures++;
}

function request(requestPath,timeout=2000) {
    return new Promise(function (resolve) {
        let settled=false;
        function finish(result) {
            if (settled) return;
            settled=true;
            clearTimeout(timer);
            resolve(result);
        }
        const req=http.get({host:"127.0.0.1",port,path:requestPath},function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                finish({state:"complete",status:res.statusCode,body:Buffer.concat(chunks).toString("utf8")});
            });
            res.on("aborted",function () {
                finish({state:"aborted",status:res.statusCode,body:Buffer.concat(chunks).toString("utf8")});
            });
            res.on("error",function (error) {
                finish({state:"response-error",status:res.statusCode,error:error.message,body:Buffer.concat(chunks).toString("utf8")});
            });
        });
        req.on("error",function (error) {
            finish({state:"request-error",error:error.message});
        });
        const timer=setTimeout(function () {
            req.destroy();
            finish({state:"timeout"});
        },timeout);
    });
}

function start() {
    return new Promise(function (resolve,reject) {
        child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
            silent:true,
            env:Object.assign({},process.env,{
                ACHIEVE_STARTUP_ERROR_APP:applicationPath,
                ACHIEVE_STARTUP_ERROR_LOGS:logPath,
                ACHIEVE_STARTUP_ERROR_PORT:String(port)
            })
        });
        let stdout="";
        let stderr="";
        child.stdout.on("data",data => stdout+=data);
        child.stderr.on("data",data => stderr+=data);
        child.on("message",function (message) {
            if (message.event === "ready") resolve();
            if (message.event === "unhandledRejection") unhandledRejections.push(message.message);
        });
        child.on("exit",function (code,signal) {
            childExit={code,signal,stdout,stderr};
        });
        child.once("error",reject);
        child.once("exit",function (code) {
            if (code !== 0) reject(new Error("Startup-error fixture exited before completion: "+code+"\n"+stdout+stderr));
        });
    });
}

function stop() {
    return new Promise(function (resolve) {
        if (!child || child.exitCode !== null) return resolve();
        child.once("exit",resolve);
        child.send({command:"stop"});
    });
}

function readServerLog() {
    const directory=path.join(logPath,"server");
    if (!fs.existsSync(directory)) return "";
    return fs.readdirSync(directory)
        .filter(name => name.endsWith(".log"))
        .map(name => fs.readFileSync(path.join(directory,name),"utf8"))
        .join("\n");
}

async function waitForDiagnostics(expected) {
    for (let attempt=0;attempt<40;attempt++) {
        const log=readServerLog();
        if (expected.every(text => log.includes(text))) return log;
        await new Promise(resolve => setTimeout(resolve,25));
    }
    return readServerLog();
}

(async function () {
    fs.mkdirSync(applicationPath);
    fs.writeFileSync(path.join(applicationPath,"before-cjs.jss"),
        "exports.servlet=function () { return 'SHOULD_NOT_RUN'; };\n");
    fs.writeFileSync(path.join(applicationPath,"before-esm.jss.mjs"),
        "export function servlet() { return 'SHOULD_NOT_RUN'; }\n");
    fs.writeFileSync(path.join(applicationPath,"after-headers.jss"),
        "exports.servlet=function () { return 'SHOULD_NOT_RUN'; };\n");
    fs.writeFileSync(path.join(applicationPath,"after-completion.jss"),
        "exports.servlet=function () { return 'SHOULD_NOT_RUN'; };\n");
    fs.writeFileSync(path.join(applicationPath,"health.txt"),"HEALTH_OK");

    await start();

    let result=await request("/before-cjs.jss");
    check("CommonJS startup failure returns generic 500",
        result.state === "complete" && result.status === 500 && result.body === "Internal Server Error",
        JSON.stringify(result));

    result=await request("/before-esm.jss.mjs");
    check("first-load ESM startup failure returns generic 500",
        result.state === "complete" && result.status === 500 && result.body === "Internal Server Error",
        JSON.stringify(result));

    result=await request("/after-headers.jss");
    check("headers-sent startup failure destroys incomplete response",
        ((result.state === "aborted" || result.state === "response-error") && result.body === "PARTIAL") ||
        (result.state === "request-error" && result.error === "socket hang up"),
        JSON.stringify(result));

    result=await request("/after-completion.jss");
    check("completed response is not replaced or ended twice",
        result.state === "complete" && result.status === 200 && result.body === "APPLICATION_COMPLETE",
        JSON.stringify(result));

    result=await request("/health.txt");
    check("server remains healthy after startup failures",
        result.state === "complete" && result.status === 200 && result.body === "HEALTH_OK",
        JSON.stringify(result));

    const expectedDiagnostics=[
        "/before-cjs.jss",
        "/before-esm.jss.mjs",
        "/after-headers.jss",
        "/after-completion.jss"
    ];
    const serverLog=await waitForDiagnostics(expectedDiagnostics);
    for (const diagnostic of expectedDiagnostics) {
        check("server log records "+diagnostic,serverLog.includes(diagnostic));
    }
    check("no unhandled Promise rejection",unhandledRejections.length === 0,JSON.stringify(unhandledRejections));
    check("fixture process remains alive",child.exitCode === null,JSON.stringify(childExit));
})().catch(function (error) {
    failures++;
    console.error(error.stack || error);
}).finally(async function () {
    await stop();
    const resolvedRoot=path.resolve(temporaryRoot);
    const temporaryBoundary=path.resolve(os.tmpdir())+path.sep;
    if (!resolvedRoot.startsWith(temporaryBoundary) ||
        !path.basename(resolvedRoot).startsWith("achieve-servlet-startup-errors-")) {
        failures++;
        console.error("Refusing to remove unexpected temporary path: "+resolvedRoot);
    } else {
        fs.rmSync(resolvedRoot,{recursive:true,force:true});
    }
    console.log("Servlet-startup error verification: "+failures+" failure(s).");
    process.exitCode=failures ? 1 : 0;
});
