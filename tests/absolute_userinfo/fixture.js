const fs = require("fs");
const path = require("path");
const achieve = require("../../achieve");

const port = Number(process.env.ACHIEVE_ABSOLUTE_USERINFO_PORT);
const secure = process.env.ACHIEVE_ABSOLUTE_USERINFO_SECURE === "true";

achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"application"));

const server = secure
    ? achieve.slisten({
        key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
        cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem")),
        httpsPort:port
    })
    : achieve.listen(port);

if (!server) {
    if (process.send) process.send({type:"failure",message:"listener did not start"});
    process.exit(1);
}

server.once("listening",function () {
    if (process.send) process.send({type:"ready",port:port});
});

process.on("message",function (message) {
    if (message !== "shutdown") return;
    server.close(function (err) {
        if (process.send) {
            process.send({type:"stopped",error:err ? err.message : undefined});
            process.disconnect();
        }
    });
});
