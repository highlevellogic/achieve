const assert=require("node:assert");
const childProcess=require("node:child_process");
const http=require("node:http");
const http2=require("node:http2");
const https=require("node:https");
const net=require("node:net");
const path=require("node:path");
const tls=require("node:tls");

let nextPort=19450;
const delay=milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));

function start(protocol) {
    return new Promise(function (resolve,reject) {
        const port=nextPort++;
        const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
            silent:true,
            env:Object.assign({},process.env,{
                ACHIEVE_BUFFERED_ABORT_PORT:String(port),
                ACHIEVE_BUFFERED_ABORT_PROTOCOL:protocol
            })
        });
        const events=[];
        let output="";
        child.stdout.on("data",data => output+=data);
        child.stderr.on("data",data => output+=data);
        child.on("message",function (message) {
            events.push(message);
            if (message.event === "ready") resolve({child,events,output:() => output,port,protocol});
        });
        child.once("exit",code => reject(new Error("Buffered-abort fixture exited before readiness: "+code+"\n"+output)));
    });
}

function stop(testCase) {
    return new Promise(function (resolve) {
        if (testCase.child.exitCode !== null) return resolve();
        testCase.child.once("exit",resolve);
        testCase.child.send({command:"stop"});
    });
}

function invocationCount(testCase) {
    return testCase.events.filter(event => event.event === "invoked").length;
}

function http1Request(testCase,body,contentType) {
    return new Promise(function (resolve,reject) {
        const client=testCase.protocol === "https" ? https : http;
        const request=client.request({
            host:"127.0.0.1",
            port:testCase.port,
            path:"/servlets/echo.jss",
            method:"POST",
            headers:{"Content-Type":contentType,"Content-Length":Buffer.byteLength(body)},
            rejectUnauthorized:false
        },function (response) {
            const chunks=[];
            response.on("data",chunk => chunks.push(chunk));
            response.on("end",function () {
                resolve({status:response.statusCode,body:Buffer.concat(chunks).toString()});
            });
        });
        request.on("error",reject);
        request.end(body);
    });
}

function rawAbort(testCase,options) {
    return new Promise(function (resolve) {
        let resolved=false;
        const finish=function () {
            if (resolved) return;
            resolved=true;
            resolve();
        };
        const connected=function () {
            const chunked=options.chunked;
            socket.write(
                "POST /servlets/echo.jss HTTP/1.1\r\n"+
                "Host: 127.0.0.1:"+testCase.port+"\r\n"+
                "Content-Type: "+options.contentType+"\r\n"+
                (chunked ? "Transfer-Encoding: chunked\r\n" : "Content-Length: "+options.declaredLength+"\r\n")+
                "\r\n"
            );
            const chunks=options.chunks || [];
            chunks.forEach(function (chunk,index) {
                setTimeout(function () {
                    if (socket.destroyed) return;
                    socket.write(chunked ? Buffer.byteLength(chunk).toString(16)+"\r\n"+chunk+"\r\n" : chunk);
                    if (index === chunks.length-1) {
                        setTimeout(function () {
                            if (options.destroy) socket.destroy();
                            else socket.end();
                        },10);
                    }
                },index*10);
            });
            if (chunks.length === 0) setTimeout(() => socket.destroy(),10);
        };
        const socket=testCase.protocol === "https"
            ? tls.connect({host:"127.0.0.1",port:testCase.port,rejectUnauthorized:false},connected)
            : net.connect(testCase.port,"127.0.0.1",connected);
        socket.on("error",function () {});
        socket.on("close",finish);
        setTimeout(function () { socket.destroy(); finish(); },500);
    });
}

function createHttp2Client(testCase) {
    const secure=testCase.protocol === "http2s";
    return http2.connect((secure ? "https" : "http")+"://127.0.0.1:"+testCase.port,
        secure ? {rejectUnauthorized:false} : {});
}

function http2Request(client,body,contentType) {
    return new Promise(function (resolve,reject) {
        const request=client.request({
            ":method":"POST",
            ":path":"/servlets/echo.jss",
            "content-type":contentType,
            "content-length":String(Buffer.byteLength(body))
        });
        let status;
        const chunks=[];
        request.on("response",headers => status=headers[":status"]);
        request.on("data",chunk => chunks.push(chunk));
        request.on("end",() => resolve({status,body:Buffer.concat(chunks).toString()}));
        request.on("error",reject);
        request.end(body);
    });
}

async function verifySuccessfulPosts(testCase,client) {
    const before=invocationCount(testCase);
    const form=client
        ? await http2Request(client,"x=form","application/x-www-form-urlencoded")
        : await http1Request(testCase,"x=form","application/x-www-form-urlencoded");
    assert.strictEqual(form.status,200);
    assert.deepStrictEqual(JSON.parse(form.body),{x:"form"});
    const json=client
        ? await http2Request(client,'{"x":"json"}',"application/json")
        : await http1Request(testCase,'{"x":"json"}',"application/json");
    assert.strictEqual(json.status,200);
    assert.deepStrictEqual(JSON.parse(json.body),{x:"json"});
    await delay(20);
    assert.strictEqual(invocationCount(testCase),before+2,"successful POST invocation count");
}

async function assertHealthy(testCase,client,label) {
    const before=invocationCount(testCase);
    const response=client
        ? await http2Request(client,"x=healthy","application/x-www-form-urlencoded")
        : await http1Request(testCase,"x=healthy","application/x-www-form-urlencoded");
    assert.strictEqual(response.status,200,label+" next status");
    assert.deepStrictEqual(JSON.parse(response.body),{x:"healthy"},label+" next body");
    await delay(20);
    assert.strictEqual(invocationCount(testCase),before+1,label+" next invocation");
}

