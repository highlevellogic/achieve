const fs=require("node:fs");
const path=require("node:path");
const paths=require("./paths.cjs");

const achieve=require("../../achieve");
if (process.env.ACHIEVE_PATH_LOGGING !== "true") achieve.setLogging(false);
achieve.setMode(process.env.ACHIEVE_PATH_MODE || "development");
achieve.setAppPath(path.join(__dirname,"application"));
achieve.setRouteMap({"/assets/exact.txt":"/exact/winner.txt"});
achieve.setPathMap({
    "/accumulated/":"/internal/assets/",
    "/replaced/":"/internal/docs/",
    "/docs/api/":"/internal/api/"
});
achieve.setPathMap(paths);
achieve.setPathMap({"/replaced/":"/internal/api/"});
try {
    achieve.setPathMap({"/partial/":"/internal/assets/","/invalid/":"../outside/"});
    throw new Error("Invalid path-map reconfiguration was accepted.");
} catch (error) {
    if (!/invalid mapped target/.test(error.message)) throw error;
}
if (process.env.ACHIEVE_PATH_SECOND_APP === "true") {
    achieve.setAppPath(path.join(__dirname,"application-two"));
}
achieve.allowOrigins("https://path-map.example","/public/","allowed.txt");
achieve.registerMethod("DELETE","servlets/delete.jss");

const port=Number(process.env.ACHIEVE_PATH_PORT);
const protocol=process.env.ACHIEVE_PATH_PROTOCOL;
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
    throw new Error("Unknown path-map fixture protocol.");
}

server.on("listening",function () {
    if (process.send) process.send({event:"ready"});
});
process.on("message",function (message) {
    if (message.command === "stop") server.close(function () { process.exit(); });
});
