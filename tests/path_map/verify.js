const assert=require("node:assert");
const childProcess=require("node:child_process");
const http=require("node:http");
const http2=require("node:http2");
const https=require("node:https");
const path=require("node:path");

let nextPort=19320;

function start(protocol,mode="development",logging=false) {
    return new Promise(function (resolve,reject) {
        const port=nextPort++;
        const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
            silent:true,
            env:Object.assign({},process.env,{
                ACHIEVE_PATH_PROTOCOL:protocol,
                ACHIEVE_PATH_MODE:mode,
                ACHIEVE_PATH_PORT:String(port),
                ACHIEVE_PATH_LOGGING:String(logging)
            })
        });
        let stdout="";
        let stderr="";
        child.stdout.on("data",data => stdout+=data);
        child.stderr.on("data",data => stderr+=data);
        child.on("message",function (message) {
            if (message.event === "ready") resolve({child,port,protocol,stdout:() => stdout,stderr:() => stderr});
        });
        child.once("exit",code => reject(new Error("Path-map fixture exited before readiness: "+code+"\n"+stdout+stderr)));
    });
}
function stop(testCase) {
    return new Promise(function (resolve) {
        if (testCase.child.exitCode !== null) return resolve();
        testCase.child.once("exit",resolve);
        testCase.child.send({command:"stop"});
    });
}
function http1Request(testCase,options={}) {
    return new Promise(function (resolve,reject) {
        const client=testCase.protocol === "https" ? https : http;
        const request=client.request({
            host:"127.0.0.1",port:testCase.port,path:options.path || "/",
            method:options.method || "GET",headers:options.headers || {},rejectUnauthorized:false
        },function (response) {
            const chunks=[];
            response.on("data",chunk => chunks.push(chunk));
            response.on("end",function () {
                resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)});
            });
        });
        request.on("error",reject);
        if (options.body) request.write(options.body);
        request.end();
    });
}
function http2Request(testCase,options={}) {
    return new Promise(function (resolve,reject) {
        const secure=testCase.protocol === "http2s";
        const client=http2.connect((secure ? "https" : "http")+"://127.0.0.1:"+testCase.port,secure ? {rejectUnauthorized:false} : {});
        client.on("error",reject);
        const request=client.request(Object.assign({},options.headers || {},{
            ":path":options.path || "/",":method":options.method || "GET"
        }));
        const chunks=[];
        let responseHeaders;
        request.on("response",headers => responseHeaders=headers);
        request.on("data",chunk => chunks.push(chunk));
        request.on("end",function () {
            client.close();
            resolve({status:responseHeaders[":status"],headers:responseHeaders,body:Buffer.concat(chunks)});
        });
        request.on("error",function (error) { client.close(); reject(error); });
        if (options.body) request.write(options.body);
        request.end();
    });
}
function request(testCase,options) {
    return testCase.protocol.startsWith("http2") ? http2Request(testCase,options) : http1Request(testCase,options);
}
function json(response) {
    return JSON.parse(response.body.toString("utf8"));
}
async function protocolChecks(testCase) {
    let response=await request(testCase,{path:"/assets/file.txt"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.toString(),"mapped asset\n");

    response=await request(testCase,{path:"/assets/exact.txt"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.toString(),"exact wins\n");

    response=await request(testCase,{path:"/docs/api/result.txt"});
    assert.strictEqual(response.body.toString(),"longest prefix\n");
    response=await request(testCase,{path:"/manual/api/result.txt"});
    assert.strictEqual(response.body.toString(),"longest prefix\n");

    response=await request(testCase,{path:"/ordinary.txt"});
    assert.strictEqual(response.body.toString(),"ordinary fallback\n");
    response=await request(testCase,{path:"/source"});
    assert.strictEqual(response.body.toString(),"no slash fallback\n");
    response=await request(testCase,{path:"/source/"});
    assert.strictEqual(response.body.toString(),"mapped directory root\n");
    response=await request(testCase,{path:"/source-other/item.txt"});
    assert.strictEqual(response.body.toString(),"similar prefix fallback\n");

    response=await request(testCase,{path:"/mapped-servlets/identity.jss?from=public/path"});
    assert.deepStrictEqual(json(response),{format:"jss",method:"GET",url:"/mapped-servlets/identity.jss?from=public/path",params:{from:"public/path"}});
    response=await request(testCase,{path:"/mapped-servlets/common.jss.cjs"});
    assert.strictEqual(json(response).format,"jss.cjs");
    response=await request(testCase,{path:"/mapped-servlets/module.jss.mjs"});
    assert.strictEqual(json(response).format,"jss.mjs");

    response=await request(testCase,{path:"/mapped-directory/"});
    assert.strictEqual(response.body.toString(),"mapped directory default\n");
    response=await request(testCase,{path:"/mapped-media/sample.mp4",headers:{range:"bytes=4-9"}});
    assert.strictEqual(response.status,206);
    assert.strictEqual(response.headers["content-range"],"bytes 4-9/37");
    assert.strictEqual(response.body.toString(),"456789");

    response=await request(testCase,{path:"/encoded/name%2Fpart.txt?value=%23%20"});
    assert.strictEqual(response.body.toString(),"encoded path remains encoded\n");

    response=await request(testCase,{path:"/missing-tree/found.txt"});
    assert.strictEqual(response.status,404);

    response=await request(testCase,{path:"/public/allowed.txt",headers:{origin:"https://path-map.example"}});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.headers["access-control-allow-origin"],"https://path-map.example");
    response=await request(testCase,{path:"/public/denied.txt",headers:{origin:"https://path-map.example"}});
    assert.strictEqual(response.status,403);

    response=await request(testCase,{path:"/public/allowed.txt",method:"OPTIONS",headers:{origin:"https://path-map.example","access-control-request-method":"GET"}});
    assert.strictEqual(response.status,204);
    assert(response.headers["access-control-allow-methods"].includes("GET"));

    response=await request(testCase,{path:"/registered-target/file.txt",method:"DELETE"});
    assert.deepStrictEqual(json(response),{handler:"DELETE",method:"DELETE",url:"/registered-target/file.txt"});

    response=await request(testCase,{path:"/assets/file.txt",method:"HEAD"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.length,0);

    response=await request(testCase,{path:"/mapped-servlets/identity.jss?post=query",method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"value=body"});
    assert.deepStrictEqual(json(response),{format:"jss",method:"POST",url:"/mapped-servlets/identity.jss?post=query",params:{value:"body"}});

    assert.strictEqual(testCase.stderr(),"");
    console.log("PASS path-map "+testCase.protocol+" mapping/precedence/resources/CORS/OPTIONS/registered isolation");
}
async function startupReportingCheck() {
    const testCase=await start("http","development",true);
    try {
        assert.match(testCase.stdout(),/Path mappings: \/assets\/ -> \/internal\/assets\//);
        assert.match(testCase.stdout(),/Route mappings: \/assets\/exact\.txt -> \/exact\/winner\.txt/);
        console.log("PASS distinct route/path startup reporting");
    } finally {
        await stop(testCase);
    }
}

(async function () {
    require("./validation.js");
    for (const protocol of ["http","https","http2","http2s"]) {
        const testCase=await start(protocol);
        try {
            await protocolChecks(testCase);
        } finally {
            await stop(testCase);
        }
    }
    await startupReportingCheck();
    console.log("All path-map verification tests passed.");
}()).catch(function (error) {
    console.error(error);
    process.exitCode=1;
});
