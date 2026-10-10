const fs=require("node:fs");

let counting=false;
let counts={statSync:0,existsSync:0,paths:[]};
for (const name of ["statSync","existsSync"]) {
    const original=fs[name];
    fs[name]=function (...args) {
        if (counting) {
            counts[name]++;
            counts.paths.push(name+":"+String(args[0]));
        }
        return original.apply(this,args);
    };
}

const achieve=require("../../achieve");
achieve.setMode(process.env.ACHIEVE_CACHE_MODE);
achieve.setLogging(false);
achieve.setAppPath(process.env.ACHIEVE_CACHE_APP);
const server=achieve.listen(Number(process.env.ACHIEVE_CACHE_PORT));
server.on("listening",function () { process.send({event:"ready"}); });

process.on("message",function (message) {
    if (message.command === "count-start") {
        counts={statSync:0,existsSync:0,paths:[]};
        counting=true;
        process.send({event:"count-started"});
    } else if (message.command === "count-stop") {
        counting=false;
        process.send({event:"counts",counts:counts});
    } else if (message.command === "set-app") {
        counting=false;
        achieve.setAppPath(message.path);
        process.send({event:"app-set"});
    } else if (message.command === "stop") {
        counting=false;
        server.close(function () { process.exit(); });
    }
});
