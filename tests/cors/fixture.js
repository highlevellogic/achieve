const path=require("node:path");
const achieve=require("../../achieve");

achieve.setMode("production");
achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"application"));
achieve.setCompress(true);

achieve.allowOrigins("http://allowed.example","/public/","*");
achieve.allowOrigins("http://star.example","*","*");
achieve.allowOrigins("http://longest.example","*","*");
achieve.allowOrigins("http://longest.example","/restricted/","allowed.txt");
achieve.allowOrigins("http://asset.example","/assets/","allowed.txt");
achieve.allowOrigins("http://json.example","/servlets/","*");
achieve.allowOrigins("http://directory.example","/docs/","index.html");

const server=achieve.listen(Number(process.env.ACHIEVE_CORS_PORT));
server.on("listening",function () {
    process.send({event:"ready"});
});

process.on("message",function (message) {
    if (message.command === "stop") {
        achieve.shutdown("cors verification complete",function () {
            process.exit();
        });
    }
});
