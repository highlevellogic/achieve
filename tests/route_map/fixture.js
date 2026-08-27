const fs=require("node:fs");
const path=require("node:path");

const routePath=path.join(__dirname,"routes.json");
const firstRoutePath=path.join(__dirname,"routes-first.json");
const realReadFileSync=fs.readFileSync;
let routeReads=0;
fs.readFileSync=function (filePath,...args) {
    const resolved=typeof filePath === "string" ? path.resolve(filePath) : "";
    if (resolved === routePath || resolved === firstRoutePath) routeReads++;
    return realReadFileSync.call(this,filePath,...args);
};

const achieve=require("../../achieve");
achieve.setLogging(false);
achieve.setMode(process.env.ACHIEVE_ROUTE_MODE || "development");
achieve.setAppPath(path.join(__dirname,"application"));
achieve.setRouteMap(firstRoutePath);
achieve.setRouteMap(routePath);
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
    if (process.send) process.send({event:"ready",routeReads:routeReads});
});
process.on("message",function (message) {
    if (message.command === "state") process.send({event:"state",routeReads:routeReads});
    if (message.command === "stop") server.close(function () { process.exit(); });
});