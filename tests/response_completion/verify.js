const assert=require("node:assert");
const http=require("node:http");
const http2=require("node:http2");
const https=require("node:https");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {fork}=require("node:child_process");

const protocols=["http","https","h2c","h2s"];
const ports={http:24940,https:24941,h2c:24942,h2s:24943};

function start(protocol) {
    return new Promise((resolve,reject) => {
        const logPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-response-completion-"));
        const child=fork(path.join(__dirname,"fixture.js"),[],{
            env:{
                ...process.env,
                ACHIEVE_COMPLETION_PROTOCOL:protocol,
                ACHIEVE_COMPLETION_PORT:String(ports[protocol]),
                ACHIEVE_COMPLETION_LOG_PATH:logPath
            },
            stdio:["ignore","pipe","pipe","ipc"]
        });
        let output="";
        let ready=false;
        child.stdout.on("data",data => output+=data);
        child.stderr.on("data",data => output+=data);
        child.once("message",message => {
            if (message.type !== "ready") return;
            ready=true;
            resolve({child,logPath,output:() => output});
        });
        child.once("error",error => {
            if (ready) return;
            fs.rmSync(logPath,{recursive:true,force:true});
            reject(error);
        });
        child.once("exit",code => {
            if (ready) return;
            fs.rmSync(logPath,{recursive:true,force:true});
            reject(new Error(`fixture exited (${code})\n${output}`));
        });
    });
}

function stop(testCase) {
    return new Promise(resolve => {
        function finish() {
            fs.rmSync(testCase.logPath,{recursive:true,force:true});
            resolve();
        }
        if (testCase.child.exitCode !== null) return finish();
        testCase.child.once("exit",finish);
        testCase.child.send({type:"stop"});
    });
}

function serverLogText(logPath) {
    const directory=path.join(logPath,"server");
    if (!fs.existsSync(directory)) return "";
    return fs.readdirSync(directory)
        .map(name => fs.readFileSync(path.join(directory,name),"utf8"))
        .join("\n");
}

async function waitForDiagnostics(logPath,patterns) {
    for (let attempt=0;attempt<100;attempt++) {
        const text=serverLogText(logPath);
        if (patterns.every(pattern => pattern.test(text))) return text;
        await new Promise(resolve => setTimeout(resolve,20));
    }
    return serverLogText(logPath);
}

