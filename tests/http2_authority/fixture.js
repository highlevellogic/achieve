const fs = require("fs");
const path = require("path");
const achieve = require("../../achieve");

const port = Number(process.env.ACHIEVE_HTTP2_AUTHORITY_PORT);
const secure = process.env.ACHIEVE_HTTP2_AUTHORITY_SECURE === "true";

achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"..","request_path","application"));

let server;
if (secure) {
    server = achieve.listen2({
        key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
        cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem")),
        http2Port:port
    });
} else {
    server = achieve.listen2(port);
}

if (!server) {
    if (process.send) process.send({type:"failure",message:"listener did not start"});
    process.exit(1);
}

server.once("listening",function () {
    const requestListener = server.listeners("request")[0];
    const req = {
        method:"GET",
        url:"/index.html",
        httpVersion:"2.0",
        headers:{":authority":"one.example",host:"one.example:80"},
        rawHeaders:[],
        socket:{remoteAddress:"direct-test"}
    };
    const res = {
        statusCode:200,
        destroyed:false,
        writableEnded:false,
        setHeader:function () {},
        end:function () {this.writableEnded=true;}
    };
    requestListener(req,res);
    if (process.send) {
        process.send({
            type:"ready",
            port:port,
            absentSchemeConflictStatus:res.statusCode
        });
    }
});

process.on("message",function (message) {
    if (message !== "shutdown") return;
    server.close(function (err) {
        if (process.send) {
            process.send({type:"stopped",error:err ? err.message : undefined});
            process.disconnect();
        }
    });
});
