const path = require("path");
const achieve = require("../../achieve");

const port = Number(process.env.ACHIEVE_ROOT_MODE_PORT || 8990);

achieve.setAppPath(__dirname);
const server = achieve.listen(port);

if (!server) {
    console.error("Unable to start the application-directory demonstration server.");
    process.exitCode = 1;
} else {
    server.on("listening", function () {
        console.log("Application-directory demonstration ready: http://localhost:" + port + "/");
    });
}
