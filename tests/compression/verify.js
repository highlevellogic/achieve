const childProcess = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

let failures = 0;
let applicationPath;
let fixture;
let messages = [];
let consoleOutput = [];
let consoleErrors = [];

function check(name,condition,detail) {
    console.log((condition ? "PASS" : "FAIL") + " " + name +
        (detail === undefined ? "" : ": " + detail));
    if (!condition) failures++;
}

function request(port,resource,encoding,headers={},method="GET") {
    return new Promise((resolve,reject) => {
        let req = http.request({
            port:port,
            path:resource,
            method:method,
            headers:Object.assign({"Accept-Encoding":encoding},headers)
        },res => {
            let chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",() => resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
        });
        req.on("error",reject);
        req.end();
    });
}

function waitForMessage(predicate,description,timeout=5000) {
    return new Promise((resolve,reject) => {
        let existing=messages.findIndex(predicate);
        if (existing !== -1) return resolve(messages.splice(existing,1)[0]);
        let timer=setTimeout(function () {
            fixture.off("message",listener);
            reject(new Error("Timed out waiting for " + description));
        },timeout);
        function listener(message) {
            if (!predicate(message)) return;
            clearTimeout(timer);
            fixture.off("message",listener);
            let index=messages.indexOf(message);
            if (index !== -1) messages.splice(index,1);
            resolve(message);
        }
        fixture.on("message",listener);
    });
}

async function command(command) {
    fixture.send({command:command});
    await waitForMessage(message => message.event === "ack" && message.command === command,command + " acknowledgement");
}

async function state() {
    fixture.send({command:"state"});
    return (await waitForMessage(message => message.event === "state","fixture state")).starts;
}

function setCurrent(artifactPath) {
    let future=new Date(Date.now()+2000);
    fs.utimesSync(artifactPath,future,future);
}

function setStale(sourcePath,artifactPath) {
    fs.utimesSync(artifactPath,new Date(Date.now()-4000),new Date(Date.now()-4000));
    fs.utimesSync(sourcePath,new Date(),new Date());
}

function tempFiles(directory) {
    if (!fs.existsSync(directory)) return [];
    let result=[];
    for (let entry of fs.readdirSync(directory,{withFileTypes:true})) {
        let entryPath=path.join(directory,entry.name);
        if (entry.isDirectory()) result.push(...tempFiles(entryPath));
        else if (entry.name.includes(".tmp-")) result.push(entryPath);
    }
    return result;
}

function unlinkIfExists(target) {
    if (fs.existsSync(target)) fs.unlinkSync(target);
}

async function startFixture() {
    const port=19032;
    fixture=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
        cwd:path.join(__dirname,"..",".."),
        env:Object.assign({},process.env,{
            ACHIEVE_COMPRESSION_PORT:String(port),
            ACHIEVE_COMPRESSION_APP:applicationPath
        }),
        silent:true
    });
    fixture.on("message",message => messages.push(message));
    fixture.stdout.on("data",data => {
        consoleOutput.push(String(data));
        process.stdout.write(data);
    });
    fixture.stderr.on("data",data => {
        consoleErrors.push(String(data));
        process.stderr.write(data);
    });
    await waitForMessage(message => message.event === "ready","fixture readiness");
    return port;
}

async function stopFixture() {
    if (!fixture || fixture.exitCode !== null) return;
    await new Promise(resolve => {
        let timer=setTimeout(function () { fixture.kill(); resolve(); },5000);
        fixture.once("exit",function () { clearTimeout(timer); resolve(); });
        fixture.send({command:"stop"});
    });
}

async function waitForRename(artifactPath,error,description) {
    await waitForMessage(message => message.event === "rename" && message.path === artifactPath && message.error === error,description);
}

