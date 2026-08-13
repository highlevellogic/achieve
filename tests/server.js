const achieve = require("../achieve");
const path = require("node:path");

const port = Number(process.env.ACHIEVE_TEST_PORT || 8988);

achieve.setAppPath(path.join(__dirname));
const server = achieve.listen(port);

if (!server) {
    console.error("Unable to start the engineering test server.");
    process.exitCode = 1;
} else {
    server.on("listening", function () {
        console.log("Engineering test fixtures ready: http://localhost:" + port + "/");
    });
}
