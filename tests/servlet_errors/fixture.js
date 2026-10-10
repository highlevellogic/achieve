const path=require("node:path");
const achieve=require("../../achieve");

achieve.setMode("development");
achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"application"));

const server=achieve.listen(Number(process.env.ACHIEVE_SERVLET_ERROR_PORT));
server.on("listening",function () {
    process.send({event:"ready"});
});

process.on("message",function (message) {
    if (message === "stop") {
        server.close(function () {
            process.exit();
        });
    }
});