function request(protocol,kind,method="GET",allowHeaderlessTermination=false) {
    return new Promise((resolve,reject) => {
        const target=`/servlets/returns.jss.cjs?kind=${kind}`;
        if (protocol === "h2c" || protocol === "h2s") {
            const secure=protocol === "h2s";
            const client=http2.connect(`${secure ? "https" : "http"}://127.0.0.1:${ports[protocol]}`,
                secure ? {rejectUnauthorized:false} : {});
            let settled=false;
            let req;
            const timer=setTimeout(() => finish(new Error(`${protocol} request timed out: ${kind}`)),5000);
            function finish(error,termination) {
                if (settled) return;
                settled=true;
                clearTimeout(timer);
                if (error) client.destroy();
                else client.close();
                if (error) reject(error);
                else resolve({status:headers && headers[":status"],headers,body:Buffer.concat(chunks),termination});
            }
            client.once("error",error => finish(error));
            let headers;
            const chunks=[];
            req=client.request({":method":method,":path":target});
            req.on("response",value => headers=value);
            req.on("data",chunk => chunks.push(chunk));
            req.on("end",() => {
                if (!headers && !allowHeaderlessTermination) {
                    finish(new Error(`${protocol} response ended before headers: ${kind}`));
                    return;
                }
                finish(null,"end");
            });
            req.on("error",error => {
                if (!allowHeaderlessTermination) finish(error);
            });
            req.on("aborted",() => {
                if (!allowHeaderlessTermination) finish(new Error(`${protocol} response aborted: ${kind}`));
            });
            req.on("close",() => {
                if (settled) return;
                if (allowHeaderlessTermination) finish(null,"close");
                else finish(new Error(`${protocol} response closed before completion: ${kind}`));
            });
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
        assert.strictEqual(result.status,201);
        assert.strictEqual(result.body.toString(),"status");
        result=await request(protocol,"not-found");
        assert.strictEqual(result.status,404);
        assert.strictEqual(result.body.toString(),"not found");
        result=await request(protocol,"not-found-null");
        assert.strictEqual(result.status,404);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"not-found-undefined");
        assert.strictEqual(result.status,404);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"promise-status");
        assert.strictEqual(result.status,201);
        assert.strictEqual(result.body.toString(),"promised status");
        result=await request(protocol,"promise-null-status");
        assert.strictEqual(result.status,404);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"thenable-status");
        assert.strictEqual(result.status,202);
        assert.strictEqual(result.body.toString(),"thenable status");
        result=await request(protocol,"thenable-null-status");
        assert.strictEqual(result.status,409);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"string","HEAD");
        assert.strictEqual(result.status,200);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"status","HEAD");
        assert.strictEqual(result.status,201);
        assert.strictEqual(result.body.length,0);
        result=await request(protocol,"auto-default");
        assert.strictEqual(result.status,200);
        assert.deepStrictEqual(JSON.parse(result.body),{autoEnd:true,allowAsync:false});
        result=await request(protocol,"auto-owned");
        assert.strictEqual(result.status,202);
        assert.strictEqual(result.body.toString(),"autoEnd application owned");
        result=await request(protocol,"auto-restored");
        assert.strictEqual(result.status,200);
        assert.deepStrictEqual(JSON.parse(result.body),{autoEnd:true,allowAsync:false});
        result=await request(protocol,"alias-owned");
        assert.strictEqual(result.status,202);
        assert.strictEqual(result.body.toString(),"allowAsync application owned");
        result=await request(protocol,"alias-restored");
        assert.strictEqual(result.status,200);
        assert.deepStrictEqual(JSON.parse(result.body),{autoEnd:true,allowAsync:false});
        result=await request(protocol,"auto-last");
        assert.strictEqual(result.status,200);
        assert.deepStrictEqual(JSON.parse(result.body),{autoEnd:true,allowAsync:false});
        result=await request(protocol,"alias-last");
        assert.strictEqual(result.status,202);
        assert.deepStrictEqual(JSON.parse(result.body),{autoEnd:false,allowAsync:true});
        for (const kind of ["sync-delayed","async-before-await","async-after-await","async-after-await-value"]) {
            result=await request(protocol,kind);
            assert.strictEqual(result.status,200,`${protocol} ${kind}: delayed response must not end early`);
            assert.strictEqual(result.body.toString(),"Delayed response",`${protocol} ${kind}`);
            if (kind.startsWith("async-after-await")) assert.strictEqual(result.headers["x-delayed"],"preserved");
            console.log(`PASS ${protocol} ${kind}: application completed delayed response`);
        }
        result=await request(protocol,"async-normal");
        assert.strictEqual(result.status,200);
        assert.strictEqual(result.body.toString(),"async normal");
        for (const kind of ["sync-throw","async-reject","async-owned-reject"]) {
            result=await request(protocol,kind);
            assert.strictEqual(result.status,500,`${protocol} ${kind}: managed errors remain handled`);
            assert.match(result.body.toString(),/completion failure/);
        }
        for (const kind of ["head-sync-throw","head-async-reject"]) {
            result=await request(protocol,kind,"HEAD");
            assert.strictEqual(result.status,500,`${protocol} HEAD ${kind}: managed errors remain handled`);
            assert.strictEqual(result.body.length,0,`${protocol} HEAD ${kind}: no response body`);
            if (protocol === "http" || protocol === "https") {
                assert.strictEqual(result.headers["transfer-encoding"],undefined,
                    `${protocol} HEAD ${kind}: no transfer encoding`);
            }
        }
        const diagnosticText=await waitForDiagnostics(testCase.logPath,[
            /Sync completion failure/,
            /Async completion failure/,
            /HEAD synchronous completion failure/,
            /HEAD asynchronous completion failure/
        ]);
        assert.match(diagnosticText,/Sync completion failure/,
            `${protocol} synchronous GET failure reaches server diagnostics`);
        assert.match(diagnosticText,/Async completion failure/,
            `${protocol} asynchronous GET failure reaches server diagnostics`);
        assert.match(diagnosticText,/HEAD synchronous completion failure/,
            `${protocol} synchronous HEAD failure reaches server diagnostics`);
        assert.match(diagnosticText,/HEAD asynchronous completion failure/,
            `${protocol} asynchronous HEAD failure reaches server diagnostics`);
        result=await request(protocol,"string");
        assert.strictEqual(result.status,200,`${protocol} remains healthy after HEAD failures`);
        assert.strictEqual(result.body.toString(),"hello");
        result=await request(protocol,"invalid","GET",protocol === "h2c" || protocol === "h2s");
        if (protocol === "http" || protocol === "https") {
            assert.strictEqual(result.status,500,`${protocol} end(content) exceptions reach managed error handling`);
            assert.match(result.body.toString(),/must be of type string|Buffer|Uint8Array/i);
        } else {
            // The HTTP/2 compatibility response has already committed :status 200
            // before end(invalid) throws, but stream termination can prevent the
            // client from receiving those response headers.
            if (result.headers) assert.strictEqual(result.status,200);
            else assert.strictEqual(result.status,undefined);
            assert.strictEqual(result.body.length,0);
            assert.match(result.termination,/^(end|close)$/);
        }
        result=await request(protocol,"string");
        assert.strictEqual(result.status,200,`${protocol} remains healthy after invalid response content`);
        assert.strictEqual(result.body.toString(),"hello");
    } finally {
        await stop(testCase);
    }
}

(async function () {
    for (const protocol of protocols) await verify(protocol);
    console.log("PASS servlet response completion (HTTP, HTTPS, h2c, secure HTTP/2)");
})().catch(error => {console.error(error.stack);process.exitCode=1;});
