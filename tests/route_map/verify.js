const assert=require("node:assert");
const childProcess=require("node:child_process");
const http=require("node:http");
const http2=require("node:http2");
const https=require("node:https");
const path=require("node:path");

let nextPort=19220;

function start(protocol,mode="development") {
    return new Promise(function (resolve,reject) {
        const port=nextPort++;
        const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
            silent:true,
            env:Object.assign({},process.env,{
                ACHIEVE_ROUTE_PROTOCOL:protocol,
                ACHIEVE_ROUTE_MODE:mode,
                ACHIEVE_ROUTE_PORT:String(port)
            })
        });
        let stdout="";
        let stderr="";
        child.stdout.on("data",data => stdout+=data);
        child.stderr.on("data",data => stderr+=data);
        child.on("message",function (message) {
            if (message.event === "ready") resolve({child,port,protocol,routeReads:message.routeReads,stdout:() => stdout,stderr:() => stderr});
        });
        child.once("exit",code => reject(new Error("Route-map fixture exited before readiness: "+code+"\n"+stdout+stderr)));
    });
}
function stop(testCase) {
    return new Promise(function (resolve) {
        if (testCase.child.exitCode !== null) return resolve();
        testCase.child.once("exit",resolve);
        testCase.child.send({command:"stop"});
    });
}
function state(testCase) {
    return new Promise(function (resolve) {
        function receive(message) {
            if (message.event !== "state") return;
            testCase.child.off("message",receive);
            resolve(message);
        }
        testCase.child.on("message",receive);
        testCase.child.send({command:"state"});
    });
}
function http1Request(testCase,options={}) {
    return new Promise(function (resolve,reject) {
        const client=testCase.protocol === "https" ? https : http;
        const request=client.request({
            host:"127.0.0.1",
            port:testCase.port,
            path:options.path || "/",
            method:options.method || "GET",
            headers:options.headers || {},
            rejectUnauthorized:false
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
        const headers=Object.assign({},options.headers || {},{
            ":path":options.path || "/",
            ":method":options.method || "GET"
        });
        const request=client.request(headers);
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
    return testCase.protocol.startsWith("http2")
      ? http2Request(testCase,options)
      : http1Request(testCase,options);
}
function json(response) {
    return JSON.parse(response.body.toString("utf8"));
}
async function commonProtocolChecks(testCase) {
    let response=await request(testCase,{path:"/static"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.toString(),"mapped static\n");

    response=await request(testCase,{path:"/static/extra"});
    assert.strictEqual(response.status,404);

    response=await request(testCase,{path:"/query?lang=en&value=one"});
    assert.strictEqual(response.status,200);
    assert.deepStrictEqual(json(response),{format:"jss",method:"GET",url:"/query?lang=en&value=one",params:{lang:"en",value:"one"}});

    response=await request(testCase,{path:"/cjs"});
    assert.strictEqual(json(response).format,"jss.cjs");
    response=await request(testCase,{path:"/esm"});
    assert.strictEqual(json(response).format,"jss.mjs");

    response=await request(testCase,{path:"/ordinary.txt"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.toString(),"ordinary fallback\n");

    response=await request(testCase,{path:"/missing"});
    assert.strictEqual(response.status,404);

    response=await request(testCase,{path:"/directory"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.toString(),"mapped directory default\n");

    response=await request(testCase,{path:"/video"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.toString(),"0123456789abcdefghijklmnopqrstuvwxyz");
    response=await request(testCase,{path:"/video",headers:{range:"bytes=5-11"}});
    assert.strictEqual(response.status,206);
    assert.strictEqual(response.headers["content-range"],"bytes 5-11/36");
    assert.strictEqual(response.body.toString(),"56789ab");

    response=await request(testCase,{path:"/static",method:"HEAD"});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.length,0);

    response=await request(testCase,{path:"/options",method:"OPTIONS"});
    assert.strictEqual(response.status,204);
    assert(response.headers.allow.includes("GET"));

    response=await request(testCase,{path:"/public/allowed",headers:{origin:"https://route-map.example"}});
    assert.strictEqual(response.status,200);
    assert.strictEqual(response.body.toString(),"internal denied\n");
    assert.strictEqual(response.headers["access-control-allow-origin"],"https://route-map.example");
    response=await request(testCase,{path:"/public/denied",headers:{origin:"https://route-map.example"}});
    assert.strictEqual(response.status,403);

    console.log("PASS route-map "+testCase.protocol+" static/servlet/modules/media/directory/fallback/CORS");
}
async function httpSpecificChecks(testCase) {
    let response=await request(testCase,{path:"/post?from=public",method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"value=body"});
    assert.strictEqual(response.status,200);
    assert.deepStrictEqual(json(response),{format:"jss",method:"POST",url:"/post?from=public",params:{value:"body"}});

    response=await request(testCase,{path:"/source-check"});
    assert.strictEqual(response.status,200);
    assert(!response.body.toString().includes("exports.servlet"));
    assert.strictEqual(json(response).url,"/source-check");

    response=await request(testCase,{path:"/protected-source"});
    assert.strictEqual(response.status,404);
    assert(!response.body.toString().includes("protected servlet source"));

    response=await request(testCase,{path:"/registered-target",method:"DELETE"});
    assert.deepStrictEqual(json(response),{handler:"DELETE",method:"DELETE",url:"/registered-target"});

    response=await request(testCase,{path:"/replaced"});
    assert.strictEqual(response.status,404);

    response=await request(testCase,{path:"/public/allowed",method:"OPTIONS",headers:{origin:"https://route-map.example","access-control-request-method":"GET"}});
    assert.strictEqual(response.status,204);
    assert(response.headers["access-control-allow-methods"].includes("GET"));

    const currentState=await state(testCase);
    assert.strictEqual(testCase.routeReads,2);
    assert.strictEqual(currentState.routeReads,2);
    console.log("PASS query/POST/source protection/registered method/reconfiguration/preflight/read-once behavior");
}
async function productionCacheChecks() {
    const testCase=await start("http","production");
    try {
        let first=await request(testCase,{path:"/alias-one?route=one"});
        let second=await request(testCase,{path:"/alias-two?route=two"});
        assert.strictEqual(first.status,200);
        assert.strictEqual(second.status,200);
        assert.strictEqual(json(first).url,"/alias-one?route=one");
        assert.deepStrictEqual(json(first).params,{route:"one"});
        assert.strictEqual(json(second).url,"/alias-two?route=two");
        assert.deepStrictEqual(json(second).params,{route:"two"});
        assert.strictEqual((await state(testCase)).routeReads,2);
        console.log("PASS production cache shares mapped servlet identity without request cross-talk");
    } finally {
        await stop(testCase);
    }
}

(async function () {
    for (const protocol of ["http","https","http2","http2s"]) {
        const testCase=await start(protocol);
        try {
            await commonProtocolChecks(testCase);
            if (protocol === "http") await httpSpecificChecks(testCase);
            assert.strictEqual(testCase.stderr(),"");
        } finally {
            await stop(testCase);
        }
    }
    await productionCacheChecks();
    console.log("All route-map request verification tests passed.");
}()).catch(function (error) {
    console.error(error);
    process.exitCode=1;
});