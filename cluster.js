const cluster = require("node:cluster");
const os = require("node:os");

const workers = os.availableParallelism();

if (cluster.isPrimary) {

    console.log("Starting Achieve with " + workers + " workers.");

    for (let i = 0; i < workers; i++) {
        cluster.fork();
    }

} else {

    const achieve = require("./achieve");
	const path = require('node:path');

    // -----------------------------
    // YOUR NORMAL ACHIEVE CONFIG
    // -----------------------------

    achieve.setMode("production");

    const appPath = path.join(__dirname, 'examples');
    achieve.setAppPath(appPath);

    achieve.setLogging(false);

    achieve.listen(8989);

    // -----------------------------

    console.log(
        "Achieve worker " +
        process.pid +
        " listening on port 8989"
    );
}