const assert=require("node:assert");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");

const port=19430;
const temporaryRoot=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-physical-containment-"));
const applicationPath=path.join(temporaryRoot,"application");
const outsidePath=path.join(temporaryRoot,"outside");
const insideTargetPath=path.join(applicationPath,"inside-target");
let child;
let failures=0;
let skips=0;

function check(name,condition,detail) {
    console.log((condition ? "PASS" : "FAIL")+" "+name+
        (detail === undefined ? "" : ": "+detail));
    if (!condition) failures++;
}

function skip(name,error) {
    skips++;
    console.log("SKIP "+name+": "+error.code+" "+error.message);
}

function linkCapabilityError(error) {
    return new Set(["EPERM","EACCES","ENOTSUP","EOPNOTSUPP","ENOSYS"]).has(error.code);
}

function makeLink(name,target,type) {
    try {
        fs.symlinkSync(target,path.join(applicationPath,name),type);
        return true;
    } catch (error) {
        if (!linkCapabilityError(error)) throw error;
        skip(name+" link creation",error);
        return false;
    }
}

function request(requestPath,method="GET") {
    return new Promise(function (resolve,reject) {
        const req=http.request({host:"127.0.0.1",port,path:requestPath,method},function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString("utf8")});
            });
        });
        req.on("error",reject);
        req.end();
    });
}

function start() {
    return new Promise(function (resolve,reject) {
        child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
            silent:true,
            env:Object.assign({},process.env,{
                ACHIEVE_CONTAINMENT_APP:applicationPath,
                ACHIEVE_CONTAINMENT_PORT:String(port)
            })
        });
        let stdout="";
        let stderr="";
        child.stdout.on("data",data => stdout+=data);
        child.stderr.on("data",data => stderr+=data);
        child.on("message",function (message) {
            if (message.event === "ready") resolve();
        });
        child.once("exit",code => reject(new Error("Containment fixture exited before readiness: "+code+"\n"+stdout+stderr)));
    });
}

function stop() {
    return new Promise(function (resolve) {
        if (!child || child.exitCode !== null) return resolve();
        child.once("exit",resolve);
        child.send({command:"stop"});
    });
}

function rejected(name,response,secret) {
    check(name,response.status === 404 && !response.body.includes(secret),
        response.status+" "+JSON.stringify(response.body));
}

async function outsideDirectoryChecks() {
    let response=await request("/outside-tree/outside-static.txt");
    rejected("direct outside static through directory link",response,"OUTSIDE_STATIC");

    response=await request("/outside-tree/outside-media.mp3");
    rejected("direct outside media through directory link",response,"OUTSIDE_MEDIA");

    response=await request("/outside-tree/outside-servlet.jss");
    rejected("direct outside servlet through directory link",response,"OUTSIDE_EXECUTED");

    response=await request("/outside-tree/outside-servlet.jss.mjs");
    rejected("direct outside ESM servlet through directory link",response,"OUTSIDE_ESM_EXECUTED");

    response=await request("/outside-default-static/");
    rejected("outside static directory default through directory link",response,"OUTSIDE_DEFAULT_STATIC");

    response=await request("/outside-default-servlet/");
    rejected("outside servlet directory default through directory link",response,"OUTSIDE_DEFAULT_EXECUTED");

    response=await request("/exact-outside-static");
    rejected("exact route cannot expose outside static",response,"OUTSIDE_STATIC");

    response=await request("/exact-outside-servlet");
    rejected("exact route cannot execute outside servlet",response,"OUTSIDE_EXECUTED");

    response=await request("/exact-outside-esm");
    rejected("exact route cannot execute outside ESM servlet",response,"OUTSIDE_ESM_EXECUTED");

    response=await request("/outside-mapped/outside-static.txt");
    rejected("subtree route cannot expose outside static",response,"OUTSIDE_STATIC");

    response=await request("/outside-mapped/outside-servlet.jss");
    rejected("subtree route cannot execute outside servlet",response,"OUTSIDE_EXECUTED");

    response=await request("/outside-mapped/outside-servlet.jss.mjs");
    rejected("subtree route cannot execute outside ESM servlet",response,"OUTSIDE_ESM_EXECUTED");

    response=await request("/registered-outside","DELETE");
    check("registered method cannot execute outside servlet",
        response.status === 500 && !response.body.includes("OUTSIDE_EXECUTED"),
        response.status+" "+JSON.stringify(response.body));
}

async function insideDirectoryChecks() {
    let response=await request("/inside-tree/inside-static.txt");
    check("inside directory link serves static",response.status === 200 && response.body === "INSIDE_STATIC");

    response=await request("/inside-tree/inside-media.mp3");
    check("inside directory link serves media",response.status === 200 && response.body === "INSIDE_MEDIA");

    response=await request("/inside-tree/inside-servlet.jss");
    check("inside directory link executes servlet",response.status === 200 && response.body === "INSIDE_EXECUTED");

    response=await request("/inside-tree/inside-servlet.jss.mjs");
    check("inside directory link executes ESM servlet",response.status === 200 && response.body === "INSIDE_ESM_EXECUTED");

    response=await request("/inside-tree/");
    check("inside directory link selects default",response.status === 200 && response.body === "INSIDE_DEFAULT");

    response=await request("/exact-inside-static");
    check("exact route permits contained directory link",response.status === 200 && response.body === "INSIDE_STATIC");

    response=await request("/exact-inside-servlet");
    check("exact route executes contained linked servlet",response.status === 200 && response.body === "INSIDE_EXECUTED");

    response=await request("/exact-inside-esm");
    check("exact route executes contained linked ESM servlet",response.status === 200 && response.body === "INSIDE_ESM_EXECUTED");

    response=await request("/inside-mapped/inside-static.txt");
    check("subtree route permits contained directory link",response.status === 200 && response.body === "INSIDE_STATIC");

    response=await request("/registered-inside","PATCH");
    check("registered method executes contained linked servlet",response.status === 200 && response.body === "INSIDE_EXECUTED");
}