async function http1AbortChecks(testCase) {
    const cases=[
        ["incomplete Content-Length",{contentType:"application/x-www-form-urlencoded",declaredLength:20,chunks:["x=partial"]}],
        ["incomplete chunked",{contentType:"application/x-www-form-urlencoded",chunked:true,chunks:["x=partial"]}],
        ["explicit abort",{contentType:"application/x-www-form-urlencoded",declaredLength:20,chunks:["x=partial"],destroy:true}],
        ["abort before data",{contentType:"application/x-www-form-urlencoded",declaredLength:20,chunks:[],destroy:true}],
        ["abort after multiple chunks",{contentType:"application/x-www-form-urlencoded",declaredLength:30,chunks:["x=par","tial"],destroy:true}],
        ["independently valid truncated JSON",{contentType:"application/json",declaredLength:30,chunks:['{"x":true}']}],
        ["invalid truncated JSON",{contentType:"application/json",declaredLength:30,chunks:["{"]}],
        ["abort near input limit",{contentType:"application/x-www-form-urlencoded",declaredLength:200,chunks:["x="+"a".repeat(125)],destroy:true}]
    ];
    for (const [label,options] of cases) {
        const before=invocationCount(testCase);
        await rawAbort(testCase,options);
        await delay(50);
        assert.strictEqual(invocationCount(testCase),before,label+" servlet invocation");
        await assertHealthy(testCase,null,label);
    }
}

async function http2Abort(client,body,contentType) {
    let responseAttempted=false;
    const bodyLength=Array.isArray(body)
        ? body.reduce((total,chunk) => total+Buffer.byteLength(chunk),0)
        : Buffer.byteLength(body);
    const request=client.request({
        ":method":"POST",
        ":path":"/servlets/echo.jss",
        "content-type":contentType,
        "content-length":String(Math.max(bodyLength+20,30))
    });
    request.on("response",() => responseAttempted=true);
    request.on("error",function () {});
    if (Array.isArray(body)) {
        for (const chunk of body) {
            request.write(chunk);
            await delay(10);
        }
    } else if (body) {
        request.write(body);
    }
    request.close(http2.constants.NGHTTP2_CANCEL);
    await delay(60);
    return responseAttempted;
}

async function http2AbortChecks(testCase,client) {
    const cases=[
        ["form reset","x=partial","application/x-www-form-urlencoded"],
        ["reset before data","","application/x-www-form-urlencoded"],
        ["reset after multiple chunks",["x=par","tial"],"application/x-www-form-urlencoded"],
        ["independently valid JSON reset",'{"x":true}',"application/json"],
        ["invalid JSON reset","{","application/json"],
        ["reset near input limit","x="+"a".repeat(125),"application/x-www-form-urlencoded"]
    ];
    for (const [label,body,contentType] of cases) {
        const before=invocationCount(testCase);
        const responseAttempted=await http2Abort(client,body,contentType);
        assert.strictEqual(responseAttempted,false,label+" response attempted");
        assert.strictEqual(invocationCount(testCase),before,label+" servlet invocation");
        await assertHealthy(testCase,client,label);
    }
}

async function payloadTooLarge(testCase,client) {
    const before=invocationCount(testCase);
    const first="x="+"z".repeat(138);
    const remainder="z".repeat(160);
    const response=await new Promise(function (resolve,reject) {
        let request;
        let status;
        const chunks=[];
        if (client) {
            request=client.request({
                ":method":"POST",
                ":path":"/servlets/echo.jss",
                "content-type":"application/x-www-form-urlencoded",
                "content-length":String(Buffer.byteLength(first)+Buffer.byteLength(remainder))
            });
            request.on("response",function (headers) {
                status=headers[":status"];
                request.write(remainder);
                request.end();
            });
            request.on("data",chunk => chunks.push(chunk));
            request.on("end",() => resolve({status,body:Buffer.concat(chunks).toString()}));
        } else {
            const transport=testCase.protocol === "https" ? https : http;
            request=transport.request({
                host:"127.0.0.1",
                port:testCase.port,
                path:"/servlets/echo.jss",
                method:"POST",
                headers:{
                    "Content-Type":"application/x-www-form-urlencoded",
                    "Content-Length":Buffer.byteLength(first)+Buffer.byteLength(remainder)
                },
                rejectUnauthorized:false
            },function (responseMessage) {
                status=responseMessage.statusCode;
                responseMessage.on("data",chunk => chunks.push(chunk));
                responseMessage.on("end",() => resolve({status,body:Buffer.concat(chunks).toString()}));
                request.write(remainder);
                request.end();
            });
        }
        request.on("error",reject);
        request.write(first);
    });
    assert.strictEqual(response.status,413,"413 status");
    await delay(20);
    assert.strictEqual(invocationCount(testCase),before,"413 servlet invocation");
    await assertHealthy(testCase,client,"413 continued transmission");
}

(async function () {
    for (const protocol of ["http","https","http2","http2s"]) {
        const testCase=await start(protocol);
        let client;
        try {
            if (protocol.startsWith("http2")) client=createHttp2Client(testCase);
            await verifySuccessfulPosts(testCase,client);
            if (client) await http2AbortChecks(testCase,client);
            else await http1AbortChecks(testCase);
            await payloadTooLarge(testCase,client);
            assert.strictEqual(testCase.events.some(event => event.event === "uncaught"),false,"uncaught exception");
            assert.strictEqual(testCase.events.some(event => event.event === "unhandled"),false,"unhandled rejection");
            console.log("PASS buffered POST abort "+protocol);
        } finally {
            if (client) client.destroy();
            await stop(testCase);
        }
    }
    console.log("All buffered POST abort verification tests passed.");
})().catch(function (error) {
    console.error(error.stack || error);
    process.exitCode=1;
});
