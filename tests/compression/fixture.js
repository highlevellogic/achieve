const fs = require("node:fs");
const stream = require("node:stream");

const realCreateWriteStream = fs.createWriteStream;
const realRename = fs.rename;
const realUnlink = fs.unlink;
const realPipeline = stream.pipeline;

let holdCompression = false;
let heldWrites = [];
let failWriteOnce = false;
let failRenameOnce = false;
let starts = {gzip: 0, deflate: 0};

function send(message) {
    if (process.send) process.send(message);
}

class CompressionGate extends stream.Transform {
    _transform(chunk, encoding, callback) {
        if (!holdCompression) {
            this.push(chunk);
            callback();
            return;
        }
        heldWrites.push({gate: this, chunk: chunk, callback: callback});
    }
}

function releaseCompression() {
    holdCompression = false;
    let writes = heldWrites;
    heldWrites = [];
    for (let write of writes) {
        write.gate.push(write.chunk);
        write.callback();
    }
}

stream.pipeline = function (source, compressor, destination, callback) {
    let encoding = String(destination.path).includes(".gz.tmp-")
        ? "gzip"
        : "deflate";
    starts[encoding]++;
    send({event: "pipeline-start", encoding: encoding});
    return realPipeline(
        source,
        new CompressionGate(),
        compressor,
        destination,
        function (err) {
            callback(err);
            setImmediate(function () {
                send({event: "pipeline-done", encoding: encoding, error: Boolean(err)});
            });
        }
    );
};

fs.createWriteStream = function (...args) {
    let output = realCreateWriteStream.apply(fs,args);
    if (failWriteOnce && String(args[0]).includes(".tmp-")) {
        failWriteOnce = false;
        output.once("open",function () {
            let err = new Error("Forced compression output failure.");
            err.code = "EIO";
            output.destroy(err);
        });
    }
    return output;
};

fs.rename = function (oldPath,newPath,callback) {
    if (failRenameOnce && String(oldPath).includes(".tmp-")) {
        failRenameOnce = false;
        let err = new Error("Forced compression publication failure.");
        err.code = "EPERM";
        setImmediate(function () {
            callback(err);
            setImmediate(function () {
                send({event: "rename", path: newPath, error: true});
            });
        });
        return;
    }
    realRename.call(fs,oldPath,newPath,function (err) {
        callback(err);
        setImmediate(function () {
            send({event: "rename", path: newPath, error: Boolean(err)});
        });
    });
};

fs.unlink = function (target,callback) {
    realUnlink.call(fs,target,function (err) {
        callback(err);
        if (String(target).includes(".tmp-")) {
            setImmediate(function () {
                send({event: "temp-cleanup", path: target, error: Boolean(err && err.code !== "ENOENT")});
            });
        }
    });
};

const achieve = require("../../achieve");
const port = Number(process.env.ACHIEVE_COMPRESSION_PORT);

achieve.setMode("production");
achieve.setAppPath(process.env.ACHIEVE_COMPRESSION_APP);
achieve.setCaching(true);
achieve.setCompress(true);

const server = achieve.listen(port);
server.on("listening",function () {
    send({event: "ready", port: port});
});

process.on("message",function (message) {
    switch (message.command) {
        case "hold":
            holdCompression = true;
            send({event: "ack", command: message.command});
            break;
        case "release":
            releaseCompression();
            send({event: "ack", command: message.command});
            break;
        case "fail-write":
            failWriteOnce = true;
            send({event: "ack", command: message.command});
            break;
        case "fail-rename":
            failRenameOnce = true;
            send({event: "ack", command: message.command});
            break;
        case "state":
            send({event: "state", starts: starts});
            break;
        case "stop":
            server.close(function () {
                process.exit();
            });
            break;
    }
});
