const net = require("net");
const tls = require("tls");
const path = require("path");
const {fork} = require("child_process");

const fixture = path.join(__dirname,"fixture.js");
const children = new Set();
let failures = 0;
let nextPort = 19350;

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
            ACHIEVE_ABSOLUTE_USERINFO_PORT:String(port),
            ACHIEVE_ABSOLUTE_USERINFO_SECURE:String(secure)
        }),
        silent:true
    });
    children.add(child);
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data",data => stderr += data);
    const ready = await waitForMessage(child,"ready");
    return {child:child,port:ready.port,secure:secure,stderr:function () {return stderr;}};
}

async function stopFixture(testCase) {
    const stopped = waitForMessage(testCase.child,"stopped");
    testCase.child.send("shutdown");
    const result = await stopped;
    check((testCase.secure ? "HTTPS" : "HTTP") + " fixture shutdown",
        !result.error,result.error);
    await new Promise(resolve => testCase.child.once("exit",resolve));
    children.delete(testCase.child);
}

function rawRequest(testCase,target) {
    return new Promise((resolve,reject) => {
        const options={host:"127.0.0.1",port:testCase.port};
        const socket=testCase.secure
            ? tls.connect(Object.assign({rejectUnauthorized:false},options))
            : net.createConnection(options);
        let response="";
        socket.setEncoding("latin1");
        socket.on("connect",function () {
            socket.write(
                "GET " + target + " HTTP/1.1\r\n" +
                "Host: wire-host.test\r\n" +
                "Connection: close\r\n\r\n"
            );
        });
        socket.on("data",data => response += data);
        socket.on("end",function () {
            const match=response.match(/^HTTP\/1\.1 (\d{3})/);
            resolve({status:match ? Number(match[1]) : 0,raw:response});
        });
        socket.on("error",reject);
    });
}

async function verifyProtocol(secure) {
    const testCase=await startFixture(secure);
    const label=secure ? "HTTPS" : "HTTP";
    try {
        for (const accepted of [
            ["origin-form","/servlets/probe.jss"],
            ["ordinary absolute-form","http://example.test/servlets/probe.jss"],
            ["explicit-port absolute-form","http://example.test:8080/servlets/probe.jss"]
        ]) {
            const result=await rawRequest(testCase,accepted[1]);
            check(label + " " + accepted[0] + " accepted",
                result.status === 200 && result.raw.includes("absolute-userinfo route reached"),
                result.status);
        }

        for (const rejected of [
            ["username userinfo","http://user@example.test/servlets/probe.jss"],
            ["username/password userinfo","http://user:password@example.test/servlets/probe.jss"],
            ["percent-encoded userinfo","http://us%65r@example.test/servlets/probe.jss"],
            ["percent-encoded at within userinfo","http://user%40name@example.test/servlets/probe.jss"],
            ["empty userinfo","http://@example.test/servlets/probe.jss"]
        ]) {
            const result=await rawRequest(testCase,rejected[1]);
            check(label + " " + rejected[0] + " rejected before routing",
                result.status === 400 &&
                result.raw.includes("Bad Request") &&
                !result.raw.includes("absolute-userinfo route reached"),
                result.status);
            const health=await rawRequest(testCase,"/servlets/probe.jss");
            check(label + " server healthy after " + rejected[0],
                health.status === 200 && health.raw.includes("absolute-userinfo route reached"),
                health.status);
        }

        check(label + " fixture stderr is empty",testCase.stderr() === "",testCase.stderr());
    } finally {
        await stopFixture(testCase);
    }
}

(async function () {
    await verifyProtocol(false);
    await verifyProtocol(true);
})().catch(function (err) {
    console.error(err);
    failures++;
}).finally(async function () {
    for (const child of children) child.kill();
    if (failures) process.exitCode=1;
});
