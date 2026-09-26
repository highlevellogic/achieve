const achieve = require("../../achieve");

const port = Number(process.argv[2]);
const applicationPath = process.argv[3];

achieve.setMode("production");
achieve.setLogging(false);
achieve.setAppPath(applicationPath);

const server = achieve.listen(port);
server.once("listening", function () {
    process.send({type:"listening"});
});

process.on("message", function (message) {
    if (message.type === "set-app-path") {
        achieve.setAppPath(message.path);
        process.send({type:"app-path-set"});
    } else if (message.type === "shutdown") {
        server.close(function () { process.exit(0); });
    }
});
