const achieve = require("../../achieve");

const port = Number(process.argv[2]);
const mode = process.argv[3];
const applicationPath = process.argv[4];

achieve.setMode(mode);
achieve.setLogging(false);
achieve.setAppPath(applicationPath);

const server = achieve.listen(port);
if (!server) {
    process.send({type: "error", message: "listen() returned no server"});
} else {
    server.on("listening", function () {
        process.send({type: "listening", port});
    });
}

process.on("message", function (message) {
    if (message === "shutdown") {
        server.close(function (err) {
            process.send({type: "shutdown", error: err ? String(err) : ""});
        });
    }
});
