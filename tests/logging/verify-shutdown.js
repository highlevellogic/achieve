const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const http2 = require("http2");
const os = require("os");
const path = require("path");

const repositoryPath = path.join(__dirname,"..","..");
const fixturePath = path.join(__dirname,"shutdown-fixture.js");
const applicationPath = path.join(__dirname,"application");
const achieveModule = path.join(repositoryPath,"achieve.js");
const keyPath = path.join(__dirname,"test-key.pem");
const certPath = path.join(__dirname,"test-cert.pem");
let nextPort = 19130;
let failures = 0;

function check(name,condition,detail) {
    console.log((condition ? "PASS" : "FAIL") + " " + name +
        (detail === undefined ? "" : ": " + detail));
    if (!condition) failures++;
}

function removeTree(target) {
    if (!fs.existsSync(target)) return;
    for (const entry of fs.readdirSync(target,{withFileTypes:true})) {
        const entryPath = path.join(target,entry.name);
        if (entry.isDirectory()) removeTree(entryPath);
        else fs.unlinkSync(entryPath);
    }
    fs.rmdirSync(target);
}

function logText(root,category) {
    const directory = path.join(root,category);
    if (!fs.existsSync(directory)) return "";
    return fs.readdirSync(directory)
        .map(name => fs.readFileSync(path.join(directory,name),"utf8"))
        .join("");
}

function occurrenceCount(value,target) {
    return value.split(target).length - 1;
}

function startCase(scenario,root) {
    return new Promise((resolve,reject) => {
        const port = nextPort++;
        const secondPort = nextPort++;
        const child = childProcess.spawn(process.execPath,[fixturePath],{
            cwd:repositoryPath,
            env:Object.assign({},process.env,{
                ACHIEVE_MODULE:achieveModule,
                ACHIEVE_APP_PATH:applicationPath,
                ACHIEVE_LOG_PATH:root,
                ACHIEVE_SHUTDOWN_SCENARIO:scenario,
                ACHIEVE_SHUTDOWN_PORT:String(port),
                ACHIEVE_SHUTDOWN_SECOND_PORT:String(secondPort),
                ACHIEVE_TEST_KEY:keyPath,
                ACHIEVE_TEST_CERT:certPath
            }),
            stdio:["ignore","pipe","pipe","ipc"]
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data",data => stdout += data);
        child.stderr.on("data",data => stderr += data);
        child.on("message",function (message) {
            if (!settled && (message.type === "ready" || message.type === "shutdown" || message.type === "failure")) {
                settled = true;
                resolve({
                    child:child,
                    message:message,
                    port:port,
                    secondPort:secondPort,
                    stdout:function () { return stdout; },
                    stderr:function () { return stderr; }
                });
            }
        });
        child.on("error",reject);
        child.on("exit",function (code) {
            if (!settled) reject(new Error(scenario + " exited before reporting: " + code + "\n" + stderr));
        });
        setTimeout(function () {
            if (settled) return;
            settled = true;
            child.kill();
            reject(new Error(scenario + " timed out\n" + stdout + stderr));
        },5000).unref();
    });
}

function nextMessage(testCase,type) {
    return new Promise((resolve,reject) => {
        const timeout = setTimeout(function () {
            cleanup();
            reject(new Error("timed out waiting for " + type + "\n" + testCase.stderr()));
        },5000);
        function receive(message) {
            if (message.type !== type) return;
            cleanup();
            resolve(message);
        }
        function exited(code) {
            cleanup();
            reject(new Error("child exited before " + type + ": " + code + "\n" + testCase.stderr()));
        }
        function cleanup() {
            clearTimeout(timeout);
            testCase.child.removeListener("message",receive);
            testCase.child.removeListener("exit",exited);
        }
        testCase.child.on("message",receive);
        testCase.child.once("exit",exited);
    });
}

function waitForExit(testCase) {
    return new Promise((resolve,reject) => {
        if (testCase.child.exitCode !== null) return resolve(testCase.child.exitCode);
        const timeout = setTimeout(function () {
            testCase.child.kill();
            reject(new Error("timed out waiting for child exit\n" + testCase.stderr()));
        },5000);
        testCase.child.once("exit",function (code) {
            clearTimeout(timeout);
            resolve(code);
        });
    });
}

function request(protocol,port,requestPath) {
    if (protocol === "http2") {
        return new Promise((resolve,reject) => {
            const client = http2.connect("http://localhost:" + port);
            const req = client.request({":path":requestPath});
            let status;
            const chunks = [];
            client.once("error",reject);
            req.on("response",headers => status = headers[":status"]);
            req.on("data",chunk => chunks.push(chunk));
            req.on("end",function () {
                client.close();
                resolve({status:status,body:Buffer.concat(chunks).toString()});
            });
            req.on("error",function (err) {
                client.destroy();
                reject(err);
            });
            req.end();
        });
    }

    return new Promise((resolve,reject) => {
        const client = protocol === "https" ? https : http;
        const req = client.request({
            port:port,
            path:requestPath,
            rejectUnauthorized:false
        },function (res) {
            const chunks = [];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()});
            });
        });
        req.on("error",reject);
        req.end();
    });
}

