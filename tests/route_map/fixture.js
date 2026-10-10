const fs=require("node:fs");
const path=require("node:path");
const routes=require("./routes.cjs");

const achieve=require("../../achieve");
achieve.setLogging(false);
achieve.setMode(process.env.ACHIEVE_ROUTE_MODE || "development");
achieve.setAppPath(path.join(__dirname,"application"));
achieve.setRouteMap({
    "/accumulated":"/internal/allowed.txt",
    "/replaced":"/internal/allowed.txt",
    "/precedence/allowed.txt":"/mapped/static.txt"
});
achieve.setRouteMap(routes);
achieve.setRouteMap({"/replaced":"/internal/denied.txt"});
achieve.setPathMap({"/precedence/":"/internal/"});
try {
    achieve.setRouteMap({"/partial":"/mapped/static.txt","/invalid":"../outside.txt"});
    throw new Error("Invalid route-map reconfiguration was accepted.");
} catch (error) {
    if (!/invalid mapped target/.test(error.message)) throw error;
}
if (process.env.ACHIEVE_ROUTE_SECOND_APP === "true") {
    achieve.setAppPath(path.join(__dirname,"application-two"));
}
achieve.allowOrigins("https://route-map.example","/public/","allowed");
achieve.registerMethod("DELETE","servlets/delete.jss");

const port=Number(process.env.ACHIEVE_ROUTE_PORT);
const protocol=process.env.ACHIEVE_ROUTE_PROTOCOL;
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
    throw new Error("Unknown route-map fixture protocol.");
}

server.on("listening",function () {
    if (process.send) process.send({event:"ready"});
});
process.on("message",function (message) {
    if (message.command === "stop") server.close(function () { process.exit(); });
});
