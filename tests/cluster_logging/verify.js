const cp=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const root=path.join(__dirname,"..","..");
const fixture=path.join(__dirname,"fixture.js");
const modulePath=path.join(root,"achieve.js");
const body=fs.readFileSync(path.join(__dirname,"..","logging","application","resource.txt"));
const workers=Math.max(4,Math.min(8,os.availableParallelism()));
const repetitions=3, ordered=50, burst=450, lanes=10, basePort=23120;
const marker="x".repeat(256);
let failures=0;
function check(name,ok,detail) {
    console.log((ok?"PASS ":"FAIL ")+name+(detail===undefined?"":": "+detail));
    if (!ok) failures++;
}
function sleep(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }
function target(worker,phase,lane,sequence) {
    return "/resource.txt?worker="+worker+"&phase="+phase+"&lane="+lane+
        "&sequence="+String(sequence).padStart(4,"0")+"&marker="+marker;
}
function start(worker,port,logRoot) {
    return new Promise((resolve,reject)=>{
        const child=cp.fork(fixture,[],{cwd:root,silent:true,env:Object.assign({},process.env,{
            ACHIEVE_MODULE:modulePath,ACHIEVE_PORT:String(port),ACHIEVE_LOG_ROOT:logRoot
        })});
        let stderr="",settled=false;
        child.stderr.setEncoding("utf8"); child.stderr.on("data",data=>stderr+=data);
        child.on("message",message=>{
            if (settled) return;
            if (message.type==="ready") { settled=true; resolve({worker,port,child,stderr:()=>stderr}); }
            else if (message.type==="failure") { settled=true; reject(new Error("worker listener failed")); }
        });
        child.on("error",reject);
        child.on("exit",(code,signal)=>{
            if (!settled) { settled=true; reject(new Error("worker "+worker+" exited "+code+" "+signal+" "+stderr)); }
        });
        setTimeout(()=>{if(!settled){settled=true;child.kill();reject(new Error("worker startup timeout"));}},10000).unref();
    });
}
function stop(worker) {
    return new Promise(resolve=>{
        if (worker.child.exitCode!==null) return resolve({code:worker.child.exitCode,signal:null,forced:false});
        let forced=false;
        const timer=setTimeout(()=>{forced=true;worker.child.kill("SIGKILL");},5000);
        worker.child.once("exit",(code,signal)=>{clearTimeout(timer);resolve({code,signal,forced});});
        worker.child.kill("SIGTERM");
    });
}
function get(agent,port,url) {
    return new Promise((resolve,reject)=>{
        let done=false;
        const req=http.get({host:"127.0.0.1",port,path:url,agent},res=>{
            const chunks=[]; res.on("data",chunk=>chunks.push(chunk));
            res.on("end",()=>{if(!done){done=true;resolve({status:res.statusCode,body:Buffer.concat(chunks)});}});
        });
        req.setTimeout(10000,()=>req.destroy(new Error("request timeout")));
        req.on("error",error=>{if(!done){done=true;reject(error);}});
    });
}
async function send(agent,worker,url,expected,httpErrors) {
    expected.add(url);
    try {
        const response=await get(agent,worker.port,url);
        if (response.status!==200 || !response.body.equals(body)) httpErrors.push(url);
    } catch (error) { httpErrors.push(url+" "+error.message); }
}
async function traffic(worker,agent,expected,httpErrors) {
    for(let n=0;n<ordered;n++) await send(agent,worker,target(worker.worker,"ordered",0,n),expected,httpErrors);
    let next=0;
    async function lane(laneNumber) {
        while(true) {
            const n=next++; if(n>=burst) return;
            await send(agent,worker,target(worker.worker,"burst",laneNumber,n),expected,httpErrors);
        }
    }
    await Promise.all(Array.from({length:lanes},(_,n)=>lane(n)));
}
function files(logRoot) {
    const dir=path.join(logRoot,"access");
    return fs.existsSync(dir)?fs.readdirSync(dir).map(name=>path.join(dir,name)):[];
}
function lines(logRoot) {
    return files(logRoot).flatMap(file=>fs.readFileSync(file,"utf8").split(/\r?\n/).filter(Boolean));
}
function loggedTarget(line) { const match=/ target="([^"]*)" /.exec(line); return match&&match[1]; }
async function awaitLines(logRoot,count) {
    const until=Date.now()+15000; let result=[];
    while(Date.now()<until) { result=lines(logRoot); if(result.length>=count)return result; await sleep(25); }
    return result;
}
function inspect(records,expected) {
    const pattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2} remote="[^"]+" method="GET" target="[^"]+" status=200 elapsed=\d+\.\d{3}ms state=complete$/;
    const counts=new Map(),malformed=records.filter(line=>!pattern.test(line));
    for(const line of records) { const value=loggedTarget(line); counts.set(value,(counts.get(value)||0)+1); }
    const missing=[],duplicates=[];
    for(const value of expected) { const count=counts.get(value)||0; if(!count)missing.push(value); if(count>1)duplicates.push(value); }
    const unexpected=Array.from(counts.keys()).filter(value=>!expected.has(value));
    const orderFailures=[];
    for(let worker=0;worker<workers;worker++) {
        let index=-1;
        for(let n=0;n<ordered;n++) {
            const expectedTarget=target(worker,"ordered",0,n);
            index=records.findIndex((line,i)=>i>index&&loggedTarget(line)===expectedTarget);
            if(index<0){orderFailures.push(worker);break;}
        }
    }
    return {malformed,missing,duplicates,unexpected,orderFailures};
}
async function run(number,temp) {
    const logRoot=path.join(temp,"run-"+number),children=[],agents=[];
    const expected=new Set(),httpErrors=[];
    try {
        for(let n=0;n<workers;n++) {
            children.push(await start(n,basePort+n,logRoot));
            agents.push(new http.Agent({keepAlive:true,maxSockets:lanes}));
        }
        await Promise.all(children.map((child,n)=>traffic(child,agents[n],expected,httpErrors)));
        agents.forEach(agent=>agent.destroy());
        const records=await awaitLines(logRoot,expected.size),result=inspect(records,expected);
        check("run "+number+" HTTP responses",!httpErrors.length,httpErrors.length);
        check("run "+number+" record count",records.length===expected.size,records.length+"/"+expected.size);
        check("run "+number+" no missing records",!result.missing.length,result.missing.length);
        check("run "+number+" no duplicates",!result.duplicates.length,result.duplicates.length);
        check("run "+number+" no unexpected records",!result.unexpected.length,result.unexpected.length);
        check("run "+number+" intact records",!result.malformed.length,result.malformed.length);
        check("run "+number+" per-worker order",!result.orderFailures.length,result.orderFailures.length);
        check("run "+number+" one shared log file",files(logRoot).length===1,files(logRoot).length);
    } finally {
        agents.forEach(agent=>agent.destroy());
        const exits=await Promise.all(children.map(stop));
        const clean=exits.every(exit=>!exit.forced &&
            (exit.code===0 || (process.platform==="win32" && exit.signal==="SIGTERM")));
        check("run "+number+" workers stopped without forced cleanup",clean,JSON.stringify(exits));
        for(const child of children) check("run "+number+" worker "+child.worker+" no logging error",
            !/logging failed/i.test(child.stderr()),child.stderr().trim());
    }
}
(async()=>{
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-cluster-logging-"));
    console.log("workers="+workers+" requests-per-worker="+(ordered+burst)+
        " repetitions="+repetitions+" total="+(workers*(ordered+burst)*repetitions));
    try { for(let n=1;n<=repetitions;n++) await run(n,temp); }
    finally { fs.rmSync(temp,{recursive:true,force:true}); }
    check("temporary directory removed",!fs.existsSync(temp));
    if(failures){console.error(failures+" cluster logging assertion(s) failed.");process.exitCode=1;}
    else console.log("All cluster logging stress assertions passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
