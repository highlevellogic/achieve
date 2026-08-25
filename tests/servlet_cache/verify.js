const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");

const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-servlet-cache-"));
const appA=path.join(testRoot,"app-a");
const appB=path.join(testRoot,"app-b");
fs.mkdirSync(appA,{recursive:true});
fs.mkdirSync(appB,{recursive:true});

function servlet(value) {
    return "exports.servlet=function (context) { return "+JSON.stringify(value)+
        "+\":\"+(context.params.value || \"\"); };\n";
}
function write(filePath,content,future=false) {
    fs.writeFileSync(filePath,content);
    if (future) {
        const timestamp=new Date(Date.now()+2000);
        fs.utimesSync(filePath,timestamp,timestamp);
    }
}
const helloA=path.join(appA,"hello.jss");
const helloB=path.join(appB,"hello.jss");
write(helloA,servlet("A1"));
write(helloB,servlet("B"));
function assert(condition,message) {
    if (!condition) throw new Error(message);
}
function wait(child,event) {
    return new Promise((resolve,reject) => {
        const timer=setTimeout(function () {
            child.off("message",listener);
            reject(new Error("Timed out waiting for "+event));
        },10000);
        function listener(message) {
            if (message.event !== event) return;
            clearTimeout(timer);
            child.off("message",listener);
            resolve(message);
        }
        child.on("message",listener);
        child.once("exit",code => reject(new Error("Fixture exited before "+event+": "+code)));
    });
}
function request(port,target) {
    return new Promise((resolve,reject) => {
        http.get("http://127.0.0.1:"+port+target,res => {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()});
            });
        }).on("error",reject);
    });
}
async function command(child,name,event,value) {
    const result=wait(child,event);
    child.send(Object.assign({command:name},value));
    return result;
}
async function start(mode,appPath,port) {
    const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{silent:true,
        env:Object.assign({},process.env,{ACHIEVE_CACHE_MODE:mode,ACHIEVE_CACHE_APP:appPath,
            ACHIEVE_CACHE_PORT:String(port)})});
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    await wait(child,"ready");
    return child;
}
async function stop(child) {
    const exited=new Promise(resolve => child.once("exit",resolve));
    child.send({command:"stop"});
    await exited;
}

(async function () {
    let child;
    try {
        child=await start("production",appA,24400);

        let response=await request(24400,"/hello.jss?value=one");
        assert(response.status === 200 && response.body === "A1:one",
            "Initial production servlet resolution failed.");

        await command(child,"count-start","count-started",{});
        response=await request(24400,"/hello.jss?value=two");
        const steadyCounts=(await command(child,"count-stop","counts",{})).counts;
        assert(response.status === 200 && response.body === "A1:two",
            "Cached query request did not retain independent query data.");
        assert(steadyCounts.statSync === 0 && steadyCounts.existsSync === 0,
            "Cached production request performed servlet discovery: "+JSON.stringify(steadyCounts));

        await command(child,"count-start","count-started",{});
        response=await request(24400,"/x/../hello.jss?value=alias-one");
        assert(response.status === 200 && response.body === "A1:alias-one",
            "Dot-segment alias did not reuse the resolved servlet.");
        response=await request(24400,"//hello.jss?value=alias-two");
        assert(response.status === 200 && response.body === "A1:alias-two",
            "Repeated-slash alias did not reuse the resolved servlet.");
        const aliasCounts=(await command(child,"count-stop","counts",{})).counts;
        assert(aliasCounts.statSync === 0 && aliasCounts.existsSync === 0,
            "Servlet aliases performed duplicate discovery: "+JSON.stringify(aliasCounts));

        write(helloA,servlet("A2"),true);
        response=await request(24400,"/hello.jss?value=stable");
        assert(response.status === 200 && response.body === "A1:stable",
            "Production unexpectedly reloaded an edited cached servlet.");

        response=await request(24400,"/created.jss");
        assert(response.status === 404,"Missing servlet did not return 404.");
        write(path.join(appA,"created.jss"),servlet("CREATED"));
        response=await request(24400,"/created.jss?value=now");
        assert(response.status === 200 && response.body === "CREATED:now",
            "Missing servlet was negatively cached.");

        write(path.join(appA,"broken.jss"),"exports.servlet=function () {\n");
        response=await request(24400,"/broken.jss");
        assert(response.status === 500,"Broken servlet did not fail with 500.");
        write(path.join(appA,"broken.jss"),servlet("RECOVERED"));
        response=await request(24400,"/broken.jss?value=yes");
        assert(response.status === 200 && response.body === "RECOVERED:yes",
            "Failed servlet load was permanently cached.");

        await command(child,"set-app","app-set",{path:appB});
        response=await request(24400,"/hello.jss?value=switch");
        assert(response.status === 200 && response.body === "B:switch",
            "setAppPath() reused the previous application's servlet.");
        await stop(child);
        child=undefined;

        child=await start("production",appA,24401);
        response=await request(24401,"/hello.jss?value=restart");
        assert(response.status === 200 && response.body === "A2:restart",
            "New production server state did not discover the edited servlet.");
        await stop(child);
        child=undefined;

        child=await start("development",appA,24402);
        response=await request(24402,"/hello.jss?value=before");
        assert(response.status === 200 && response.body === "A2:before",
            "Development initial servlet request failed.");
        write(helloA,servlet("A3"),true);
        response=await request(24402,"/hello.jss?value=after");
        assert(response.status === 200 && response.body === "A3:after",
            "Development hot reload did not detect the servlet edit.");
        await stop(child);
        child=undefined;

        console.log("PASS servlet cache verification");
        console.log("STEADY_STATE_COUNTS "+JSON.stringify(steadyCounts));
        console.log("ALIAS_COUNTS "+JSON.stringify(aliasCounts));
    } finally {
        if (child && child.exitCode === null) await stop(child);
        fs.rmSync(testRoot,{recursive:true,force:true});
    }
}()).catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
