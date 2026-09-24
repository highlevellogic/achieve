const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {fork} = require("node:child_process");

const fixture = path.join(__dirname,"fixture.js");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(),"achieve-helper-cache-"));
const applicationPath = path.join(temporaryRoot,"application");
const servlets = path.join(applicationPath,"servlets");
const port = 24653;

function write(relativePath,content) {
    const filePath=path.join(applicationPath,relativePath);
    fs.mkdirSync(path.dirname(filePath),{recursive:true});
    fs.writeFileSync(filePath,content);
}

function createApplication() {
    write("servlets/helper.js","exports.value='helper';\n");
    write("servlets/helper.jss.cjs","exports.value='cjs';\n");
    write("servlets/helper.jss.mjs","export const value='esm';\n");
    write("servlets/a/same.jss.cjs","exports.value='a';\n");
    write("servlets/b/same.jss.cjs","exports.value='b';\n");
    write("servlets/a/check.jss.cjs","exports.servlet=s=>s.load('./same.jss.cjs').value;\n");
    write("servlets/b/check.jss.cjs","exports.servlet=s=>s.load('./same.jss.cjs').value;\n");
    write("servlets/cache.jss.cjs",`exports.servlet=async function (session) {
 const action=session.params.action;
 if (action==='identity') {
  const c1=session.load('./helper.jss.cjs'),c2=session.load('./helper.jss.cjs');
  const p1=session.load('./helper.jss.mjs'),p2=session.load('./helper.jss.mjs');
  const e1=await p1,e2=await p2;
  return JSON.stringify({cjs:c1===c2,promise:p1===p2,esm:e1===e2,cjsSync:!(c1&&typeof c1.then==='function'),esmPromise:typeof p1.then==='function'});
 }
 if (action==='alias') return String(session.load('./helper')===session.load('./helper.js'));
 if (action==='unsupported') return session.load('./helper.txt');
 if (action==='replace-node-cache') {
  const before=session.load('./helper.jss.cjs');
  require.cache[require.resolve('./helper.jss.cjs')].exports={value:'replacement'};
  return before.value;
 }
 if (action==='cjs-missing') { try{return session.load('./missing.jss.cjs').value}catch(e){return 'failed'} }
 if (action==='cjs-broken') { try{return session.load('./broken.jss.cjs').value}catch(e){return 'failed'} }
 if (action==='esm-missing') { try{return (await session.load('./missing.jss.mjs')).value}catch(e){return 'failed'} }
 if (action==='esm-broken') { try{return (await session.load('./broken.jss.mjs')).value}catch(e){return 'failed'} }
 return session.load('./helper.jss.cjs').value;
};\n`);
}

function request(requestPath) {
    return new Promise((resolve,reject) => {
        http.get({port,path:requestPath},function (res) {
            const chunks=[];
            res.on("data",chunk=>chunks.push(chunk));
            res.on("end",()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString()}));
        }).on("error",reject);
    });
}

function start(mode) {
    return new Promise((resolve,reject) => {
        const child=fork(fixture,[String(port),mode,applicationPath],{stdio:["ignore","ignore","ignore","ipc"]});
        child.once("error",reject);
        child.on("message",message=>{if(message.type==="listening")resolve(child);});
    });
}

function message(child,command,type) {
    return new Promise(resolve => {
        function receive(value) {
            if(value.type!==type)return;
            child.off("message",receive);
            resolve();
        }
        child.on("message",receive);
        child.send(command);
    });
}

function stop(child) {
    return new Promise(resolve=>{child.once("exit",resolve);child.send("shutdown");});
}

async function production() {
    const child=await start("production");
    try {
        let result=await request("/servlets/cache.jss.cjs?action=identity");
        assert.strictEqual(result.status,200);
        assert.deepStrictEqual(JSON.parse(result.body),{cjs:true,promise:true,esm:true,cjsSync:true,esmPromise:true});
        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=alias")).body,"true");
        assert.strictEqual((await request("/servlets/a/check.jss.cjs")).body,"a");
        assert.strictEqual((await request("/servlets/b/check.jss.cjs")).body,"b");

        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=cjs-missing")).body,"failed");
        write("servlets/missing.jss.cjs","exports.value='recovered';\n");
        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=cjs-missing")).body,"recovered");
        write("servlets/broken.jss.cjs","throw new Error('broken');\n");
        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=cjs-broken")).body,"failed");
        write("servlets/broken.jss.cjs","exports.value='recovered';\n");
        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=cjs-broken")).body,"recovered");

        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=esm-missing")).body,"failed");
        write("servlets/missing.jss.mjs","export const value='recovered';\n");
        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=esm-missing")).body,"recovered");
        write("servlets/broken.jss.mjs","throw new Error('broken');\n");
        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=esm-broken")).body,"failed");
        write("servlets/broken.jss.mjs","export const value='recovered';\n");
        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=esm-broken")).body,"failed");

        assert.strictEqual((await request("/servlets/cache.jss.cjs?action=replace-node-cache")).body,"cjs");
        assert.strictEqual((await request("/servlets/cache.jss.cjs")).body,"cjs");
        await message(child,"reset-app-path","app-path-reset");
        assert.strictEqual((await request("/servlets/cache.jss.cjs")).body,"replacement");

        result=await request("/servlets/cache.jss.cjs?action=unsupported");
        assert.strictEqual(result.status,500);
        assert(result.body.includes("load() supports extensionless legacy names"));
    } finally {
        await stop(child);
    }
}

(async function () {
    createApplication();
    await production();
    console.log("PASS: production helper reference cache verification");
}()).catch(err=>{console.error(err.stack||err);process.exitCode=1;}).finally(()=>{
    fs.rmSync(temporaryRoot,{recursive:true,force:true});
});
