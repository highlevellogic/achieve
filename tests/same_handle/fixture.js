const fs=require("node:fs");
const path=require("node:path");
const originalOpenSync=fs.openSync;
const originalCloseSync=fs.closeSync;
const originalClose=fs.close;
const originalCreateReadStream=fs.createReadStream;
const liveDescriptors=new Set();
let openCount=0,closeCount=0,descriptorStreams=0,pathnameStreams=0,replacement;

fs.openSync=function (...args) {
    const fd=originalOpenSync.apply(this,args);
    liveDescriptors.add(fd); openCount++;
    return fd;
};
fs.closeSync=function (fd) {
    if (liveDescriptors.delete(fd)) closeCount++;
    return originalCloseSync.apply(this,arguments);
};
fs.close=function (fd,callback) {
    if (liveDescriptors.delete(fd)) closeCount++;
    return originalClose.call(this,fd,callback);
};
fs.createReadStream=function (filePath,options) {
    if (options && options.fd !== undefined) descriptorStreams++;
    else pathnameStreams++;
    if (replacement && path.resolve(String(filePath)) === replacement.target) {
        const current=replacement;
        replacement=undefined;
        fs.renameSync(current.target,current.oldPath);
        fs.renameSync(current.replacement,current.target);
        process.send({event:"replaced",target:current.target});
    }
    return originalCreateReadStream.apply(this,arguments);
};

const achieve=require("../../achieve");
achieve.setMode("production");
achieve.setLogging(false);
achieve.setAppPath(process.env.ACHIEVE_SAME_HANDLE_APP);
achieve.setCaching(true);
achieve.setCompress(true);
achieve.allowOrigins("https://allowed.example","/","static.txt");
const server=achieve.listen(Number(process.env.ACHIEVE_SAME_HANDLE_PORT));
server.on("listening",function () { process.send({event:"ready"}); });

function counts() {
    return {openCount,closeCount,liveDescriptors:liveDescriptors.size,descriptorStreams,pathnameStreams};
}
process.on("message",function (message) {
    if (message.command === "arm") {
        replacement={target:path.resolve(message.target),replacement:path.resolve(message.replacement),
            oldPath:path.resolve(message.oldPath)};
        process.send({event:"armed"});
    } else if (message.command === "reset-counts") {
        openCount=0; closeCount=0; descriptorStreams=0; pathnameStreams=0;
        process.send({event:"counts-reset"});
    } else if (message.command === "counts") {
        setTimeout(function () { process.send({event:"counts",counts:counts()}); },25);
    } else if (message.command === "stop") {
        server.close(function () { process.exit(); });
    }
});