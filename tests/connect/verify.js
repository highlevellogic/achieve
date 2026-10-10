const fs = require("fs");
const http2 = require("http2");
const net = require("net");
const os = require("os");
const path = require("path");
const {fork} = require("child_process");

const fixture = path.join(__dirname,"fixture.js");
const version = require("../../package.json").version;
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(),"achieve-connect-"));
const children = new Set();
let failures = 0;
let nextPort = 19190;

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

async function startFixture(scenario) {
    const port = nextPort++;
    const logPath = path.join(temporaryRoot,scenario);
    const child = fork(fixture,[],{
        cwd:path.join(__dirname,"..",".."),
        env:Object.assign({},process.env,{
            ACHIEVE_CONNECT_SCENARIO:scenario,
            ACHIEVE_CONNECT_PORT:String(port),
            ACHIEVE_CONNECT_LOG_PATH:logPath
        }),
        execArgv:["--pending-deprecation"],
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
        logPath:logPath,
        stderr:function () {return stderr;}
    };
}

async function stopFixture(testCase) {
    const stopped = waitForMessage(testCase.child,"stopped");
    testCase.child.send("shutdown");
    const result = await stopped;
    check("shutdown " + path.basename(testCase.logPath),!result.error,result.error);
    await new Promise(resolve => testCase.child.once("exit",resolve));
    children.delete(testCase.child);
}

function rawConnect(port,target,hostLines,extra) {
    return new Promise((resolve,reject) => {
        const socket = net.createConnection({port:port});
        const chunks = [];
        let ended = false;
        const timeout = setTimeout(function () {
            socket.destroy();
            reject(new Error("CONNECT socket did not close for " + target));
        },2000);
        socket.on("connect",function () {
            socket.write(
                "CONNECT " + target + " HTTP/1.1\r\n" + hostLines +
                "Connection: keep-alive\r\n\r\n" + (extra || "")
            );
        });
        socket.on("data",chunk => chunks.push(chunk));
        socket.on("end",function () { ended = true; });
        socket.on("error",reject);
        socket.on("close",function () {
            clearTimeout(timeout);
            const raw = Buffer.concat(chunks).toString("utf8");
            const separator = raw.indexOf("\r\n\r\n");
            const headerText = separator === -1 ? raw : raw.substring(0,separator);
            const body = separator === -1 ? "" : raw.substring(separator + 4);
            const lines = headerText.split("\r\n");
            const statusMatch = (lines[0] || "").match(/^HTTP\/1\.1 (\d{3}) /);
            const headers = {};
            for (const line of lines.slice(1)) {
                const colon = line.indexOf(":");
                if (colon !== -1) {
                    headers[line.substring(0,colon).toLowerCase()] =
                        line.substring(colon + 1).trim();
                }
            }
            resolve({
                status:statusMatch ? Number(statusMatch[1]) : 0,
                headers:headers,
                body:body,
                raw:raw,
                ended:ended
            });
        });
    });
}

function logText(logPath,category) {
    const directory = path.join(logPath,category);
    if (!fs.existsSync(directory)) return "";
    return fs.readdirSync(directory)
        .filter(name => name.endsWith(".log"))
        .map(name => fs.readFileSync(path.join(directory,name),"utf8"))
        .join("");
}

function occurrences(text,fragment) {
    return text.split(fragment).length - 1;
}

function checkResponse(name,result,status,body,contentType) {
    check(name + " status",result.status === status,result.status);
    check(name + " body",result.body === body,JSON.stringify(result.body));
    check(name + " content type",result.headers["content-type"] === contentType,
        result.headers["content-type"]);
    check(name + " content length",
        Number(result.headers["content-length"]) === Buffer.byteLength(body,"utf8"),
        result.headers["content-length"]);
    check(name + " connection close",result.headers.connection === "close",
        result.headers.connection);
    check(name + " date",!Number.isNaN(Date.parse(result.headers.date)),result.headers.date);
    check(name + " socket closed",result.ended,true);
}

function http2Connect(port) {
    return new Promise((resolve,reject) => {
        const client = http2.connect("http://localhost:" + port);
        const request = client.request({
            ":method":"CONNECT",
            ":authority":"example.com:443"
        });
        let status;
        const chunks = [];
        client.once("error",reject);
        request.on("response",headers => status = headers[":status"]);
        request.on("data",chunk => chunks.push(chunk));
        request.on("error",reject);
        request.on("end",function () {
            client.close();
            resolve({status:status,body:Buffer.concat(chunks).toString()});
        });
        request.end();
    });
}

(async function () {
    try {
        const normal = await startFixture("normal");
        const unsupportedBody =
            "CONNECT request method is not yet supported on the server: " +
            "HLL Achieve v" + version;
        const handled = [];

        for (const target of [
            "example.com:443", "example.com:80", "host:0", "host:65535",
            "[::1]:443", "[2001:db8::1]:443", "[v1.a]:443"
        ]) {
            const result = await rawConnect(
                normal.port,target,"Host: " + target + "\r\n"
            );
            checkResponse("valid " + target,result,501,unsupportedBody,
                "text/plain; charset=utf-8");
            handled.push({target:target,status:501});
        }

        for (const target of [
            "example.com", "example.com:", "example.com:abc",
            "example.com:65536", "example.com:99999",
            "user@example.com:443", "/foo:443", "http://example.com:443",
            "::1:443", "[::1:443"
        ]) {
            const result = await rawConnect(
                normal.port,target,"Host: example.com:443\r\n"
            );
            checkResponse("invalid " + target,result,400,"Bad Request",
                "text/plain;charset=utf-8");
            handled.push({target:target,status:400});
        }

        let result = await rawConnect(
            normal.port,"example.com:443",
            "Host: example.com:443\r\nHost: example.com:443\r\n"
        );
        checkResponse("duplicate Host",result,400,"Bad Request",
            "text/plain;charset=utf-8");
        handled.push({target:"example.com:443",status:400});

        result = await rawConnect(
            normal.port,"example.com:443","Host: example.com:abc\r\n"
        );
        checkResponse("malformed Host",result,400,"Bad Request",
            "text/plain;charset=utf-8");
        handled.push({target:"example.com:443",status:400});

        result = await rawConnect(normal.port,"example.com:443","","");
        checkResponse("missing Host",result,400,"Bad Request",
            "text/plain;charset=utf-8");
        handled.push({target:"example.com:443",status:400});

        result = await rawConnect(
            normal.port,"head.example:443","Host: head.example:443\r\n",
            "GET /must-not-run HTTP/1.1\r\nHost: head.example\r\n\r\n"
        );
        checkResponse("nonempty head",result,501,unsupportedBody,
            "text/plain; charset=utf-8");
        check("nonempty head receives one response",
            occurrences(result.raw,"HTTP/1.1 ") === 1,
            occurrences(result.raw,"HTTP/1.1 "));
        handled.push({target:"head.example:443",status:501});

        await stopFixture(normal);
        const accessLog = logText(normal.logPath,"access");
        check("one access record per handled CONNECT",
            occurrences(accessLog," method=\"CONNECT\"") === handled.length,
            occurrences(accessLog," method=\"CONNECT\"") + "/" + handled.length);
        check("all handled CONNECT records complete",
            occurrences(accessLog," state=complete") === handled.length,
            occurrences(accessLog," state=complete"));
        check("no handled CONNECT record aborted",!accessLog.includes(" state=aborted"));
        check("CONNECT 400 logged",accessLog.includes(" status=400 "));
        check("CONNECT 501 logged",accessLog.includes(" status=501 "));
        check("normal CONNECT has no deprecation warning",
            !/DEP0169|DEP0170/.test(normal.stderr()),normal.stderr());

        const outputError = await startFixture("output-error");
        result = await rawConnect(
            outputError.port,"example.com:443","Host: example.com:443\r\n"
        );
        check("forced output failure sends no partial response",result.raw === "",result.raw);
        await stopFixture(outputError);
        const outputAccess = logText(outputError.logPath,"access");
        check("forced output failure logs once",
            occurrences(outputAccess," method=\"CONNECT\"") === 1,
            occurrences(outputAccess," method=\"CONNECT\""));
        check("forced output failure is aborted",
            outputAccess.includes(" status=501 ") && outputAccess.includes(" state=aborted"));

        const internalError = await startFixture("internal-error");
        result = await rawConnect(
            internalError.port,"example.com:443","Host: example.com:443\r\n"
        );
        checkResponse("unexpected internal failure",result,500,
            "Internal Server Error","text/plain;charset=utf-8");
        await stopFixture(internalError);
        const internalServerLog = logText(internalError.logPath,"server");
        const internalAccessLog = logText(internalError.logPath,"access");
        check("unexpected internal failure reaches server log",
            internalServerLog.includes("ERROR Catchall error handling CONNECT."));
        check("unexpected internal failure access status",
            occurrences(internalAccessLog," status=500 ") === 1 &&
            occurrences(internalAccessLog," state=complete") === 1);

        const h2 = await startFixture("http2");
        const h2Result = await http2Connect(h2.port);
        check("HTTP/2 CONNECT behavior unchanged",
            h2Result.status === 405 && h2Result.body === "",
            h2Result.status + " " + JSON.stringify(h2Result.body));
        await stopFixture(h2);
        check("HTTP/2 check has no deprecation warning",
            !/DEP0169|DEP0170/.test(h2.stderr()),h2.stderr());
    } finally {
        for (const child of children) child.kill();
        fs.rmSync(temporaryRoot,{recursive:true,force:true});
    }

    if (failures) {
        console.error(failures + " CONNECT verification failure(s).");
        process.exitCode = 1;
    } else {
        console.log("All CONNECT checks passed.");
    }
})().catch(function (err) {
    console.error(err.stack || err);
    for (const child of children) child.kill();
    fs.rmSync(temporaryRoot,{recursive:true,force:true});
    process.exitCode = 1;
});
