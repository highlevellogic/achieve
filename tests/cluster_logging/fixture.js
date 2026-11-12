const path=require("node:path");
const achieve=require(process.env.ACHIEVE_MODULE);
const port=Number(process.env.ACHIEVE_PORT);
achieve.setMode("production");
achieve.setLogPath(process.env.ACHIEVE_LOG_ROOT);
achieve.setLogging("access");
achieve.setAppPath(path.join(__dirname,"..","logging","application"));
const server=achieve.listen(port);
if (!server) {
    if (process.send) process.send({type:"failure"});
    process.exitCode=1;
} else {
    server.once("listening",()=>process.send && process.send({type:"ready"}));
    let stopping=false;
    function stop() {
        if (stopping) return;
        stopping=true;
        server.close(()=>setTimeout(()=>process.exit(0),100));
    }
    process.on("SIGTERM",stop);
    process.on("SIGINT",stop);
}
