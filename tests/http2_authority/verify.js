const http2 = require("http2");
const path = require("path");
const {fork} = require("child_process");

const fixture = path.join(__dirname,"fixture.js");
const children = new Set();
let failures = 0;
let nextPort = 19240;

function check(name,condition,detail) {
    console.log((condition ? "PASS" : "FAIL") + " " + name +
        (detail === undefined ? "" : ": " + detail));
    if (!condition) failures++;
}

function waitForMessage(child,type) {
    return new Promise((resolve,reject) => {
        const timeout = setTimeout(function () {
            cleanup();
            reject(new Error("timeout waiting for " + type));
        },5000);
        function cleanup() {
            clearTimeout(timeout);
            child.off("message",onMessage);
            child.off("exit",onExit);
        }
        function onMessage(message) {
            if (!message || message.type !== type) return;
            cleanup();
            resolve(message);
        }
        function onExit(code) {
            cleanup();
            reject(new Error("fixture exited before " + type + " with " + code));
        }
        child.on("message",onMessage);
        child.once("exit",onExit);
    });
}

async function startFixture(secure) {
    const port = nextPort++;
    const child = fork(fixture,[],{
        cwd:path.join(__dirname,"..",".."),
        env:Object.assign({},process.env,{
            ACHIEVE_HTTP2_AUTHORITY_PORT:String(port),
            ACHIEVE_HTTP2_AUTHORITY_SECURE:String(secure)
        }),
        silent:true
    });
    children.add(child);
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data",data => stderr += data);
    const ready = await waitForMessage(child,"ready");
    return {
        child:child,
        port:ready.port,
        secure:secure,
        absentSchemeConflictStatus:ready.absentSchemeConflictStatus,
        stderr:function () {return stderr;}
    };
}

async function stopFixture(testCase) {
    const stopped = waitForMessage(testCase.child,"stopped");
    testCase.child.send("shutdown");
    const result = await stopped;
    check((testCase.secure ? "h2s" : "h2c") + " shutdown",!result.error,result.error);
    await new Promise(resolve => testCase.child.once("exit",resolve));
    children.delete(testCase.child);
}

function request(testCase,headers) {
    return new Promise((resolve,reject) => {
        const origin = (testCase.secure ? "https" : "http") +
            "://127.0.0.1:" + testCase.port;
        const client = http2.connect(origin,testCase.secure
            ? {rejectUnauthorized:false}
            : undefined);
        let settled = false;
        function fail(err) {
            if (settled) return;
            settled = true;
            client.destroy();
            reject(err);
        }
        client.once("error",fail);
        const req = client.request(Object.assign({
            ":method":"GET",
            ":path":"/index.html"
        },headers));
        let status;
        const chunks = [];
        req.on("response",responseHeaders => status = responseHeaders[":status"]);
        req.on("data",chunk => chunks.push(chunk));
        req.once("error",fail);
        req.on("end",function () {
            if (settled) return;
            settled = true;
            client.close();
            resolve({status:status,body:Buffer.concat(chunks).toString()});
        });
        req.end();
    });
}

async function verifyProtocol(secure) {
    const testCase = await startFixture(secure);
    const protocol = secure ? "h2s" : "h2c";
    const defaultPort = secure ? "443" : "80";
    try {
        check(protocol + " absent scheme does not imply port 80",
            testCase.absentSchemeConflictStatus === 400,
            testCase.absentSchemeConflictStatus);
        const cases = [
            ["authority only",{":authority":"one.example"},200],
            ["Host only",{":authority":undefined,host:"one.example"},200],
            ["matching",{":authority":"one.example",host:"one.example"},200],
            ["conflicting",{":authority":"one.example",host:"two.example"},400],
            ["host-name case",{":authority":"ONE.Example",host:"one.example"},200],
            ["explicit default port",{
                ":authority":"one.example",
                host:"one.example:" + defaultPort
            },200],
            ["same nondefault port",{
                ":authority":"one.example:0081",
                host:"ONE.example:81"
            },200],
            ["different nondefault port",{
                ":authority":"one.example:81",
                host:"one.example:82"
            },400],
            ["empty authority port",{
                ":authority":"one.example:",
                host:"one.example"
            },200],
            ["percent-encoded unreserved host",{
                ":authority":"%6fne.example",
                host:"one.example"
            },200],
            ["equivalent IPv6 host",{
                ":authority":"[2001:0DB8:0:0:0:0:0:1]",
                host:"[2001:db8::1]"
            },200],
            ["other scheme does not imply port 80",{
                ":scheme":"example",
                ":authority":"one.example",
                host:"one.example:80"
            },400],
            ["other scheme matching explicit port",{
                ":scheme":"example",
                ":authority":"one.example:80",
                host:"ONE.example:080"
            },200]
        ];
        for (const [name,headers,expectedStatus] of cases) {
            const result = await request(testCase,headers);
            check(protocol + " " + name + " status",
                result.status === expectedStatus,result.status);
            if (expectedStatus === 200) {
                check(protocol + " " + name + " dispatched",
                    result.body.includes("request-path root"));
            } else {
                check(protocol + " " + name + " rejected before dispatch",
                    result.body === "Bad Request",JSON.stringify(result.body));
            }
        }

        const synthesized = await request(testCase,{":authority":undefined});
        check(protocol + " public client synthesizes missing authority",
            synthesized.status === 200,synthesized.status);
        check(protocol + " fixture stderr",testCase.stderr() === "",testCase.stderr());
    } finally {
        await stopFixture(testCase);
    }
}

(async function () {
    try {
        await verifyProtocol(false);
        await verifyProtocol(true);
    } finally {
        for (const child of children) child.kill();
    }
    if (failures) {
        console.error(failures + " HTTP/2 authority verification failure(s).");
        process.exitCode = 1;
    } else {
        console.log("All HTTP/2 authority checks passed.");
    }
})().catch(function (err) {
    console.error(err.stack || err);
    for (const child of children) child.kill();
    process.exitCode = 1;
});
