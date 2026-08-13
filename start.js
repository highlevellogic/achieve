const achieve = require('./achieve');
const path = require('node:path');

const appPath = path.join(__dirname, 'examples');
achieve.setAppPath(appPath);

achieve.listen(8989);

function controlledShutdown(reason) {
    achieve.shutdown(reason,function (err) {
        if (err) {
            console.error(
                "Achieve shutdown failed: " +
                (err && err.message ? err.message : String(err))
            );
            process.exitCode = 1;
        }
    });
}

process.on("SIGINT",function () {
    controlledShutdown("SIGINT");
});

process.on("SIGTERM",function () {
    controlledShutdown("SIGTERM");
});