function refused(protocol,port) {
    return request(protocol,port,"/").then(
        function () { return false; },
        function () { return true; }
    );
}

async function normalShutdown(scenario,protocol,root) {
    const testCase = await startCase(scenario,root);
    check(scenario + " listener started",testCase.message.type === "ready");
    const response = await request(protocol,testCase.port,"/");
    check(scenario + " request succeeds",response.status === 200,response.status);
    const shutdownMessage = nextMessage(testCase,"shutdown");
    testCase.child.send("shutdown");
    const result = await shutdownMessage;
    const exitCode = await waitForExit(testCase);
    check(scenario + " repeated callbacks once each",result.callbackCount === 2,result.callbackCount);
    check(scenario + " shutdown has no error",result.errors.length === 0,result.errors.join(","));
    check(scenario + " streams close",result.streamsClosed);
    check(scenario + " later listener refused",result.laterListenerRefused);
    check(scenario + " process exits naturally",exitCode === 0,exitCode);
    check(scenario + " refuses new connections",await refused(protocol,testCase.port));
    const serverLog = logText(root,"server");
    const requested = serverLog.indexOf(" SHUTDOWN requested reason=application");
    const listenersClosed = serverLog.indexOf(" SHUTDOWN listeners closed");
    const completed = serverLog.indexOf(" SHUTDOWN completed");
    check(scenario + " shutdown records occur exactly once",
        occurrenceCount(serverLog," SHUTDOWN requested reason=application") === 1 &&
        occurrenceCount(serverLog," SHUTDOWN listeners closed") === 1 &&
        occurrenceCount(serverLog," SHUTDOWN completed") === 1,
        serverLog);
    check(scenario + " shutdown records ordered",
        requested !== -1 && listenersClosed > requested && completed > listenersClosed,
        serverLog);
    check(scenario + " completed is final server event",
        / SHUTDOWN completed\r?\n$/.test(serverLog),serverLog);
}

