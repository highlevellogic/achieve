const assert = require("node:assert");
const http = require("node:http");
const path = require("node:path");
const {fork} = require("node:child_process");

const fixture = path.join(__dirname,"fixture.js");
const applicationOne = path.join(__dirname,"application-one");
const applicationTwo = path.join(__dirname,"application-two");
const port = 24950;

function request(requestPath) {
    return new Promise(function (resolve,reject) {
        http.get({host:"127.0.0.1",port,path:requestPath},function (response) {
            const chunks=[];
            response.on("data",function (chunk) { chunks.push(chunk); });
            response.on("end",function () {
                resolve({status:response.statusCode,body:Buffer.concat(chunks).toString("utf8")});
            });
        }).on("error",reject);
    });
}

function waitFor(child,type) {
    return new Promise(function (resolve,reject) {
        const timer=setTimeout(function () {
            child.off("message",receive);
            reject(new Error("Timed out waiting for "+type));
        },5000);
        function receive(message) {
            if (message.type !== type) return;
            clearTimeout(timer);
            child.off("message",receive);
            resolve();
        }
        child.on("message",receive);
    });
}

function stop(child) {
    return new Promise(function (resolve) {
        child.once("exit",resolve);
        child.send({type:"shutdown"});
    });
}

(async function () {
    const child=fork(fixture,[String(port),applicationOne],{stdio:["ignore","ignore","ignore","ipc"]});
    try {
        await waitFor(child,"listening");

        let response=await request("/servlets/root.jss.cjs");
        assert.strictEqual(response.status,200);
        let root=JSON.parse(response.body);
        assert.strictEqual(root.appPath,path.normalize(applicationOne));
        assert.strictEqual(root.dirPath,path.join(applicationOne,"servlets"));

        response=await request("/servlets/nested/deep.jss.cjs");
        assert.strictEqual(response.status,200);
        const nested=JSON.parse(response.body);
        assert.strictEqual(nested.appPath,path.normalize(applicationOne));
        assert.strictEqual(nested.appPath,root.appPath);
        assert.strictEqual(nested.dirPath,path.join(applicationOne,"servlets","nested"));
        assert.notStrictEqual(nested.dirPath,root.dirPath);

        const changed=waitFor(child,"app-path-set");
        child.send({type:"set-app-path",path:applicationTwo});
        await changed;

        response=await request("/servlets/changed.jss.cjs");
        assert.strictEqual(response.status,200);
        const secondApplication=JSON.parse(response.body);
        assert.strictEqual(secondApplication.appPath,path.normalize(applicationTwo));
        assert.strictEqual(secondApplication.dirPath,path.join(applicationTwo,"servlets"));
        assert.notStrictEqual(secondApplication.appPath,root.appPath);

        console.log("PASS servlet session application and directory paths");
    } finally {
        if (child.exitCode === null) await stop(child);
    }
}()).catch(function (err) {
    console.error(err.stack || err);
    process.exitCode=1;
});
