const path=require("node:path");
const achieve=require("../../achieve");

achieve.setMode("production");
achieve.setLogging("console");
achieve.setAppPath(path.join(__dirname,"..","request_input","application"));

const server=achieve.listen(Number(process.env.ACHIEVE_POST_CONTENT_TYPE_PORT));
server.on("listening",function () {
    if (process.send) process.send({event:"ready"});
});

process.on("message",function (message) {
    if (message.command === "stop") server.close(function () { process.exit(); });
});
