const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const https=require('node:https');
const http2=require('node:http2');
const zlib=require('node:zlib');
const {fork}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'achieve-static-dates-'));
const now=Date.UTC(2030,0,1),past=Date.UTC(2020,0,2,3,4,5),future=Date.UTC(2040,0,1);
const date=ms=>new Date(ms).toUTCString();
const bytes=Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz'.repeat(100));
let checks=0;
function check(name,fn) {fn();checks++;console.log('PASS '+name);}
function request(protocol,port,target,method='GET',headers={}) {
    return new Promise((resolve,reject)=>{
        let req,client,status,responseHeaders;const chunks=[];
        const end=()=>{if(client)client.close();resolve({status,headers:responseHeaders,body:Buffer.concat(chunks)});};
        if(protocol==='h2c'||protocol==='h2s') {
            client=http2.connect((protocol==='h2s'?'https':'http')+'://localhost:'+port,{rejectUnauthorized:false});
            client.on('error',reject);
            req=client.request({':method':method,':path':target,...headers});
            req.on('response',h=>{status=h[':status'];responseHeaders=h;});
            req.on('data',b=>chunks.push(b));req.on('end',end);
        } else {
            req=(protocol==='https'?https:http).request({host:'localhost',port,path:target,method,headers,rejectUnauthorized:false},res=>{
                status=res.statusCode;responseHeaders=res.headers;
                res.on('data',b=>chunks.push(b));res.on('end',end);res.on('error',reject);
            });
        }
        req.setTimeout(5000,()=>{req.destroy();if(client)client.destroy();reject(new Error('Timeout'));});
        req.on('error',reject);req.end();
    });
}
async function verify(protocol,index) {
    const app=path.join(root,protocol),port=24650+index;
    function write(name,data,mtime) {
        const file=path.join(app,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);
        fs.utimesSync(file,mtime/1000,mtime/1000);return file;
    }
    write('static.txt',bytes,past);
    write('equal.txt',bytes,now);
    write('future.txt',bytes,future);
    write('fraction.txt',bytes,now+0.5);
    write('empty.txt','',past);
    for(const name of ['setup-error.txt','read-error.txt','replace.txt'])write(name,bytes,past);
    write('replacement.txt','replacement',future);
    const same=write('same.txt','AAAA',past+100);
    write('media.mp4',bytes,past+3000);
    write('.compression-cache/static.txt.gz',zlib.gzipSync(bytes),past+1000);
    write('.compression-cache/static.txt.zl',zlib.deflateSync(bytes),past+2000);
    write('servlet.jss','exports.servlet=()=>"dynamic";',past);
    write('old.txt',bytes,Date.UTC(1994,10,6,8,49,37));
    const child=fork(path.join(__dirname,'fixture.js'),[],{silent:true,env:{...process.env,
        ACHIEVE_DATES_APP:app,ACHIEVE_DATES_PORT:String(port),ACHIEVE_DATES_PROTOCOL:protocol}});
    let stderr='',id=0;child.stderr.on('data',b=>stderr+=b);
    const exited=new Promise(resolve=>child.once('exit',resolve));
    function control(values={}) {
        return new Promise(resolve=>{const key=++id;const receive=m=>{if(m.id===key){child.off('message',receive);resolve(m);}};
            child.on('message',receive);child.send({id:key,...values});});
    }
    try {
        await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error('Startup timeout')),5000);
            child.on('message',m=>{if(m.ready){clearTimeout(timer);resolve();}});child.once('error',reject);
        });
        const get=(target='/static.txt',headers={},method='GET')=>request(protocol,port,target,method,{'accept-encoding':'identity',...headers});
        const test=(name,fn)=>check(protocol+' '+name,fn);
        for(const [target,time,coding] of [['/static.txt',past,'identity'],['/static.txt',past+1000,'gzip'],
            ['/static.txt',past+2000,'deflate'],['/media.mp4',past+3000,'identity'],['/empty.txt',past,'identity'],
            ['/equal.txt',now,'identity'],['/future.txt',now,'identity'],['/fraction.txt',now,'identity']]) {
            for(const method of ['GET','HEAD']) {
                const r=await get(target,{'accept-encoding':coding},method);
                test(target+' '+coding+' '+method+' selected mtime',()=>{
                    assert.equal(r.status,200);assert.equal(r.headers.date,date(now));
                    assert.equal(r.headers['last-modified'],date(time));
                    assert.ok(Date.parse(r.headers['last-modified'])<=Date.parse(r.headers.date));
                    if(method==='HEAD')assert.equal(r.body.length,0);
                });
            }
            for(const [header,offset,status] of [['if-modified-since',-1000,200],['if-modified-since',0,304],
                ['if-modified-since',1000,304],['if-unmodified-since',-1000,412],['if-unmodified-since',0,200],['if-unmodified-since',1000,200]]) {
                const r=await get(target,{'accept-encoding':coding,[header]:date(time+offset)});
                test(target+' '+coding+' '+header+' '+offset,()=>{
                    assert.equal(r.status,status);
                    if(status===304||status===412) {
                        assert.equal(r.body.length,0);
                        assert.ok(r.headers['content-length']===undefined||r.headers['content-length']==='0');
                        assert.equal(r.headers['last-modified'],status===304?date(time):undefined);
                    }
                });
            }
        }
        const base=await get(),etag=base.headers.etag;
        for(const [target,headers,status] of [['/setup-error.txt',{},500],['/read-error.txt',{},500],
            ['/missing.txt',{},404],['/media.mp4',{range:'bytes=bad'},400],['/media.mp4',{range:'bytes=99999-'},416]]) {
            const r=await get(target,headers);
            test('no static date on error '+target+' '+status,()=>{
                assert.equal(r.status,status);assert.equal(r.headers['last-modified'],undefined);
            });
        }
        const replaced=await get('/replace.txt');
        test('pathname replacement preserves opened mtime and bytes',()=>{
            assert.equal(replaced.headers['last-modified'],date(past));assert.deepEqual(replaced.body,bytes);
        });
        for(const [headers,status] of [
            [{'if-match':etag,'if-unmodified-since':date(past-1000)},200],
            [{'if-match':'"wrong"','if-unmodified-since':date(future)},412],
            [{'if-none-match':etag,'if-modified-since':date(past-1000)},304],
            [{'if-none-match':'"wrong"','if-modified-since':date(future)},200],
            [{'if-none-match':etag,'if-unmodified-since':date(past-1000)},412],
            [{'if-unmodified-since':date(past-1000),'if-modified-since':date(future)},412],
            [{'if-modified-since':date(future)},304],
            [{'if-unmodified-since':date(future)},200]]) {
            const r=await get('/static.txt',headers);test('precedence '+JSON.stringify(headers),()=>assert.equal(r.status,status));
        }
        for(const method of ['HEAD','POST']) {
            const r=await get('/static.txt',{'if-modified-since':date(past)},method);
            test(method+' IMS applicability',()=>assert.equal(r.status,method==='HEAD'?304:200));
            const u=await get('/static.txt',{'if-unmodified-since':date(past-1000)},method);
            test(method+' IUS applicability',()=>assert.equal(u.status,412));
        }
        for(const value of ['nonsense','2020-01-02T03:04:05Z','Thu, 32 Jan 2020 03:04:05 GMT',
            'Thu, 02 Jan 2020 25:04:05 GMT','Sun, 31 Feb 2020 03:04:05 GMT',date(past)+', '+date(past)]) {
            for(const field of ['if-modified-since','if-unmodified-since']) {
                const r=await get('/static.txt',{[field]:value});test('ignore invalid '+field+' '+value,()=>assert.equal(r.status,200));
            }
        }
        for(const value of ['Sun, 06 Nov 1994 08:49:37 GMT','Sunday, 06-Nov-94 08:49:37 GMT','Sun Nov  6 08:49:37 1994']) {
            for(const [field,status] of [['if-modified-since',304],['if-unmodified-since',200]]) {
                const r=await get('/old.txt',{[field]:value});test('HTTP-date '+value+' '+field,()=>assert.equal(r.status,status));
            }
        }
        for(const [value,status] of [['Monday, 01-Jan-80 00:00:00 GMT',304],['Tuesday, 02-Jan-80 00:00:00 GMT',200]]) {
            const r=await get('/static.txt',{'if-modified-since':value});
            test('RFC850 fifty-year boundary '+value,()=>assert.equal(r.status,status));
        }
        const first=await get('/same.txt');fs.writeFileSync(same,'BBBB');fs.utimesSync(same,(past+900)/1000,(past+900)/1000);
        const second=await get('/same.txt');
        test('same-second LM coarse but ETag precise',()=>{
            assert.equal(first.headers['last-modified'],second.headers['last-modified']);assert.notEqual(first.headers.etag,second.headers.etag);
        });
        const dateOnly=await get('/same.txt',{'if-modified-since':first.headers['last-modified']});
        const tagged=await get('/same.txt',{'if-modified-since':first.headers['last-modified'],'if-none-match':first.headers.etag});
        test('same-second ETag precedence',()=>{assert.equal(dateOnly.status,304);assert.equal(tagged.status,200);assert.equal(tagged.body.toString(),'BBBB');});
        const futureFirst=await get('/future.txt');await control({now:now+2000});
        const futureSecond=await get('/future.txt');
        test('moving clamp preserves ETag',()=>{
            assert.equal(futureSecond.headers['last-modified'],date(now+2000));assert.equal(futureSecond.headers.date,date(now+2000));
            assert.equal(futureFirst.headers.etag,futureSecond.headers.etag);
        });
        for(const [field,status] of [['if-modified-since',200],['if-unmodified-since',412]]) {
            const r=await get('/future.txt',{[field]:futureFirst.headers['last-modified']});test('moving clamp '+field,()=>assert.equal(r.status,status));
        }
        await control({now:future+2000});const caught=await get('/future.txt');
        test('clock catches up',()=>assert.equal(caught.headers['last-modified'],date(future)));await control({now});
        const media=await get('/media.mp4');
        for(const [ifRange,status] of [[media.headers.etag,206],['"wrong"',200],[media.headers['last-modified'],200],[date(future),200]]) {
            const r=await get('/media.mp4',{range:'bytes=2-5','if-range':ifRange});
            test('If-Range '+ifRange,()=>{assert.equal(r.status,status);assert.deepEqual(r.body,status===206?bytes.subarray(2,6):bytes);});
        }
        const dynamic=await get('/servlet.jss',{'if-modified-since':date(future),'if-unmodified-since':date(0)});
        test('servlet untouched',()=>{assert.equal(dynamic.status,200);assert.equal(dynamic.headers['last-modified'],undefined);assert.equal(dynamic.body.toString(),'dynamic');});
        await control({caching:false});const uncached=await get();
        const condition=await get('/static.txt',{'if-modified-since':date(past)});
        test('caching policy and supplied conditions',()=>{assert.equal(uncached.headers['last-modified'],undefined);assert.equal(condition.status,304);});
        let state=await control();
        for(let i=0;state.descriptors&&i<20;i++){await new Promise(r=>setTimeout(r,10));state=await control();}
        test('all opened descriptors closed',()=>assert.equal(state.descriptors,0));
        test('no unexpected errors',()=>assert.equal(stderr,''));
    } finally {
        if(child.connected)child.send({stop:true});const timer=setTimeout(()=>child.kill(),5000);await exited;clearTimeout(timer);
    }
}
(async()=>{for(const [i,p] of ['http','https','h2c','h2s'].entries())await verify(p,i);
    console.log('All '+checks+' static date checks passed.');})()
    .catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
