const cluster=require("node:cluster");
const os=require("node:os");
const path=require("node:path");

const port=Number(process.env.ACHIEVE_CLUSTER_PORT);
const workerCount=Number(process.env.ACHIEVE_CLUSTER_WORKERS);

if (cluster.isPrimary) {
    cluster.schedulingPolicy=cluster.SCHED_RR;
    let shuttingDown=false;
    const expectedExits=new Set();
    const metadata=new Map();

    function send(message) {
        if (process.send && process.connected) process.send(message);
    }
    function fork(slot,generation) {
        const worker=cluster.fork({
            ACHIEVE_CLUSTER_SLOT:String(slot),
            ACHIEVE_CLUSTER_GENERATION:String(generation)
        });
        metadata.set(worker.id,{slot,generation});
        worker.on("message",message=>send(Object.assign({},message,{
            clusterWorkerId:worker.id,pid:worker.process.pid,slot,generation
        })));
    }
    for(let slot=0;slot<workerCount;slot++) fork(slot,0);

    cluster.on("exit",function (worker,code,signal) {
        const info=metadata.get(worker.id);
        const expected=expectedExits.delete(worker.id) || shuttingDown;
        metadata.delete(worker.id);
        send({type:"worker-exit",clusterWorkerId:worker.id,pid:worker.process.pid,
            slot:info&&info.slot,generation:info&&info.generation,code,signal,expected});
        if (!expected) send({type:"unexpected-worker-exit",clusterWorkerId:worker.id,code,signal});
        if (!shuttingDown && info) fork(info.slot,info.generation+1);
        if (shuttingDown && Object.keys(cluster.workers).length===0) process.exit(0);
    });
    process.on("message",function (message) {
        if (!message) return;
        if (message.type==="retire") {
            const worker=cluster.workers[message.clusterWorkerId];
            if (!worker) return send({type:"command-error",message:"worker not found"});
            expectedExits.add(worker.id);
            worker.send({type:"retire"});
        } else if (message.type==="shutdown") {
            shuttingDown=true;
            const active=Object.values(cluster.workers);
            if (!active.length) process.exit(0);
            for(const worker of active) {
                expectedExits.add(worker.id);
                worker.send({type:"shutdown"});
            }
        }
    });
} else {
    const achieve=require(process.env.ACHIEVE_MODULE);
    achieve.setMode("production");
    achieve.setLogPath(process.env.ACHIEVE_CLUSTER_LOG_ROOT);
    achieve.setLogging("access");
    achieve.setAppPath(path.join(__dirname,"application"));
    const server=achieve.listen(port);
    if (!server) {
        if (process.send) process.send({type:"worker-failure",message:"listener did not start"});
        process.exitCode=1;
    } else {
        server.once("listening",()=>process.send && process.send({type:"worker-ready"}));
        let stopping=false;
        function stop() {
            if (stopping) return;
            stopping=true;
            server.close(()=>setTimeout(()=>process.exit(0),100));
        }
        process.on("message",message=>{
            if (message && (message.type==="retire" || message.type==="shutdown")) stop();
        });
        process.on("disconnect",stop);
    }
}
