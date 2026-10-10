const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const net=require('node:net');
const tls=require('node:tls');
const http2=require('node:http2');
const {fork}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'achieve-target-syntax-'));
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
function rawRequest(secure,port,target,method='GET',host='example.test') {
    return new Promise((resolve,reject)=>{
        let raw='';
        const socket=secure?tls.connect({port,rejectUnauthorized:false}):net.connect({port});
        socket.on(secure?'secureConnect':'connect',()=>socket.write(method+' '+target+' HTTP/1.1\r\nHost: '+host+'\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'));
        socket.setTimeout(5000,()=>socket.destroy(new Error('TCP timeout')));
        socket.on('data',b=>raw+=b);socket.on('error',reject);
        socket.on('end',()=>resolve({status:Number(raw.split(' ')[1]),raw}));
    });
}
function h2Request(client,target,method='GET',headers={}) {
    return new Promise((resolve,reject)=>{
        let status,body='',error;
        const req=client.request({':path':target,':method':method,...headers},{endStream:true});
        req.on('response',h=>status=h[':status']);req.on('data',b=>body+=b);
        req.on('error',e=>error=e.code);
        req.setTimeout(5000,()=>{req.destroy();reject(new Error('HTTP2 timeout'));});
        req.on('close',()=>resolve({status,raw:body,error,rst:req.rstCode}));
    });
}
async function verify(protocol,index) {
    const app=path.join(root,protocol),port=24910+index,isH2=protocol.startsWith('h2');
    fs.mkdirSync(app,{recursive:true});
    fs.writeFileSync(path.join(app,'index.html'),'ROOT');
    fs.writeFileSync(path.join(app,'echo.jss'),'exports.servlet=c=>{process.send({invoked:"servlet",url:c.request.url});return c.request.url;};');
    fs.writeFileSync(path.join(app,'handler.jss'),'exports.servlet=c=>{process.send({invoked:"registered",url:c.request.url});return c.request.url;};');
    for(const suffix of ['%20','%23','%25','%2F','%2f','%3F','%E2%82%AC'])
        fs.writeFileSync(path.join(app,'encoded'+suffix+'name.txt'),'LITERAL '+suffix.toUpperCase());
    const child=fork(path.join(__dirname,'fixture.js'),[],{silent:true,env:{...process.env,
        ACHIEVE_TARGET_APP:app,ACHIEVE_TARGET_PORT:String(port),ACHIEVE_TARGET_PROTOCOL:protocol}});
    const invocations=[];let stderr='',id=0,client;
    child.stderr.on('data',b=>stderr+=b);child.on('message',m=>{if(m.invoked)invocations.push(m);});
    const exited=new Promise(resolve=>child.once('exit',resolve));
    const control=()=>new Promise((resolve,reject)=>{
        const key=++id,timer=setTimeout(()=>{child.off('message',receive);reject(new Error('IPC timeout'));},5000);
        function receive(m){if(m.id===key){clearTimeout(timer);child.off('message',receive);resolve(m);}}
        child.on('message',receive);child.send({id:key});
    });
    try {
        await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error('Startup timeout')),5000);
            child.on('message',m=>{if(m.ready){clearTimeout(timer);resolve();}});child.once('error',reject);
        });
        if(isH2)client=http2.connect((protocol==='h2s'?'https':'http')+'://localhost:'+port,{rejectUnauthorized:false});
        const request=(target,method='GET')=>isH2?h2Request(client,target,method):rawRequest(protocol==='https',port,target,method);
        const test=(name,fn)=>check(protocol+' '+name,fn);
        const malformed=['/echo.jss#bad','/echo.jss?x=#bad',...['%','%A','%ZZ'].flatMap(x=>['/echo.jss'+x,'/echo.jss?x='+x]),'/mapped?x=%ZZ'];
        if(!isH2)malformed.push('http://example.test/echo.jss#bad','http://example.test/echo.jss?x=%ZZ');
        for(const target of malformed)for(const method of ['GET','HEAD','POST','OPTIONS','DELETE']) {
            const before=await control(),count=invocations.length;
            const result=await request(target,method),after=await control();
            test(method+' rejects '+target,()=>{
                if(isH2){assert.equal(result.status,undefined);assert.equal(result.rst,http2.constants.NGHTTP2_PROTOCOL_ERROR);assert.equal(result.error,'ERR_HTTP2_STREAM_ERROR');}
                else assert.equal(result.status,400);
                assert.equal(after.lookups,before.lookups);assert.equal(invocations.length,count);
            });
            const healthy=await request('/index.html');
            test('healthy after '+method+' '+target,()=>{assert.equal(healthy.status,200);assert.ok(healthy.raw.includes('ROOT'));});
        }
        const valid=['/echo.jss?','/echo.jss?x=one?two/three',
            ...['%20','%23','%25','%2F','%2f','%3F','%E2%82%AC','%e2%82%ac','%FF','%2523','%23abc'].map(x=>'/echo.jss?x='+x)];
        if(!isH2)valid.push('http://example.test/echo.jss?x=%23%2f');
        for(const target of valid) {
            const r=await request(target);await control();
            test('servlet original URL '+target,()=>{assert.equal(r.status,200);assert.ok(r.raw.includes(target));assert.equal(invocations.at(-1).url,target);});
            const registered=await request(target,'DELETE');await control();
            test('registered original URL '+target,()=>{assert.equal(registered.status,200);assert.ok(registered.raw.includes(target));assert.equal(invocations.at(-1).url,target);assert.equal(invocations.at(-1).invoked,'registered');});
        }
        for(const suffix of ['%20','%23','%25','%2F','%2f','%3F','%E2%82%AC']) {
            const r=await request('/encoded'+suffix+'name.txt');
            test('literal encoded path '+suffix,()=>{assert.equal(r.status,200);assert.ok(r.raw.includes('LITERAL '+suffix.toUpperCase()));});
        }
        const mapped=await request('/mapped?x=%23');await control();
        test('mapped URL preserved',()=>{assert.equal(mapped.status,200);assert.equal(invocations.at(-1).url,'/mapped?x=%23');});
        const options=await request('*','OPTIONS');test('OPTIONS control',()=>assert.equal(options.status,204));
        if(isH2) {
            const conflict=await h2Request(client,'/index.html','GET',{':authority':'one.test',host:'two.test'});
            test('authority rejection unchanged',()=>{assert.equal(conflict.status,400);assert.equal(conflict.rst,0);});
        } else {
            for(const target of ['http://example.test','http://example.test?x=%23','http://example.test/encoded%20name.txt']) {
                const r=await request(target);test('absolute-form '+target,()=>assert.equal(r.status,200));
            }
            const badHost=await rawRequest(protocol==='https',port,'/index.html','GET','bad host');
            test('Host rejection unchanged',()=>assert.equal(badHost.status,400));
            const connect=await rawRequest(protocol==='https',port,'example.test:443','CONNECT');
            test('CONNECT unchanged',()=>assert.equal(connect.status,501));
        }
        test('no uncaught/unhandled errors',()=>assert.equal(stderr,''));
    } finally {
        if(client)await new Promise(resolve=>{client.once('close',resolve);client.close();});
        if(child.connected)child.send({stop:true});const timer=setTimeout(()=>child.kill(),5000);await exited;clearTimeout(timer);
    }
}
(async()=>{for(const [i,p]of ['http','https','h2c','h2s'].entries())await verify(p,i);
    console.log('All '+checks+' request-target syntax checks passed.');})()
    .catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