(async function () {
    const temporaryPath = fs.mkdtempSync(path.join(os.tmpdir(),"achieve-shutdown-"));
    try {
        await normalShutdown("http","http",path.join(temporaryPath,"http"));
        await normalShutdown("https","https",path.join(temporaryPath,"https"));
        await normalShutdown("http2","http2",path.join(temporaryPath,"http2"));

        const multipleRoot = path.join(temporaryPath,"multiple");
        const multiple = await startCase("multiple",multipleRoot);
        const first = await request("http",multiple.port,"/");
        const second = await request("https",multiple.secondPort,"/");
        check("multiple listeners both serve",first.status === 200 && second.status === 200);
        const multipleShutdown = nextMessage(multiple,"shutdown");
        multiple.child.send("close-first");
        const multipleResult = await multipleShutdown;
        await waitForExit(multiple);
        check("already-closing listener does not block others",multipleResult.errors.length === 0);
        check("multiple listeners both refuse after shutdown",
            await refused("http",multiple.port) && await refused("https",multiple.secondPort));

        const noListenerRoot = path.join(temporaryPath,"no-listener");
        const noListener = await startCase("no-listener",noListenerRoot);
        check("shutdown with no listener completes",noListener.message.callbackCount === 2);
        check("shutdown with no listener has no log files",!fs.existsSync(noListenerRoot));
        await waitForExit(noListener);

        const closedListenerRoot = path.join(temporaryPath,"closed-listener");
        const closedListener = await startCase("closed-listener",closedListenerRoot);
        const closedListenerShutdown = nextMessage(closedListener,"shutdown");
        closedListener.child.send("close-then-shutdown");
        const closedListenerResult = await closedListenerShutdown;
        await waitForExit(closedListener);
        check("shutdown drains logging with zero active listeners",
            closedListenerResult.streamsClosed && closedListenerResult.errors.length === 0);

        const listenerFailureRoot = path.join(temporaryPath,"listener-failure");
        const listenerFailure = await startCase("multiple",listenerFailureRoot);
        const listenerFailureShutdown = nextMessage(listenerFailure,"shutdown");
        listenerFailure.child.send("broken-close");
        const listenerFailureResult = await listenerFailureShutdown;
        await waitForExit(listenerFailure);
        check("listener close failure reaches each callback",
            listenerFailureResult.errors.length === 2 &&
            listenerFailureResult.errors.every(function (message) {
                return message === "injected listener close failure";
            }));
        check("listener close failure still drains streams",listenerFailureResult.streamsClosed);
        check("listener close failure still closes other listener",
            await refused("https",listenerFailure.secondPort));

        const inFlightRoot = path.join(temporaryPath,"in-flight");
        const inFlight = await startCase("in-flight",inFlightRoot);
        const inFlightShutdown = nextMessage(inFlight,"shutdown");
        const shutdownProgress = nextMessage(inFlight,"shutdown-progress");
        const inFlightResponse = new Promise((resolve,reject) => {
            const req = http.request({port:inFlight.port,path:"/servlets/shutdown.jss"},function (res) {
                const chunks = [];
                let requested = false;
                res.on("data",function (chunk) {
                    chunks.push(chunk);
                    if (!requested) {
                        requested = true;
                        inFlight.child.send("shutdown-and-try-listen");
                    }
                });
                res.on("end",function () {
                    resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()});
                });
            });
            req.on("error",reject);
            req.end();
        });
        const progressResult = await shutdownProgress;
        check("listener startup refused while shutdown is in progress",
            progressResult.listenerRefused);
        inFlight.child.send("complete-in-flight");
        const inFlightResult = await inFlightResponse;
        const inFlightShutdownResult = await inFlightShutdown;
        await waitForExit(inFlight);
        check("in-flight request completes",inFlightResult.status === 200 && inFlightResult.body.includes("completed"));
        check("in-flight shutdown completes",inFlightShutdownResult.errors.length === 0);
        const inFlightAccess = logText(inFlightRoot,"access");
        check("in-flight access record drains",
            inFlightAccess.includes(' target="/servlets/shutdown.jss" ') && inFlightAccess.includes(" state=complete"),
            inFlightAccess);
        const inFlightServerLog = logText(inFlightRoot,"server");
        check("in-flight shutdown records occur exactly once",
            occurrenceCount(inFlightServerLog," SHUTDOWN requested reason=application") === 1 &&
            occurrenceCount(inFlightServerLog," SHUTDOWN listeners closed") === 1 &&
            occurrenceCount(inFlightServerLog," SHUTDOWN completed") === 1,
            inFlightServerLog);

        for (const item of [["signal-int","SIGINT"],["signal-term","SIGTERM"]]) {
            const root = path.join(temporaryPath,item[0]);
            const signalCase = await startCase(item[0],root);
            const signalMessage = nextMessage(signalCase,"shutdown");
            signalCase.child.send({signal:item[1]});
            const result = await signalMessage;
            const exitCode = await waitForExit(signalCase);
            check(item[1] + " reason recorded",logText(root,"server").includes("reason=" + item[1]));
            check(item[1] + " callback completes",result.signal === item[1] && !result.errors.length);
            check(item[1] + " exits naturally",exitCode === 0,exitCode);
        }

        for (const category of ["server","access"]) {
            const root = path.join(temporaryPath,"failed-" + category);
            const failed = await startCase("failed-" + category,root);
            const shutdownMessage = nextMessage(failed,"shutdown");
            failed.child.send({failSink:category});
            const result = await shutdownMessage;
            const exitCode = await waitForExit(failed);
            check(category + " sink failure does not block shutdown",result.callbackCount === 2 && exitCode === 0);
            check(category + " sink failure reported once",
                (failed.stderr().match(new RegExp("injected " + category + " shutdown failure","g")) || []).length === 1,
                failed.stderr());
            const healthyCategory = category === "server" ? "access" : "server";
            check("healthy " + healthyCategory + " sink closes",result.streamsClosed);
        }

        check("repository logs remain clean",
            !fs.existsSync(path.join(repositoryPath,"logs","server")) &&
            !fs.existsSync(path.join(repositoryPath,"logs","access")));
    } finally {
        removeTree(temporaryPath);
    }

    if (failures) {
        console.error(failures + " shutdown verification test(s) failed.");
        process.exitCode = 1;
    } else {
        console.log("All Stage 3 shutdown verification tests passed.");
    }
})().catch(function (err) {
    console.error(err);
    process.exitCode = 1;
});
