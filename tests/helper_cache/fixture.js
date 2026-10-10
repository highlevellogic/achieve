const achieve = require("../../achieve");

const port = Number(process.argv[2]);
const mode = process.argv[3];
const applicationPath = process.argv[4];

achieve.setMode(mode);
achieve.setLogging(false);
achieve.setAppPath(applicationPath);

const server = achieve.listen(port);
server.once("listening", function () {
    process.send({type: "listening"});
});

process.on("message", function (message) {
    if (message === "reset-app-path") {
        achieve.setAppPath(applicationPath);
        process.send({type: "app-path-reset"});
    } else if (message === "shutdown") {
        server.close(function () { process.exit(0); });
    }
});
