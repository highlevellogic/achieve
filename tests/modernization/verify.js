const fs = require("fs");
const http = require("http");
const http2 = require("http2");
const https = require("https");
const path = require("path");
const EventEmitter = require("events");

delete global.fs;
delete global.Base64;
delete global.stats;

const originalSetHeader = http.ServerResponse.prototype.setHeader;
const originalEnd = http.ServerResponse.prototype.end;
const originalWrite = http.ServerResponse.prototype.write;
let beforeHeadersInjected = false;
let afterHeadersInjected = false;
let afterHeadersWereSent = false;

http.ServerResponse.prototype.setHeader = function (name,value) {
    if (
        this.req &&
        this.req.url === "/unexpected-before" &&
        !beforeHeadersInjected
    ) {
        beforeHeadersInjected = true;
        throw new Error("injected failure before headers");
    }
    return originalSetHeader.call(this,name,value);
};

http.ServerResponse.prototype.end = function (...args) {
    if (
        this.req &&
        this.req.url === "/unexpected-after" &&
        !afterHeadersInjected
    ) {
        afterHeadersInjected = true;
        originalWrite.call(this,"partial");
        afterHeadersWereSent=this.headersSent;
        throw new Error("injected failure after headers");
    }
    return originalEnd.apply(this,args);
};

const achieve = require("../../achieve");
let failures = 0;

function check(name,actual,expected) {
    const passed = Array.isArray(expected)
        ? JSON.stringify(actual) === JSON.stringify(expected)
        : actual === expected;
    console.log((passed ? "PASS" : "FAIL") + " " + name + ": " + JSON.stringify(actual));
    if (!passed) {
        console.log("     expected: " + JSON.stringify(expected));
        failures++;
    }
}

function listening(server) {
    if (server.listening) return Promise.resolve();
    return new Promise(resolve => server.once("listening",resolve));
}

function request(port,requestPath) {
    return new Promise((resolve,reject) => {
        const req = http.request({port:port,path:requestPath},res => {
            let body="";
            let settled=false;
            res.setEncoding("utf8");
            res.on("data",chunk => body+=chunk);
            function finish(state) {
                if (settled) return;
                settled=true;
                resolve({state:state,status:res.statusCode,body:body,headers:res.headers});
            }
            res.on("end",() => finish("complete"));
            res.on("aborted",() => finish("aborted"));
            res.on("error",() => finish("error"));
        });
        req.setTimeout(3000,() => req.destroy(new Error("request timed out")));
        req.on("error",err => {
            if (requestPath === "/unexpected-after") {
                resolve({state:"error",status:undefined,body:"",error:err});
            } else {
                reject(err);
            }
        });
        req.end();
    });
}

function expectedETag(filePath,coding) {
    const stats=fs.statSync(filePath);
    const nodeVersion=process.versions.node.split(".").join("");
    const version=require("../../package.json").version;
    const rawValue=String(stats.mtimeMs)+":"+String(stats.size)+":"+nodeVersion+version;
    return '"'+Buffer.from(rawValue).toString("base64url")+'-'+coding+'"';
}

class FakeServer extends EventEmitter {
    constructor(record) {
        super();
        this.record=record;
        this.listening=false;
    }
    listen(port) {
        this.record.push(port);
        return this;
    }
}

(async function () {
    achieve.setLogging(false);
    achieve.setCaching(true);

    check("fs is module-local",Object.hasOwn(global,"fs"),false);
    check("Base64 is module-local",Object.hasOwn(global,"Base64"),false);

    const port=19240;
    const server=achieve.listen(port);
    if (!server) throw new Error("modernization verifier listener did not start");
    await listening(server);
    try {
        const normal=await request(port,"/resource.txt");
        check("default application status",normal.status,200);
        check("default application is entry-point directory",normal.body.trim(),"modernization default application");
        check("normal request completes",normal.state,"complete");
        check(
            "metadata ETag output uses current inputs",
            normal.headers.etag,
            expectedETag(path.join(__dirname,"resource.txt"),"i")
        );

        const loader=await request(port,"/servlets/loader.jss");
        check("helper loader status",loader.status,200);
        check("helper loader uses local stats",loader.body,"localized helper stats");
        check("helper loader did not create global stats",Object.hasOwn(global,"stats"),false);

        const before=await request(port,"/unexpected-before");
        check("unexpected pre-header failure status",before.status,500);
        check("unexpected pre-header failure body",before.body,"Internal Server Error");
        check("unexpected pre-header failure completes",before.state,"complete");

        const after=await request(port,"/unexpected-after");
        check("unexpected post-header failure began response",afterHeadersWereSent,true);
        check(
            "unexpected post-header failure terminates response",
            after.state === "aborted" || after.state === "error",
            true
        );
    } finally {
        await new Promise(resolve => server.close(resolve));
        http.ServerResponse.prototype.setHeader=originalSetHeader;
        http.ServerResponse.prototype.end=originalEnd;
    }

    check("stats is function-local after requests",Object.hasOwn(global,"stats"),false);


    const httpPorts=[];
    const httpsPorts=[];
    const http2Ports=[];
    const originalHttpCreateServer=http.createServer;
    const originalHttpsCreateServer=https.createServer;
    const originalHttp2CreateServer=http2.createServer;
    const originalHttp2CreateSecureServer=http2.createSecureServer;
    http.createServer=function () { return new FakeServer(httpPorts); };
    https.createServer=function () { return new FakeServer(httpsPorts); };
    http2.createServer=function () { return new FakeServer(http2Ports); };
    http2.createSecureServer=function () { return new FakeServer(http2Ports); };
    try {
        achieve.listen(19080);
        achieve.listen("19081");
        achieve.listen("abc");
        achieve.listen("");
        achieve.listen("1e4");
        achieve.listen("0x400");
        achieve.listen(49152);
        achieve.listen(1023);
        achieve.slisten({key:"test",cert:"test",httpsPort:"19082"});
        achieve.slisten({key:"test",cert:"test",httpsPort:"abc"});
        achieve.listen2("19083");
        achieve.listen2("abc");
    } finally {
        http.createServer=originalHttpCreateServer;
        https.createServer=originalHttpsCreateServer;
        http2.createServer=originalHttp2CreateServer;
        http2.createSecureServer=originalHttp2CreateSecureServer;
    }

    check("HTTP ports are numeric TCP ports",httpPorts,[19080,19081,80,80,80,80,80,80]);
    check("HTTPS numeric string and invalid fallback",httpsPorts,[19082,443]);
    check("HTTP2 numeric string and invalid fallback",http2Ports,[19083,80]);
    check("invalid ports never reach listen as strings",[
        ...httpPorts,...httpsPorts,...http2Ports
    ].every(value => typeof value === "number"),true);

    if (failures) process.exitCode=1;
})().catch(err => {
    console.error(err);
    process.exitCode=1;
});
