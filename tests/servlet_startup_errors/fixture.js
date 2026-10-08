const http=require("node:http");
const originalSetHeader=http.ServerResponse.prototype.setHeader;

http.ServerResponse.prototype.setHeader=function (name,value) {
    const headerName=String(name).toLowerCase();
    const requestPath=this.req && this.req.url;
    if (headerName === "server") {
        if (requestPath === "/before-cjs.jss" || requestPath === "/before-esm.jss.mjs") {
            throw new Error("Injected startup failure for "+requestPath);
        }
        if (requestPath === "/after-headers.jss") {
            this.write("PARTIAL");
            throw new Error("Injected startup failure for "+requestPath);
        }
    }
    if (headerName === "content-type" && requestPath === "/after-completion.jss") {
        this.end("APPLICATION_COMPLETE");
        throw new Error("Injected startup failure for "+requestPath);
    }
    return originalSetHeader.call(this,name,value);
};

const achieve=require("../../achieve");
achieve.setAppPath(process.env.ACHIEVE_STARTUP_ERROR_APP);
achieve.setMode("production");
achieve.setLogPath(process.env.ACHIEVE_STARTUP_ERROR_LOGS);
achieve.setLogging("server");

const server=achieve.listen(Number(process.env.ACHIEVE_STARTUP_ERROR_PORT));
server.on("listening",function () {
    if (process.send) process.send({event:"ready"});
});
process.on("unhandledRejection",function (error) {
    if (process.send) process.send({event:"unhandledRejection",message:error && error.stack || String(error)});
});
process.on("message",function (message) {
    if (message.command === "stop") server.close(function () { process.exit(); });
});
