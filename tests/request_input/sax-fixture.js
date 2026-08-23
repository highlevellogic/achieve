const path=require("node:path");
const achieve=require("../../achieve");

achieve.setMode("production");
achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"..","..","examples","advanced","xml"));

const server=achieve.listen(Number(process.env.ACHIEVE_REQUEST_INPUT_PORT));
server.on("listening",function () {
    process.send({event:"ready"});
});

process.on("message",function (message) {
    if (message.command === "stop") {
        achieve.shutdown("SAX input verification complete",function () {
            process.exit();
        });
    }
});