async function fileLinkChecks(created) {
    if (created.outsideStatic) {
        rejected("outside static file link",await request("/outside-static-link.txt"),"OUTSIDE_STATIC");
    }
    if (created.outsideServlet) {
        rejected("outside servlet file link",await request("/outside-servlet-link.jss"),"OUTSIDE_EXECUTED");
    }
    if (created.outsideSourceAlias) {
        rejected("outside servlet source cannot use non-servlet alias",
            await request("/outside-source-alias.txt"),"exports.servlet");
    }
    if (created.insideStatic) {
        let response=await request("/inside-static-link.txt");
        check("contained static file link is served",response.status === 200 && response.body === "INSIDE_STATIC");
    }
    if (created.insideServlet) {
        let response=await request("/inside-servlet-link.jss");
        check("contained servlet file link is executed",response.status === 200 && response.body === "INSIDE_EXECUTED");
    }
    if (created.insideSourceAlias) {
        rejected("contained servlet source cannot use non-servlet alias",
            await request("/inside-source-alias.txt"),"exports.servlet");
    }
}

(async function () {
    fs.mkdirSync(applicationPath);
    fs.mkdirSync(outsidePath);
    fs.mkdirSync(insideTargetPath);
    fs.writeFileSync(path.join(outsidePath,"outside-static.txt"),"OUTSIDE_STATIC");
    fs.writeFileSync(path.join(outsidePath,"outside-media.mp3"),"OUTSIDE_MEDIA");
    fs.writeFileSync(path.join(outsidePath,"outside-servlet.jss"),
        "exports.servlet=function () { return 'OUTSIDE_EXECUTED'; };\n");
    fs.writeFileSync(path.join(outsidePath,"outside-servlet.jss.mjs"),
        "export function servlet() { return 'OUTSIDE_ESM_EXECUTED'; }\n");
    fs.mkdirSync(path.join(outsidePath,"default-static"));
    fs.writeFileSync(path.join(outsidePath,"default-static","index.html"),"OUTSIDE_DEFAULT_STATIC");
    fs.mkdirSync(path.join(outsidePath,"default-servlet"));
    fs.writeFileSync(path.join(outsidePath,"default-servlet","index.jss"),
        "exports.servlet=function () { return 'OUTSIDE_DEFAULT_EXECUTED'; };\n");

    fs.writeFileSync(path.join(insideTargetPath,"inside-static.txt"),"INSIDE_STATIC");
    fs.writeFileSync(path.join(insideTargetPath,"inside-media.mp3"),"INSIDE_MEDIA");
    fs.writeFileSync(path.join(insideTargetPath,"inside-servlet.jss"),
        "exports.servlet=function () { return 'INSIDE_EXECUTED'; };\n");
    fs.writeFileSync(path.join(insideTargetPath,"inside-servlet.jss.mjs"),
        "export function servlet() { return 'INSIDE_ESM_EXECUTED'; }\n");
    fs.writeFileSync(path.join(insideTargetPath,"index.html"),"INSIDE_DEFAULT");

    const directoryType=process.platform === "win32" ? "junction" : "dir";
    const directoryLinks={
        outside:makeLink("outside-tree",outsidePath,directoryType),
        outsideDefaultStatic:makeLink("outside-default-static",path.join(outsidePath,"default-static"),directoryType),
        outsideDefaultServlet:makeLink("outside-default-servlet",path.join(outsidePath,"default-servlet"),directoryType),
        inside:makeLink("inside-tree",insideTargetPath,directoryType)
    };
    const fileLinks={
        outsideStatic:makeLink("outside-static-link.txt",path.join(outsidePath,"outside-static.txt"),"file"),
        outsideServlet:makeLink("outside-servlet-link.jss",path.join(outsidePath,"outside-servlet.jss"),"file"),
        outsideSourceAlias:makeLink("outside-source-alias.txt",path.join(outsidePath,"outside-servlet.jss"),"file"),
        insideStatic:makeLink("inside-static-link.txt",path.join(insideTargetPath,"inside-static.txt"),"file"),
        insideServlet:makeLink("inside-servlet-link.jss",path.join(insideTargetPath,"inside-servlet.jss"),"file"),
        insideSourceAlias:makeLink("inside-source-alias.txt",path.join(insideTargetPath,"inside-servlet.jss"),"file")
    };

    await start();
    if (directoryLinks.outside && directoryLinks.outsideDefaultStatic && directoryLinks.outsideDefaultServlet) {
        await outsideDirectoryChecks();
    }
    if (directoryLinks.inside) await insideDirectoryChecks();
    await fileLinkChecks(fileLinks);
})().catch(function (error) {
    failures++;
    console.error(error.stack || error);
}).finally(async function () {
    await stop();
    const resolvedRoot=path.resolve(temporaryRoot);
    const temporaryBoundary=path.resolve(os.tmpdir())+path.sep;
    if (!resolvedRoot.startsWith(temporaryBoundary) ||
        !path.basename(resolvedRoot).startsWith("achieve-physical-containment-")) {
        failures++;
        console.error("Refusing to remove unexpected temporary path: "+resolvedRoot);
    } else {
        fs.rmSync(resolvedRoot,{recursive:true,force:true});
    }
    console.log("Physical-containment verification: "+failures+" failure(s), "+skips+" skip(s).");
    process.exitCode=failures ? 1 : 0;
});
