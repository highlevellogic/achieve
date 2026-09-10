const fs = require("fs");
const path = require("path");
const scenario = process.env.ACHIEVE_LOGGING_SCENARIO;
let controlledDay = 13;
let ownedStreams = [];
let injectedCategory = process.env.ACHIEVE_INJECT_STREAM_ERROR_CATEGORY;

if (scenario === "rollover-error" || scenario === "access-init-failure") {
    const RealDate = Date;
    global.Date = class extends RealDate {
        constructor(...args) {
            if (args.length) return new RealDate(...args);
            return new RealDate(2026, 7, controlledDay, 12, 0, 0, 0);
        }
        static now() {
            return new RealDate(2026, 7, controlledDay, 12, 0, 0, 0).getTime();
        }
    };
    const createWriteStream = fs.createWriteStream;
    fs.createWriteStream = function (...args) {
        const stream = createWriteStream.apply(fs, args);
        ownedStreams.push(stream);
        return stream;
    };
}

if (process.env.ACHIEVE_INJECT_STREAM_ERROR === "true" || injectedCategory) {
    const createWriteStream = fs.createWriteStream;
    fs.createWriteStream = function (...args) {
        const stream = createWriteStream.apply(fs, args);
        let filePath = String(args[0]);
        let shouldInject = !injectedCategory ||
            path.basename(path.dirname(filePath)) === injectedCategory;
        if (shouldInject) {
            setTimeout(function () {
                stream.emit("error", new Error("injected " + (injectedCategory || "server") + " log failure"));
            }, 100);
        }
        return stream;
    };
}

const achieve = require(process.env.ACHIEVE_MODULE);
const port = Number(process.env.ACHIEVE_LOGGING_PORT);

function send(message) {
    if (process.send) process.send(message);
}

if (process.env.ACHIEVE_LOG_PATH) {
    achieve.setLogPath(process.env.ACHIEVE_LOG_PATH);
}

let checks = {};
if (scenario === "production") {
    achieve.setMode("production");
} else if (scenario === "server") {
    achieve.setLogging("console", "server");
} else if (scenario === "server-only") {
    achieve.setLogging("server");
} else if (scenario === "rollover-error") {
    achieve.setLogging("server");
} else if (scenario === "all") {
    achieve.setLogging(true);
} else if (scenario === "none") {
    achieve.setLogging(false);
} else if (scenario === "access-only") {
    achieve.setLogging("access");
} else if (scenario === "access-suite") {
    achieve.setLogging("access");
    achieve.setCaching(true);
} else if (scenario === "access-production") {
    achieve.setMode("production");
    achieve.setLogging("access");
} else if (scenario === "access-http2") {
    achieve.setLogging("access");
} else if (scenario === "access-runtime-error") {
    achieve.setLogging("server", "access");
} else if (scenario === "duplicate") {
    achieve.setLogging("server", "server");
} else if (scenario === "selective") {
    achieve.setLogging("server", "access");
} else if (scenario === "invalid-preserves") {
    achieve.setLogging("server");
    try {
        achieve.setLogging("server", "unknown");
    } catch (err) {
        checks.invalidPreservesThrew = true;
    }
} else if (scenario === "invalid-api") {
    for (const item of [
        ["mode", function () { achieve.setMode("debug"); }],
        ["zero", function () { achieve.setLogging(); }],
        ["mixed", function () { achieve.setLogging(true, "server"); }],
        ["unknown", function () { achieve.setLogging("unknown"); }]
    ]) {
        try {
            item[1]();
            checks[item[0]] = false;
        } catch (err) {
            checks[item[0]] = true;
        }
    }
    send({type: "checks", checks: checks});
    process.exit(0);
} else if (scenario === "init-failure") {
    achieve.setLogging("server");
} else if (scenario === "access-init-failure") {
    achieve.setLogging("server", "access");
}

if (scenario === "startup-config") {
    achieve.setMode("production");
    achieve.setNodeEnv("startup-test");
    achieve.setBufferedInputLimit(2048);
    achieve.setCaching(true);
    achieve.setCompress(true);
    achieve.setRouteMap({"/public":"/resource.txt"});
    achieve.registerMethod("PURGE","servlets/lifecycle.jss");
    achieve.allowOrigins("https://startup.example","/","resource.txt");
    achieve.addMimeType("startup","application/x-startup");
    achieve.addAVMimeType("startup-media","video/x-startup");
}
achieve.setAppPath(process.env.ACHIEVE_APP_PATH);
let server;
if (scenario === "access-http2" || scenario === "startup-http2") {
    server=achieve.listen2(port);
} else if (scenario === "startup-https" || scenario === "startup-http2s") {
    const options={
        key:fs.readFileSync(path.join(__dirname,"test-key.pem")),
        cert:fs.readFileSync(path.join(__dirname,"test-cert.pem"))
    };
    options[scenario === "startup-https" ? "httpsPort" : "http2Port"]=port;
    server=scenario === "startup-https"
        ? achieve.slisten(options)
        : achieve.listen2(options);
} else {
    server=achieve.listen(port);
}
if (scenario === "init-failure" || scenario === "access-init-failure") {
    setTimeout(function () {
        send({
            type: "startup-result",
            refused: server === undefined,
            serverStreamDestroyed:
                scenario !== "access-init-failure" ||
                (ownedStreams[0] && ownedStreams[0].destroyed)
        });
        process.exit(server === undefined ? 0 : 1);
    }, 25);
    return;
}

if (!server) {
    send({type: "failure", message: "listener did not start"});
    process.exit(1);
}

server.once("listening", function () {
    for (const item of [
        ["mode", function () { achieve.setMode("production"); }],
        ["logging", function () { achieve.setLogging(false); }],
        ["path", function () { achieve.setLogPath("later"); }]
    ]) {
        try {
            item[1]();
            checks["late-" + item[0]] = false;
        } catch (err) {
            checks["late-" + item[0]] = true;
        }
    }
    if (scenario !== "rollover-error") {
        send({type: "ready", port: port, checks: checks});
        if (scenario === "access-runtime-error") {
            setTimeout(function () {
                achieve.setCompress("invalid");
            }, 150);
        }
        return;
    }

    controlledDay = 14;
    const conflictingServer = achieve.listen(port);
    conflictingServer.once("error", function () {
        setTimeout(function () {
            const retiringStream = ownedStreams[0];
            const currentLog = path.join(process.env.ACHIEVE_LOG_PATH, "server", "2026-08-14.log");
            retiringStream.emit("error", new Error("injected retiring stream failure"));
            setTimeout(function () {
                const sizeBeforeLaterEvent = fs.statSync(currentLog).size;
                achieve.setCompress("invalid");
                setTimeout(function () {
                    const sizeAfterLaterEvent = fs.statSync(currentLog).size;
                    const laterServer = achieve.listen(port + 1);
                    send({
                        type: "ready",
                        port: port,
                        checks: Object.assign(checks, {
                            rolloverCreatedNewStream: ownedStreams.length === 2,
                            sinkFailed: laterServer === undefined,
                            laterRecordDropped: sizeAfterLaterEvent === sizeBeforeLaterEvent
                        })
                    });
                }, 50);
            }, 50);
        }, 50);
    });
});

function stop() {
    server.close(function () {
        process.exit(0);
    });
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
