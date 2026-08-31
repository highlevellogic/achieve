const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const https=require('node:https');
const http2=require('node:http2');
const zlib=require('node:zlib');
const {fork}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'achieve-static-length-'));
const source=Buffer.from('Static representation. '.repeat(100));
const media=Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
const original=Buffer.from('ORIGINAL');
let checks=0;
function check(name,fn) { fn(); checks++; console.log('PASS '+name); }
function write(app,name,data) {
    const file=path.join(app,name);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,data);
    return file;
}
function request(protocol,port,target,method='GET',headers={}) {
    return new Promise((resolve,reject) => {
        const chunks=[];
        let req,client,responseHeaders,status;
        function end() {
            if (client) client.close();
            resolve({headers:responseHeaders,status,body:Buffer.concat(chunks)});
        }
        if (protocol === 'h2c' || protocol === 'h2s') {
            client=http2.connect((protocol === 'h2s' ? 'https' : 'http')+'://localhost:'+port,
                {rejectUnauthorized:false});
            client.on('error',reject);
            req=client.request({':method':method,':path':target,...headers});
            req.on('response',h => {responseHeaders=h; status=h[':status'];});
            req.on('data',b => chunks.push(b));
            req.on('end',end);
        } else {
            req=(protocol === 'https' ? https : http).request({host:'localhost',port,
                path:target,method,headers,rejectUnauthorized:false},res => {
                responseHeaders=res.headers; status=res.statusCode;
                res.on('data',b => chunks.push(b));
                res.on('end',end);
                res.on('error',reject);
                res.on('aborted',() => reject(new Error('Response aborted')));
            });
        }
        req.setTimeout(5000,() => {req.destroy(); if(client)client.destroy(); reject(new Error('Request timeout'));});
        req.on('error',reject);
        req.end();
    });
}
async function verify(protocol,index) {
    const app=path.join(root,protocol),port=24550+index;
    write(app,'static.txt',source);
    write(app,'empty.txt','');
    write(app,'media.mp4',media);
    for (const name of ['replace.txt','grow.txt','setup-error.txt','read-error.txt']) write(app,name,original);
    write(app,'replacement.txt','A DIFFERENT REPLACEMENT');
    write(app,'servlet.jss','exports.servlet = function () { return "servlet"; };');
    write(app,'bodyless.jss','exports.servlet = function (c) { c.response.statusCode=204; c.response.end(); };');
    const representations={identity:source,gzip:zlib.gzipSync(source),deflate:zlib.deflateSync(source)};
    for (const [coding,ext] of [['gzip','.gz'],['deflate','.zl']]) {
        const file=write(app,'.compression-cache/static.txt'+ext,representations[coding]);
        const future=new Date(Date.now()+2000);
        fs.utimesSync(file,future,future);
    }
    const child=fork(path.join(__dirname,'fixture.js'),[],{silent:true,
        env:{...process.env,ACHIEVE_LENGTH_APP:app,ACHIEVE_LENGTH_PORT:String(port),ACHIEVE_LENGTH_PROTOCOL:protocol}});
    let stderr='';const streams=[];
    child.stderr.on('data',b => stderr+=b);
    child.on('message',m => {if(m.event === 'stream')streams.push(m);});
    const exited=new Promise(resolve => child.once('exit',resolve));
    try {
        await new Promise((resolve,reject) => {
            const timer=setTimeout(() => reject(new Error('Startup timeout')),5000);
            child.on('message',m => {if(m.event === 'ready'){clearTimeout(timer);resolve();}});
            child.once('error',reject);
        });
        const get=(target,method,headers) => request(protocol,port,target,method,headers);
        for (const [coding,bytes] of Object.entries(representations)) {
            const headers={'accept-encoding':coding};
            const result=await get('/static.txt','GET',headers);
            check(protocol+' '+coding+' GET length/bytes/framing',() => {
                assert.equal(result.status,200);
                assert.equal(result.headers['content-length'],String(bytes.length));
                assert.equal(result.headers['transfer-encoding'],undefined);
                assert.equal(result.headers['content-encoding'],coding === 'identity' ? undefined : coding);
                assert.deepEqual(result.body,bytes);
            });
            const head=await get('/static.txt','HEAD',headers);
            check(protocol+' '+coding+' HEAD',() => {
                assert.equal(head.status,200);assert.equal(head.body.length,0);
                assert.equal(head.headers['content-length'],String(bytes.length));
                assert.equal(head.headers['transfer-encoding'],undefined);
            });
            const cached=await get('/static.txt','GET',{...headers,'if-none-match':result.headers.etag});
            check(protocol+' '+coding+' 304',() => {
                assert.equal(cached.status,304);assert.equal(cached.body.length,0);
                assert.equal(cached.headers['content-length'],undefined);
            });
        }
        for (const method of ['GET','HEAD']) {
            const empty=await get('/empty.txt',method);
            check(protocol+' empty '+method,() => {
                assert.equal(empty.status,200);assert.equal(empty.headers['content-length'],'0');
                assert.equal(empty.body.length,0);
            });
        }
        const failed=await get('/static.txt','GET',{'if-match':'"wrong"'});
        check(protocol+' 412 no file length',() => {
            assert.equal(failed.status,412);assert.equal(failed.body.length,0);
            assert.ok(failed.headers['content-length'] === undefined || failed.headers['content-length'] === '0');
        });
        for (const name of ['setup-error.txt','read-error.txt']) {
            const error=await get('/'+name);
            check(protocol+' '+name+' error framing',() => {
                assert.equal(error.status,500);assert.ok(error.body.length>0);
                assert.notEqual(error.headers['content-length'],String(original.length));
                if(error.headers['content-length'] !== undefined) assert.equal(Number(error.headers['content-length']),error.body.length);
            });
        }
        for (const name of ['replace.txt','grow.txt']) {
            const result=await get('/'+name);
            check(protocol+' '+name+' captured representation',() => {
                assert.equal(result.status,200);assert.equal(result.headers['content-length'],String(original.length));
                assert.deepEqual(result.body,original);
                assert.ok(streams.some(s => s.name===name && s.start===0 && s.end===original.length-1));
            });
        }
        const full=await get('/media.mp4'),range=await get('/media.mp4','GET',{range:'bytes=3-8'});
        check(protocol+' media unchanged',() => {
            assert.equal(full.status,200);assert.equal(full.headers['content-length'],String(media.length));
            assert.deepEqual(full.body,media);assert.equal(range.status,206);
            assert.equal(range.headers['content-length'],'6');assert.equal(range.headers['content-range'],'bytes 3-8/'+media.length);
            assert.deepEqual(range.body,media.subarray(3,9));
        });
        for (const [target,status] of [['/missing',404],['/servlet.jss',200],['/bodyless.jss',204]]) {
            const result=await get(target);
            check(protocol+' no static length on '+target,() => {
                assert.equal(result.status,status);
                if(status===204) {assert.equal(result.headers['content-length'],undefined);assert.equal(result.body.length,0);}
                else if(result.headers['content-length']!==undefined) assert.equal(Number(result.headers['content-length']),result.body.length);
            });
        }
        check(protocol+' no uncaught errors',() => assert.equal(stderr,''));
    } finally {
        if(child.connected)child.send('stop');
        const timer=setTimeout(() => child.kill(),5000);
        await exited;clearTimeout(timer);
    }
}
(async()=>{
    for (const [i,p] of ['http','https','h2c','h2s'].entries()) await verify(p,i);
    console.log('All '+checks+' static Content-Length checks passed.');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
