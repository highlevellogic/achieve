const fs=require("node:fs");
const path=require("node:path");

let counting=false;
let faultMode,retarget;
let counts={statSync:0,existsSync:0,realpathSyncNative:0,openSync:0,fstatSync:0,closeSync:0,createReadStream:0,
    discoveryStatSync:0,discoveryExistsSync:0,paths:[],discoveryPaths:[]};
for (const name of ["statSync","existsSync","openSync","fstatSync","closeSync","createReadStream"]) {
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
        if (faultMode === "open" && name === "openSync" && path.basename(String(args[0])) === "open-error.txt") {
            const error=new Error("static lookup open failure"); error.code="EACCES"; throw error;
        }
        if (faultMode === "fstat" && name === "fstatSync") {
            const error=new Error("static lookup fstat failure"); error.code="EIO"; throw error;
        }
        return original.apply(this,args);
    };
}
const originalRealpathNative=fs.realpathSync.native;
fs.realpathSync.native=function (...args) {
    if (counting) {
        counts.realpathSyncNative++;
        counts.paths.push("realpathSyncNative:"+String(args[0]));
    }
    const resolved=originalRealpathNative.apply(this,args);
    if (retarget && path.resolve(String(args[0])) === retarget.trigger) {
        const current=retarget; retarget=undefined;
        fs.unlinkSync(current.junction);
        fs.symlinkSync(current.outside,current.junction,process.platform === "win32" ? "junction" : "dir");
        process.send({event:"retargeted"});
    }
    return resolved;
};

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
        counts={statSync:0,existsSync:0,realpathSyncNative:0,openSync:0,fstatSync:0,closeSync:0,createReadStream:0,
            discoveryStatSync:0,discoveryExistsSync:0,paths:[],discoveryPaths:[]};
        counting=true;
        process.send({event:"count-started"});
    } else if (message.command === "count-stop") {
        counting=false;
        process.send({event:"counts",counts:counts});
    } else if (message.command === "fault") {
        faultMode=message.mode;
        process.send({event:"fault-armed"});
    } else if (message.command === "retarget") {
        retarget={
            trigger:path.resolve(message.trigger),
            junction:path.resolve(message.junction),
            outside:path.resolve(message.outside)
        };
        process.send({event:"retarget-armed"});
    } else if (message.command === "stop") {
        counting=false;
        server.close(function () {
            process.exit();
        });
    }
});
