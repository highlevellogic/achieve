const fs=require("node:fs");
const path=require("node:path");
const achieve=require("../../achieve");

const protocol=process.env.ACHIEVE_PROMISE_PROTOCOL;
const port=Number(process.env.ACHIEVE_PROMISE_PORT);
achieve.setMode(process.env.ACHIEVE_PROMISE_MODE || "development");
achieve.setLogging("console");
achieve.setAppPath(path.join(__dirname,"application"));
achieve.registerMethod("PATCH","servlets/registered.jss.cjs");

let server;
if (protocol === "http") server=achieve.listen(port);
else if (protocol === "https") server=achieve.slisten({
    httpsPort:port,
    key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
    cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem"))
});
else if (protocol === "http2") server=achieve.listen2(port);
else server=achieve.listen2({
    http2Port:port,
    key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
    cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem"))
});

let unhandled=[];
process.on("unhandledRejection",function (error) {
    unhandled.push("unhandledRejection: "+String(error && error.stack || error));
});
process.on("uncaughtException",function (error) {
    unhandled.push("uncaughtException: "+String(error && error.stack || error));
});

server.on("listening",function () {
    process.send({event:"ready",protocol:protocol});
});
process.on("message",function (message) {
    if (message === "state") process.send({event:"state",unhandled:unhandled});
    if (message === "stop") server.close(function () { process.exit(); });
});
