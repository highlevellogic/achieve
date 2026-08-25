const path = require("path");
const achieve = require("../../achieve");

const scenario = process.env.ACHIEVE_CONNECT_SCENARIO;
const port = Number(process.env.ACHIEVE_CONNECT_PORT);

function send(message) {
    if (process.send) process.send(message);
}

if (scenario === "http2") {
    achieve.setLogging(false);
} else {
    achieve.setLogPath(process.env.ACHIEVE_CONNECT_LOG_PATH);
    achieve.setLogging("server", "access");
}

achieve.setAppPath(path.join(__dirname,"..","request_path","application"));

const server = scenario === "http2"
    ? achieve.listen2(port)
    : achieve.listen(port);

if (!server) {
    send({type:"failure",message:"listener did not start"});
    process.exit(1);
}

if (scenario === "output-error") {
    server.prependListener("connect",function (req,socket) {
        const realEnd = socket.end;
        socket.end = function () {
            socket.end = realEnd;
            throw new Error("injected CONNECT output failure");
        };
    });
} else if (scenario === "internal-error") {
    server.prependListener("connect",function (req) {
        Object.defineProperty(req,"rawHeaders",{
            configurable:true,
            get:function () {
                throw new Error("injected CONNECT internal failure");
            }
        });
    });
}

server.once("listening",function () {
    send({type:"ready",port:port});
});

process.on("message",function (message) {
    if (message !== "shutdown") return;
    server.close(function (err) {
        send({type:"stopped",error:err ? err.message : undefined});
        if (process.connected) process.disconnect();
    });
});
