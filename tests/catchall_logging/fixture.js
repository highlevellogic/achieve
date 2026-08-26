const http=require("node:http");
const path=require("node:path");

const originalSetHeader=http.ServerResponse.prototype.setHeader;
let injected=false;
http.ServerResponse.prototype.setHeader=function (name,value) {
    if (this.req && this.req.url === "/unexpected" && !injected) {
        injected=true;
        throw new Error("injected catchall failure");
    }
    return originalSetHeader.call(this,name,value);
};

const achieve=require("../../achieve");
if (process.env.ACHIEVE_CATCHALL_LOGGING === "disabled") achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"application"));
const server=achieve.listen(Number(process.env.ACHIEVE_CATCHALL_PORT));

server.on("listening",function () {
    if (process.send) process.send({event:"ready"});
});
process.on("message",function (message) {
    if (message.command === "stop") server.close(function () { process.exit(); });
});