const fs=require("node:fs");
const path=require("node:path");

const achieve=require("../../achieve");
achieve.setLogging(false);
achieve.setCaching(true);
achieve.setAppPath(path.join(__dirname,"application"));

const port=Number(process.env.ACHIEVE_RANGE_PORT);
const protocol=process.env.ACHIEVE_RANGE_PROTOCOL;
let server;
if (protocol === "http") {
    server=achieve.listen(port);
} else if (protocol === "https") {
    server=achieve.slisten({
        key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
        cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem")),
        httpsPort:port
    });
} else if (protocol === "http2") {
    server=achieve.listen2(port);
} else if (protocol === "http2s") {
    server=achieve.listen2({
        key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
        cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem")),
        http2Port:port
    });
} else {
    throw new Error("Unknown byte-range fixture protocol.");
}

server.on("listening",function () {
    if (process.send) process.send({event:"ready"});
});
process.on("message",function (message) {
    if (message.command === "stop") server.close(function () { process.exit(); });
});
