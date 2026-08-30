const fs=require("node:fs");

let counting=false;
let counts={statSync:0,existsSync:0,openSync:0,fstatSync:0,createReadStream:0,
    discoveryStatSync:0,discoveryExistsSync:0,paths:[],discoveryPaths:[]};
for (const name of ["statSync","existsSync","openSync","fstatSync","createReadStream"]) {
    const original=fs[name];
    fs[name]=function (...args) {
        if (counting) {
            counts[name]++;
            counts.paths.push(name+":"+String(args[0]));
            if (new Error().stack.includes("at checkPath")) {
                if (name === "statSync") counts.discoveryStatSync++;
                if (name === "existsSync") counts.discoveryExistsSync++;
                counts.discoveryPaths.push(name+":"+String(args[0]));
            }
        }
        return original.apply(this,args);
    };
}

const achieve=require("../../achieve");
achieve.setMode("production");
achieve.setLogging(false);
achieve.setAppPath(process.env.ACHIEVE_STATIC_LOOKUP_APP);
achieve.setCaching(true);
achieve.setCompress(false);
const server=achieve.listen(Number(process.env.ACHIEVE_STATIC_LOOKUP_PORT));
server.on("listening",function () { process.send({event:"ready"}); });

process.on("message",function (message) {
    if (message.command === "count-start") {
        counts={statSync:0,existsSync:0,openSync:0,fstatSync:0,createReadStream:0,
            discoveryStatSync:0,discoveryExistsSync:0,paths:[],discoveryPaths:[]};
        counting=true;
        process.send({event:"count-started"});
    } else if (message.command === "count-stop") {
        counting=false;
        process.send({event:"counts",counts:counts});
    } else if (message.command === "stop") {
        counting=false;
        server.close(function () {
            process.exit();
        });
    }
});