async function run() {
    applicationPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-compression-"));
    const staticPath=path.join(applicationPath,"static");
    fs.mkdirSync(staticPath,{recursive:true});
    const sourcePath=path.join(staticPath,"resource.txt");
    const pingPath=path.join(staticPath,"ping.txt");
    const cachePath=path.join(applicationPath,".compression-cache");
    const cacheStaticPath=path.join(cachePath,"static");
    const gzipPath=path.join(cacheStaticPath,"resource.txt.gz");
    const deflatePath=path.join(cacheStaticPath,"resource.txt.zl");
    const original=Buffer.from("Achieve asynchronous compression fixture.\n".repeat(100));
    fs.writeFileSync(sourcePath,original);
    fs.writeFileSync(pingPath,"pong\n");
    fs.mkdirSync(cacheStaticPath,{recursive:true});
    fs.writeFileSync(gzipPath,zlib.gzipSync(original));
    setCurrent(gzipPath);
    fs.writeFileSync(deflatePath,zlib.deflateSync(original));
    setCurrent(deflatePath);

    const port=await startFixture();
    let result=await request(port,"/static/resource.txt","gzip");
    check("current gzip selected",result.status === 200 && result.headers["content-encoding"] === "gzip");
    check("current gzip exact source",zlib.gunzipSync(result.body).equals(original));
    check("current gzip ETag",/-g"$/.test(result.headers.etag),result.headers.etag);

    result=await request(port,"/static/resource.txt","deflate");
    check("current deflate selected",result.status === 200 && result.headers["content-encoding"] === "deflate");
    check("current deflate exact source",zlib.inflateSync(result.body).equals(original));
    check("current deflate ETag",/-d"$/.test(result.headers.etag),result.headers.etag);

    result=await request(port,"/static/resource.txt"," GZip ");
    check("whitespace and coding case",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","deflate, gzip");
    check("gzip wins equal-quality reverse list",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","gzip, deflate");
    check("gzip wins equal-quality forward list",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","gzip;q=1");
    check("explicit q=1",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","gzip;q=1.000");
    check("three-digit q=1",result.headers["content-encoding"] === "gzip");
    unlinkIfExists(gzipPath);
    let belowIdentityBefore=await state();
    result=await request(port,"/static/resource.txt","gzip;q=0.5");
    let belowIdentityAfter=await state();
    check("implicit identity outranks fractional gzip",result.headers["content-encoding"] === undefined && result.body.equals(original));
    check("fractional gzip below identity starts no generation",belowIdentityAfter.gzip === belowIdentityBefore.gzip,JSON.stringify({before:belowIdentityBefore,after:belowIdentityAfter}));
    check("fractional gzip below identity creates no artifact",!fs.existsSync(gzipPath));
    fs.writeFileSync(gzipPath,zlib.gzipSync(original));
    setCurrent(gzipPath);
    result=await request(port,"/static/resource.txt","gzip;q=0.");
    check("q=0 excludes gzip",result.headers["content-encoding"] === undefined && result.body.equals(original));
    result=await request(port,"/static/resource.txt","gzip;q=0.5, deflate;q=1");
    check("highest quality selects deflate",result.headers["content-encoding"] === "deflate");
    result=await request(port,"/static/resource.txt","*;q=0.5");
    check("implicit identity outranks fractional wildcard",result.headers["content-encoding"] === undefined);
    result=await request(port,"/static/resource.txt","*");
    check("gzip wins wildcard tie",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","gzip;q=0, *;q=1");
    check("explicit gzip exclusion overrides wildcard",result.headers["content-encoding"] === "deflate");
    result=await request(port,"/static/resource.txt","gzip;q=0.2, *;q=0.8, identity;q=0.5");
    check("explicit gzip quality overrides wildcard",result.headers["content-encoding"] === "deflate");
    result=await request(port,"/static/resource.txt","identity;q=0, *;q=1");
    check("explicit identity exclusion preserves compressed wildcard",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","*;q=0, identity;q=1");
    check("explicit identity overrides excluded wildcard",result.headers["content-encoding"] === undefined && result.body.equals(original));
    result=await request(port,"/static/resource.txt","gzip;q=0, gzip;q=1");
    check("duplicate coding retains highest quality",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","br, gzip");
    check("unsupported br does not hide gzip",result.headers["content-encoding"] === "gzip");
    result=await request(port,"/static/resource.txt","gzip;q=abc, deflate");
    check("malformed member ignored",result.headers["content-encoding"] === "deflate");
    result=await request(port,"/static/resource.txt","gzip;q=1.5, deflate");
    check("out-of-range q member ignored",result.headers["content-encoding"] === "deflate");
    result=await request(port,"/static/resource.txt","gzip;foo=bar, deflate");
    check("unsupported parameter member ignored",result.headers["content-encoding"] === "deflate");
    result=await request(port,"/static/resource.txt",", gzip,");
    check("empty list members ignored",result.headers["content-encoding"] === "gzip");
    unlinkIfExists(gzipPath);
    unlinkIfExists(deflatePath);
    let allExcludedBefore=await state();
    result=await request(port,"/static/resource.txt","gzip;q=0, deflate;q=0, identity;q=0");
    let allExcludedAfter=await state();
    check("all representations excluded",result.status === 406 && result.headers["content-encoding"] === undefined && result.headers.vary === "Accept-Encoding" && result.headers.etag === undefined && result.body.toString() === "No acceptable representation is available.");
    check("all representations excluded start no generation",allExcludedAfter.gzip === allExcludedBefore.gzip && allExcludedAfter.deflate === allExcludedBefore.deflate,JSON.stringify({before:allExcludedBefore,after:allExcludedAfter}));
    check("all representations excluded create no artifacts",!fs.existsSync(gzipPath) && !fs.existsSync(deflatePath));
    result=await request(port,"/static/resource.txt","gzip;q=0, deflate;q=0, identity;q=0",{},"HEAD");
    check("HEAD 406 suppresses body",result.status === 406 && result.headers.vary === "Accept-Encoding" && result.body.length === 0);
    fs.writeFileSync(gzipPath,zlib.gzipSync(original));
    setCurrent(gzipPath);
    fs.writeFileSync(deflatePath,zlib.deflateSync(original));
    setCurrent(deflatePath);

    let currentState=await state();
    check("current artifacts start no generation",currentState.gzip === 0 && currentState.deflate === 0,JSON.stringify(currentState));
    result=await request(port,"/.compression-cache/static/resource.txt.gz","gzip");
    let recursionState=await state();
    check("direct cache request remains available",result.status === 200 && result.headers["content-encoding"] === undefined && result.body.equals(fs.readFileSync(gzipPath)));
    check("direct cache request starts no recursive generation",recursionState.gzip === currentState.gzip && recursionState.deflate === currentState.deflate,JSON.stringify(recursionState));
    check("no recursive .compression-cache tree",!fs.existsSync(path.join(cachePath,".compression-cache")));
    check("source directory has no sibling artifacts",!fs.existsSync(sourcePath+".gz") && !fs.existsSync(sourcePath+".zl"));

    unlinkIfExists(gzipPath);
    await command("hold");
    let lowerBefore=await state();
    result=await request(port,"/static/resource.txt","gzip;q=1, deflate;q=0.8, identity;q=0.5");
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "gzip","preferred gzip generation start");
    let lowerAfter=await state();
    check("current lower-ranked deflate selected",result.status === 200 && result.headers["content-encoding"] === "deflate" && zlib.inflateSync(result.body).equals(original));
    check("only preferred missing encoding generated",lowerAfter.gzip-lowerBefore.gzip === 1 && lowerAfter.deflate-lowerBefore.deflate === 0,JSON.stringify({before:lowerBefore,after:lowerAfter}));
    await command("release");
    await waitForRename(gzipPath,false,"preferred gzip publication");

    fs.rmSync(cachePath,{recursive:true,force:true});
    await command("hold");
    result=await request(port,"/static/resource.txt","gzip");
    const identityTag=result.headers.etag;
    check("missing artifact returns identity",result.status === 200 && result.headers["content-encoding"] === undefined && result.body.equals(original));
    check("missing artifact identity ETag",/-i"$/.test(identityTag),identityTag);
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "gzip","missing gzip start");
    check("nested cache directory created in background",fs.existsSync(cacheStaticPath));
    check("no stable partial artifact",!fs.existsSync(gzipPath));
    let ping=await request(port,"/static/ping.txt","identity");
    check("event loop responsive while compression held",ping.status === 200 && ping.body.toString() === "pong\n");
    await command("release");
    await waitForRename(gzipPath,false,"missing gzip publication");
    check("background gzip artifact appears",fs.existsSync(gzipPath));
    check("nested source path mirrored in cache",gzipPath === path.join(applicationPath,".compression-cache","static","resource.txt.gz"));
    check("source remains free of sibling artifact",!fs.existsSync(sourcePath+".gz"));
    result=await request(port,"/static/resource.txt","gzip",{"If-None-Match":identityTag});
    check("later request selects gzip",result.status === 200 && result.headers["content-encoding"] === "gzip" && /-g"$/.test(result.headers.etag));

    unlinkIfExists(gzipPath);
    await command("hold");
    let forbiddenBefore=await state();
    result=await request(port,"/static/resource.txt","gzip, identity;q=0");
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "gzip","identity-forbidden gzip start");
    let forbiddenAfter=await state();
    check("missing compressed artifact with identity forbidden returns 406",result.status === 406 && result.headers.vary === "Accept-Encoding" && result.headers.etag === undefined && result.body.toString() === "No acceptable representation is available.");
    check("identity-forbidden miss schedules gzip",forbiddenAfter.gzip-forbiddenBefore.gzip === 1 && forbiddenAfter.deflate-forbiddenBefore.deflate === 0,JSON.stringify({before:forbiddenBefore,after:forbiddenAfter}));
    result=await request(port,"/static/resource.txt","gzip, identity;q=0",{},"HEAD");
    check("identity-forbidden HEAD returns bodyless 406",result.status === 406 && result.body.length === 0 && result.headers.vary === "Accept-Encoding");
    await command("release");
    await waitForRename(gzipPath,false,"identity-forbidden gzip publication");

    unlinkIfExists(gzipPath);
    await command("hold");
    let before=await state();
    let concurrent=await Promise.all(Array.from({length:20},() => request(port,"/static/resource.txt","gzip")));
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "gzip","concurrent gzip start");
    let after=await state();
    check("20 simultaneous misses return identity",concurrent.every(item => item.status === 200 && item.headers["content-encoding"] === undefined && item.body.equals(original)));
    check("20 simultaneous misses start one job",after.gzip-before.gzip === 1,after.gzip-before.gzip);
    await command("release");
    await waitForRename(gzipPath,false,"concurrent gzip publication");

    unlinkIfExists(gzipPath);
    unlinkIfExists(deflatePath);
    await command("hold");
    before=await state();
    let independent=await Promise.all([request(port,"/static/resource.txt","gzip"),request(port,"/static/resource.txt","deflate")]);
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "gzip","independent gzip start");
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "deflate","independent deflate start");
    after=await state();
    check("gzip and deflate misses return identity",independent.every(item => item.headers["content-encoding"] === undefined));
    check("gzip and deflate jobs independent",after.gzip-before.gzip === 1 && after.deflate-before.deflate === 1,JSON.stringify({before:before,after:after}));
    await command("release");
    await waitForRename(gzipPath,false,"independent gzip publication");
    await waitForRename(deflatePath,false,"independent deflate publication");

    const oldArtifact=Buffer.from("old stable gzip artifact");
    fs.writeFileSync(gzipPath,oldArtifact);
    setStale(sourcePath,gzipPath);
    await command("hold");
    result=await request(port,"/static/resource.txt","gzip");
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "gzip","stale gzip start");
    check("stale artifact returns identity",result.headers["content-encoding"] === undefined && result.body.equals(original));
    check("stale stable artifact untouched while held",fs.readFileSync(gzipPath).equals(oldArtifact));
    await command("release");
    await waitForRename(gzipPath,false,"stale gzip publication");

    unlinkIfExists(gzipPath);
    await command("hold");
    let outputBefore=consoleOutput.length;
    let errorsBefore=consoleErrors.length;
    result=await request(port,"/static/resource.txt","gzip");
    await waitForMessage(message => message.event === "pipeline-start" && message.encoding === "gzip","source-change gzip start");
    const changed=Buffer.concat([original,Buffer.from("changed\n")]);
    fs.writeFileSync(sourcePath,changed);
    let changedTime=new Date(Date.now()+2000);
    fs.utimesSync(sourcePath,changedTime,changedTime);
    await command("release");
    await waitForMessage(message => message.event === "temp-cleanup","source-change cleanup");
    check("source change does not publish obsolete artifact",!fs.existsSync(gzipPath));
    check("source change produces no server warning or error",
        consoleOutput.length === outputBefore && consoleErrors.length === errorsBefore,
        consoleOutput.slice(outputBefore).join("") + consoleErrors.slice(errorsBefore).join(""));

    await command("fail-write");
    errorsBefore=consoleErrors.length;
    result=await request(port,"/static/resource.txt","gzip");
    check("forced pipeline failure leaves identity successful",result.status === 200 && result.headers["content-encoding"] === undefined && result.body.equals(changed));
    await waitForMessage(message => message.event === "temp-cleanup","failed-write cleanup");
    check("failed temporary output cleaned",tempFiles(cachePath).length === 0,tempFiles(cachePath).join(","));
    check("pipeline failure logged",consoleErrors.length > errorsBefore);

    result=await request(port,"/static/resource.txt","gzip");
    check("retry after pipeline failure returns identity",result.status === 200 && result.headers["content-encoding"] === undefined);
    await waitForRename(gzipPath,false,"pipeline-failure retry publication");
    check("retry after pipeline failure publishes",fs.existsSync(gzipPath));

    fs.writeFileSync(gzipPath,oldArtifact);
    setStale(sourcePath,gzipPath);
    await command("fail-rename");
    result=await request(port,"/static/resource.txt","gzip");
    check("rename failure request remains identity",result.status === 200 && result.headers["content-encoding"] === undefined);
    await waitForRename(gzipPath,true,"forced rename failure");
    await waitForMessage(message => message.event === "temp-cleanup","rename-failure cleanup");
    check("failed replacement retains old stable artifact",fs.readFileSync(gzipPath).equals(oldArtifact));

    result=await request(port,"/static/resource.txt","gzip");
    check("retry after rename failure returns identity",result.status === 200 && result.headers["content-encoding"] === undefined);
    await waitForRename(gzipPath,false,"rename-failure retry publication");
    check("retry after rename failure publishes",zlib.gunzipSync(fs.readFileSync(gzipPath)).equals(changed));
    check("no orphan compression temporary files",tempFiles(cachePath).length === 0,tempFiles(cachePath).join(","));
    check("source tree remains free of compressed siblings",!fs.existsSync(sourcePath+".gz") && !fs.existsSync(sourcePath+".zl"));
}

(async function () {
    try {
        await run();
    } finally {
        await stopFixture();
        if (applicationPath) fs.rmSync(applicationPath,{recursive:true,force:true});
    }
    if (failures) {
        console.error(failures + " compression verification test(s) failed.");
        process.exitCode=1;
    } else {
        console.log("All compression artifact verification tests passed.");
    }
})().catch(err => {
    console.error(err);
    process.exitCode=1;
});
