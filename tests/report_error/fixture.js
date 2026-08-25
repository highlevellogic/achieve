const Module=require("node:module");

let counting=false;
let moduleResolveCount=0;
const originalResolveFilename=Module._resolveFilename;
Module._resolveFilename=function (...args) {
    if (counting) moduleResolveCount++;
    return originalResolveFilename.apply(this,args);
};

const achieve=require("../../achieve");
achieve.setMode("production");
achieve.setLogging(false);
achieve.setAppPath(process.env.ACHIEVE_REPORT_ERROR_APP);
const server=achieve.listen(Number(process.env.ACHIEVE_REPORT_ERROR_PORT));
server.on("listening",function () { process.send({event:"ready"}); });

process.on("message",function (message) {
    if (message.command === "count-start") {
        moduleResolveCount=0;
        counting=true;
        process.send({event:"count-started"});
    } else if (message.command === "count-stop") {
        counting=false;
        process.send({event:"count",moduleResolveCount:moduleResolveCount});
    } else if (message.command === "stop") {
        counting=false;
        server.close(function () {
            process.exit();
        });
    }
});
