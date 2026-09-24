const assert=require("node:assert");
const http=require("node:http");
const http2=require("node:http2");
const https=require("node:https");
const path=require("node:path");
const {fork}=require("node:child_process");

const protocols=["http","https","h2c","h2s"];
const ports={http:24940,https:24941,h2c:24942,h2s:24943};

function start(protocol) {
    return new Promise((resolve,reject) => {
        const child=fork(path.join(__dirname,"fixture.js"),[],{
            env:{...process.env,ACHIEVE_COMPLETION_PROTOCOL:protocol,ACHIEVE_COMPLETION_PORT:String(ports[protocol])},
            stdio:["ignore","pipe","pipe","ipc"]
        });
        let output="";
        child.stdout.on("data",data => output+=data);
        child.stderr.on("data",data => output+=data);
        child.once("message",message => message.type === "ready" && resolve({child,output:() => output}));
        child.once("exit",code => reject(new Error(`fixture exited (${code})\n${output}`)));
    });
}

function stop(testCase) {
    return new Promise(resolve => {
        testCase.child.once("exit",resolve);
        testCase.child.send({type:"stop"});
    });
}

function request(protocol,kind,method="GET") {
    return new Promise((resolve,reject) => {
        const target=`/servlets/returns.jss.cjs?kind=${kind}`;
        if (protocol === "h2c" || protocol === "h2s") {
            const secure=protocol === "h2s";
            const client=http2.connect(`${secure ? "https" : "http"}://127.0.0.1:${ports[protocol]}`,
                secure ? {rejectUnauthorized:false} : {});
            client.once("error",reject);
            const req=client.request({":method":method,":path":target});
            let headers;
            const chunks=[];
            req.on("response",value => headers=value);
            req.on("data",chunk => chunks.push(chunk));
            req.on("end",() => {client.close();resolve({status:headers[":status"],headers,body:Buffer.concat(chunks)});});
            req.on("error",error => {client.close();reject(error);});
            req.end();
            return;
        }
        const transport=protocol === "https" ? https : http;
        const req=transport.request({host:"127.0.0.1",port:ports[protocol],path:target,method,rejectUnauthorized:false},response => {
            const chunks=[];
            response.on("data",chunk => chunks.push(chunk));
            response.on("end",() => resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));
        });
        req.on("error",reject);
        req.end();
    });
}

async function verify(protocol) {
    const testCase=await start(protocol);
    try {
        let result=await request(protocol,"string");
        assert.strictEqual(result.status,200);
        assert.deepStrictEqual(result.body,Buffer.from("hello"));
        assert.strictEqual(result.headers["content-type"],"text/plain");
        if (protocol === "http" || protocol === "https") {
            assert.strictEqual(result.headers["content-length"],"5");
            assert.strictEqual(result.headers["transfer-encoding"],undefined);
        }
        result=await request(protocol,"buffer");
        assert.deepStrictEqual(result.body,Buffer.from([0,1,2,253,254,255]));
        result=await request(protocol,"uint8");
        assert.deepStrictEqual(result.body,Buffer.from([3,4,5,250,251,252]));
        result=await request(protocol,"promise");
        assert.strictEqual(result.body.toString(),"promised");
        result=await request(protocol,"empty");
        assert.strictEqual(result.status,200);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"undefined");
        assert.strictEqual(result.status,204);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"null");
        assert.strictEqual(result.status,204);
        result=await request(protocol,"headers");
        assert.strictEqual(result.headers["x-servlet"],"preserved");
        result=await request(protocol,"length");
        assert.strictEqual(result.headers["content-length"],"5");
        assert.strictEqual(result.body.toString(),"hello");
        result=await request(protocol,"status");
        assert.strictEqual(result.status,200,"managed completion continues to select status 200");
        result=await request(protocol,"string","HEAD");
        assert.strictEqual(result.status,200);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"owned");
        assert.strictEqual(result.status,202);
        assert.strictEqual(result.body.toString(),"owned");
        result=await request(protocol,"invalid");
        if (protocol === "http" || protocol === "https") {
            assert.strictEqual(result.status,500,`${protocol} end(content) exceptions reach managed error handling`);
            assert.match(result.body.toString(),/must be of type string|Buffer|Uint8Array/i);
        } else {
            // The HTTP/2 compatibility response has already committed :status 200
            // before either write(invalid) or end(invalid) throws.
            assert.strictEqual(result.status,200);
            assert.strictEqual(result.body.length,0);
        }
    } finally {
        await stop(testCase);
    }
}

(async function () {
    for (const protocol of protocols) await verify(protocol);
    console.log("PASS servlet response completion (HTTP, HTTPS, h2c, secure HTTP/2)");
})().catch(error => {console.error(error.stack);process.exitCode=1;});
