const assert=require("node:assert");
const childProcess=require("node:child_process");
const http=require("node:http");
const http2=require("node:http2");
const https=require("node:https");
const path=require("node:path");

const media=Buffer.from("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\n");
let nextPort=19320;

function start(protocol) {
    return new Promise(function (resolve,reject) {
        const port=nextPort++;
        const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
            silent:true,
            env:Object.assign({},process.env,{
                ACHIEVE_RANGE_PORT:String(port),
                ACHIEVE_RANGE_PROTOCOL:protocol
            })
        });
        let output="";
        child.stdout.on("data",data => output+=data);
        child.stderr.on("data",data => output+=data);
        child.on("message",function (message) {
            if (message.event === "ready") resolve({child,port,protocol});
        });
        child.once("exit",code => reject(new Error("Byte-range fixture exited before readiness: "+code+"\n"+output)));
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
            host:"127.0.0.1",
            port:testCase.port,
            path:"/sample.mp4",
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
        request.end();
    });
}

function http2Request(testCase,options={}) {
    return new Promise(function (resolve,reject) {
        const secure=testCase.protocol === "http2s";
        const client=http2.connect((secure ? "https" : "http")+"://127.0.0.1:"+testCase.port,
            secure ? {rejectUnauthorized:false} : {});
        client.on("error",reject);
        const request=client.request(Object.assign({},options.headers || {},{
            ":path":"/sample.mp4",
            ":method":options.method || "GET"
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
        request.end();
    });
}

function request(testCase,options) {
    return testCase.protocol.startsWith("http2")
        ? http2Request(testCase,options)
        : http1Request(testCase,options);
}

async function expectRange(testCase,name,range,start,end,extraHeaders={}) {
    const response=await request(testCase,{headers:Object.assign({Range:range},extraHeaders)});
    assert.strictEqual(response.status,206,name+" status");
    assert.strictEqual(response.headers["accept-ranges"],"bytes",name+" Accept-Ranges");
    assert(!String(response.headers["content-type"]).startsWith("multipart/"),name+" remains single-part");
    assert.strictEqual(response.headers["content-range"],"bytes "+start+"-"+end+"/"+media.length,name+" Content-Range");
    assert.strictEqual(Number(response.headers["content-length"]),(end-start)+1,name+" Content-Length");
    assert(response.body.equals(media.subarray(start,end+1)),name+" exact bytes");
}

async function protocolChecks(testCase) {
    const full=await request(testCase,{});
    assert.strictEqual(full.status,200,"full GET status");
    assert(full.body.equals(media),"full GET bytes");
    const etag=full.headers.etag;

    await expectRange(testCase,"single range","bytes=2-7",2,7);
    await expectRange(testCase,"two satisfiable ranges","bytes=2-7,20-25",2,7);
    await expectRange(testCase,"satisfiable then unsatisfiable","bytes=8-11,999-1000",8,11);
    await expectRange(testCase,"unsatisfiable then satisfiable","bytes=999-1000,12-15",12,15);
    await expectRange(testCase,"overlapping ranges","bytes=16-22,20-28",16,22);
    await expectRange(testCase,"adjacent ranges","bytes=23-25,26-28",23,25);
    await expectRange(testCase,"open-ended range","bytes=58-",58,media.length-1);
    await expectRange(testCase,"suffix range","bytes=-5",media.length-5,media.length-1);
    await expectRange(testCase,"end beyond EOF","bytes=60-999",60,media.length-1);
    await expectRange(testCase,"matching If-Range","bytes=3-9",3,9,{"If-Range":etag});

    let response=await request(testCase,{headers:{Range:"bytes=999-1000,2000-3000"}});
    assert.strictEqual(response.status,416,"all unsatisfiable status");
    assert.strictEqual(response.headers["content-range"],"bytes */"+media.length,"all unsatisfiable Content-Range");

    for (const test of [
        ["malformed first member","bytes=broken,0-2"],
        ["malformed later member","bytes=0-2,broken"],
        ["end before start","bytes=20-10"]
    ]) {
        response=await request(testCase,{headers:{Range:test[1]}});
        assert.strictEqual(response.status,400,test[0]+" status");
    }

    const excessive=Array.from({length:17},(_,index) => index+"-"+index).join(",");
    response=await request(testCase,{headers:{Range:"bytes="+excessive}});
    assert.strictEqual(response.status,400,"excessive range count status");

    response=await request(testCase,{headers:{Range:"bytes=3-9","If-Range":"\"stale\""}});
    assert.strictEqual(response.status,200,"nonmatching If-Range status");
    assert.strictEqual(response.headers["content-range"],undefined,"nonmatching If-Range Content-Range");
    assert(response.body.equals(media),"nonmatching If-Range full bytes");

    response=await request(testCase,{method:"HEAD",headers:{Range:"bytes=3-9"}});
    assert.strictEqual(response.status,200,"HEAD status");
    assert.strictEqual(response.headers["content-range"],undefined,"HEAD Content-Range");
    assert.strictEqual(Number(response.headers["content-length"]),media.length,"HEAD Content-Length");
    assert.strictEqual(response.body.length,0,"HEAD body");

    console.log("PASS byte ranges "+testCase.protocol);
}

(async function () {
    for (const protocol of ["http","https","http2","http2s"]) {
        const testCase=await start(protocol);
        try {
            await protocolChecks(testCase);
        } finally {
            await stop(testCase);
        }
    }
})().catch(function (error) {
    console.error(error.stack || error);
    process.exitCode=1;
});
