const fs = require("fs");
const path = require("path");

const ownedStreams = [];
const createWriteStream = fs.createWriteStream;
fs.createWriteStream = function (...args) {
    const stream = createWriteStream.apply(fs, args);
    stream.achieveTestPath = String(args[0]);
    ownedStreams.push(stream);
    return stream;
};

const achieve = require(process.env.ACHIEVE_MODULE);
const scenario = process.env.ACHIEVE_SHUTDOWN_SCENARIO;
const port = Number(process.env.ACHIEVE_SHUTDOWN_PORT);
const secondPort = Number(process.env.ACHIEVE_SHUTDOWN_SECOND_PORT);

function send(message) {
    if (process.send) process.send(message);
}

if (process.env.ACHIEVE_LOG_PATH) {
    achieve.setLogPath(process.env.ACHIEVE_LOG_PATH);
}

achieve.setLogging("server", "access");
achieve.setAppPath(process.env.ACHIEVE_APP_PATH);

let servers = [];

function listener(protocol, listenerPort) {
    if (protocol === "https") {
        return achieve.slisten({
            key: fs.readFileSync(process.env.ACHIEVE_TEST_KEY),
            cert: fs.readFileSync(process.env.ACHIEVE_TEST_CERT),
            httpsPort: listenerPort
        });
    }
    if (protocol === "http2") return achieve.listen2(listenerPort);
    return achieve.listen(listenerPort);
}

function shutdown(reason,duringShutdown) {
    let callbackCount = 0;
    let errors = [];

    function completed(err) {
        callbackCount++;
        if (err) errors.push(err.message);
        if (callbackCount !== 2) return;

        const laterServer = achieve.listen(port + 20);
        send({
            type: "shutdown",
            callbackCount: callbackCount,
            errors: errors,
            streamsClosed: ownedStreams.every(function (stream) {
                return stream.closed || stream.destroyed;
            }),
            laterListenerRefused: laterServer === undefined
        });
        if (process.connected) process.disconnect();
    }

    achieve.shutdown(reason,completed);
    achieve.shutdown(completed);
    if (duringShutdown) duringShutdown();
}

function installSignal(signal) {
    process.on(signal,function () {
        achieve.shutdown(signal,function (err) {
            send({
                type: "shutdown",
                callbackCount: 1,
                errors: err ? [err.message] : [],
                streamsClosed: ownedStreams.every(function (stream) {
                    return stream.closed || stream.destroyed;
                }),
                signal: signal
            });
            if (err) process.exitCode = 1;
            if (process.connected) process.disconnect();
        });
    });
}

if (scenario === "no-listener") {
    shutdown("application");
} else {
    const protocols = scenario === "multiple"
        ? ["http", "https"]
        : [scenario === "https" ? "https" : scenario === "http2" ? "http2" : "http"];

    servers = protocols.map(function (protocol, index) {
        return listener(protocol,index === 0 ? port : secondPort);
    });

    let listening = 0;
    servers.forEach(function (server) {
        if (!server) {
            send({type: "failure", message: "listener did not start"});
            process.exitCode = 1;
            return;
        }
        server.once("listening",function () {
            listening++;
            if (listening !== servers.length) return;

            if (scenario === "signal-int") installSignal("SIGINT");
            if (scenario === "signal-term") installSignal("SIGTERM");

            send({
                type: "ready",
                port: port,
                secondPort: secondPort,
                protocols: protocols
            });
        });
    });
}

process.on("message",function (message) {
    if (message === "shutdown") shutdown("application");
    if (message === "shutdown-and-try-listen") {
        shutdown("application",function () {
            const duringServer = achieve.listen(port + 20);
            send({
                type: "shutdown-progress",
                listenerRefused: duringServer === undefined
            });
            if (duringServer) duringServer.close(function () {});
        });
    }
    if (message === "close-first") {
        servers[0].close(function () {});
        shutdown("application");
    }
    if (message === "close-then-shutdown") {
        servers[0].close(function () {
            shutdown("application");
        });
    }
    if (message === "broken-close") {
        const originalClose = servers[0].close;
        servers[0].close = function () {
            originalClose.call(servers[0]);
            throw new Error("injected listener close failure");
        };
        shutdown("application");
    }
    if (message && message.failSink) {
        const target = ownedStreams.find(function (stream) {
            return path.basename(path.dirname(stream.achieveTestPath)) === message.failSink;
        });
        target.emit("error",new Error("injected " + message.failSink + " shutdown failure"));
        setImmediate(function () {
            shutdown("application");
        });
    }
    if (message && message.signal) process.emit(message.signal);
});
