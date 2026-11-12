const cp=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");

const root=path.join(__dirname,"..","..");
const fixture=path.join(__dirname,"fixture.js");
const workerCount=Math.max(2,Math.min(4,os.availableParallelism()));
const port=24000+(process.pid%10000);
const initialRequests=600,transitionRequests=300,postReplacementRequests=300,concurrency=40;
let failures=0;
function check(name,condition,detail) {
    console.log((condition?"PASS ":"FAIL ")+name+(detail===undefined?"":": "+detail));
    if(!condition) failures++;
}
function delay(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }
function calculation(value) {
    let result=0;
    for(let number=1;number<=value;number++) result=(result+number*number)%1000000007;
    return result;
}
function startCluster(logRoot) {
    const child=cp.fork(fixture,[],{cwd:root,silent:true,env:Object.assign({},process.env,{
        ACHIEVE_MODULE:path.join(root,"achieve.js"),ACHIEVE_CLUSTER_PORT:String(port),
        ACHIEVE_CLUSTER_WORKERS:String(workerCount),ACHIEVE_CLUSTER_LOG_ROOT:logRoot
    })});
    let stdout="",stderr="",exited=false;
    const messages=[],waiters=[];
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data",data=>stdout+=data); child.stderr.on("data",data=>stderr+=data);
    child.on("message",message=>{
        messages.push(message);
        for(let index=waiters.length-1;index>=0;index--) {
            if(waiters[index].predicate(message)) {
                const waiter=waiters.splice(index,1)[0]; clearTimeout(waiter.timer); waiter.resolve(message);
            }
        }
    });
    child.on("exit",()=>exited=true);
    function waitFor(predicate,timeout=15000) {
        const existing=messages.find(predicate);
        if(existing) return Promise.resolve(existing);
        return new Promise((resolve,reject)=>{
            const waiter={predicate,resolve};
            waiter.timer=setTimeout(()=>{
                const index=waiters.indexOf(waiter); if(index>=0)waiters.splice(index,1);
                reject(new Error("cluster message timeout\n"+stdout+stderr));
            },timeout);
            waiters.push(waiter);
        });
    }
    return {child,messages,waitFor,stdout:()=>stdout,stderr:()=>stderr,get exited(){return exited;}};
}
function request(target) {
    return new Promise((resolve,reject)=>{
        let done=false;
        const req=http.get({host:"127.0.0.1",port,path:target,agent:false},res=>{
            const chunks=[];res.on("data",chunk=>chunks.push(chunk));
            res.on("end",()=>{if(!done){done=true;resolve({status:res.statusCode,body:Buffer.concat(chunks)});}});
        });
        req.setTimeout(10000,()=>req.destroy(new Error("request timeout")));
        req.on("error",error=>{if(!done){done=true;reject(error);}});
    });
}
function target(phase,index) {
    return "/servlets/work.jss.cjs?id="+phase+"-"+String(index).padStart(4,"0")+
        "&value="+(1000+(index%97));
}
async function traffic(phase,count,expectedTargets,responses,requestErrors) {
    let next=0;
    async function lane() {
        while(true) {
            const index=next++; if(index>=count)return;
            const requestTarget=target(phase,index); expectedTargets.add(requestTarget);
            try {
                const response=await request(requestTarget);
                if(response.status!==200) return requestErrors.push({requestTarget,status:response.status});
                let data;
                try { data=JSON.parse(response.body.toString("utf8")); }
                catch(error){return requestErrors.push({requestTarget,error:"invalid JSON"});}
                const value=1000+(index%97);
                if(data.id!==phase+"-"+String(index).padStart(4,"0") || data.value!==value ||
                    data.result!==calculation(value) || !Number.isInteger(data.pid) ||
                    !Number.isInteger(data.workerId)) {
                    requestErrors.push({requestTarget,error:"invalid response",data});
                } else responses.push(data);
            } catch(error) { requestErrors.push({requestTarget,error:error.message}); }
        }
    }
    await Promise.all(Array.from({length:concurrency},lane));
}
function logFiles(logRoot) {
    const directory=path.join(logRoot,"access");
    return fs.existsSync(directory)?fs.readdirSync(directory).map(name=>path.join(directory,name)):[];
}
function logLines(logRoot) {
    return logFiles(logRoot).flatMap(file=>fs.readFileSync(file,"utf8").split(/\r?\n/).filter(Boolean));
}
function logTarget(line) { const match=/ target="([^"]+)" /.exec(line);return match&&match[1]; }
async function waitForLogs(logRoot,count) {
    const deadline=Date.now()+15000;let records=[];
    while(Date.now()<deadline){records=logLines(logRoot);if(records.length>=count)return records;await delay(25);}
    return records;
}
async function stopCluster(controller) {
    if(controller.exited)return;
    controller.child.send({type:"shutdown"});
    for(let attempt=0;attempt<50&&!controller.exited;attempt++)await delay(100);
    if(!controller.exited) {
        if(process.platform==="win32") cp.spawnSync("taskkill",["/PID",String(controller.child.pid),"/T","/F"],{windowsHide:true});
        else controller.child.kill("SIGKILL");
    }
}
(async()=>{
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-cluster-"));
    const logRoot=path.join(temp,"logs"),controller=startCluster(logRoot);
    const expectedTargets=new Set(),responses=[],requestErrors=[];
    try {
        const ready=[];
        while(ready.length<workerCount) {
            const message=await controller.waitFor(message=>message.type==="worker-ready"&&
                !ready.some(item=>item.clusterWorkerId===message.clusterWorkerId));
            ready.push(message);
        }
        check("all cluster workers reached the shared listener",ready.length===workerCount,ready.length);
        await traffic("initial",initialRequests,expectedTargets,responses,requestErrors);
        const initialPids=new Set(responses.map(response=>response.pid));
        check("multiple workers handled initial requests",initialPids.size>1,Array.from(initialPids).join(","));
        check("application response integrity before retirement",requestErrors.length===0,requestErrors.length);

        const retiring=ready.find(item=>initialPids.has(item.pid))||ready[0];
        controller.child.send({type:"retire",clusterWorkerId:retiring.clusterWorkerId});
        const transition=traffic("transition",transitionRequests,expectedTargets,responses,requestErrors);
        const exit=await controller.waitFor(message=>message.type==="worker-exit"&&
            message.clusterWorkerId===retiring.clusterWorkerId);
        const replacement=await controller.waitFor(message=>message.type==="worker-ready"&&
            message.slot===retiring.slot&&message.generation===retiring.generation+1);
        await transition;
        check("selected worker exited as requested",exit.expected===true,JSON.stringify(exit));
        check("replacement worker has a new process",replacement.pid!==retiring.pid,
            retiring.pid+" -> "+replacement.pid);
        check("requests completed during worker replacement",requestErrors.length===0,requestErrors.length);

        const postStart=responses.length;
        await traffic("replacement",postReplacementRequests,expectedTargets,responses,requestErrors);
        const postResponses=responses.slice(postStart);
        check("replacement worker executed application code",
            postResponses.some(response=>response.pid===replacement.pid),replacement.pid);
        check("all HTTP responses were intact",requestErrors.length===0,requestErrors.length);
        check("application ran in cluster workers",responses.every(response=>
            response.workerId>0&&response.pid!==controller.child.pid),responses.length);

        const records=await waitForLogs(logRoot,expectedTargets.size);
        const pattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2} remote="[^"]+" method="GET" target="[^"]+" status=200 elapsed=\d+\.\d{3}ms state=complete$/;
        const counts=new Map();for(const line of records){const value=logTarget(line);counts.set(value,(counts.get(value)||0)+1);}
        const missing=Array.from(expectedTargets).filter(value=>!counts.has(value));
        const duplicate=Array.from(expectedTargets).filter(value=>(counts.get(value)||0)!==1);
        const unexpected=Array.from(counts.keys()).filter(value=>!expectedTargets.has(value));
        check("one shared access log file",logFiles(logRoot).length===1,logFiles(logRoot).length);
        check("one access record per completed request",
            records.length===expectedTargets.size,records.length+"/"+expectedTargets.size);
        check("no missing access records",missing.length===0,missing.length);
        check("no duplicate access records",duplicate.length===0,duplicate.length);
        check("no unexpected access records",unexpected.length===0,unexpected.length);
        check("all access records are intact",records.every(line=>pattern.test(line)),
            records.filter(line=>!pattern.test(line)).length);
        check("no unexpected worker failures",
            !controller.messages.some(message=>message.type==="unexpected-worker-exit"));
        check("cluster primary remained active",!controller.exited);
    } finally {
        await stopCluster(controller);
        fs.rmSync(temp,{recursive:true,force:true});
    }
    check("cluster process stopped",controller.exited);
    check("temporary directory removed",!fs.existsSync(temp));
    if(failures){console.error(failures+" cluster integration assertion(s) failed.");process.exitCode=1;}
    else console.log("All Node.js cluster integration assertions passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
