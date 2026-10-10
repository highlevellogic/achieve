const achieve = require("../../achieve");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.argv[2]);
const mode = process.argv[3];
const applicationPath = process.argv[4];
const cjsHelpers = new Set(["loaded.jss.cjs", "loaded.jss", "legacy.js", "documented.js"]
    .map(name => path.join(applicationPath, "servlets", name)));
const esmHelper = path.join(applicationPath, "servlets", "loaded.jss.mjs");
let cjsHelperStats = 0;
let esmHelperStats = 0;
const statSync = fs.statSync;
fs.statSync = function (file, ...options) {
    if (typeof file === "string" && cjsHelpers.has(path.resolve(file))) cjsHelperStats++;
    if (typeof file === "string" && path.resolve(file) === esmHelper) esmHelperStats++;
    return statSync.call(this, file, ...options);
};

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
    if (message === "cjs-helper-stats") {
        process.send({type: "cjs-helper-stats", count: cjsHelperStats});
        cjsHelperStats = 0;
        return;
    }
    if (message === "esm-helper-stats") {
        process.send({type: "esm-helper-stats", count: esmHelperStats});
        esmHelperStats = 0;
        return;
    }
    if (message === "shutdown") {
        server.close(function (err) {
            process.send({type: "shutdown", error: err ? String(err) : ""});
        });
    }
});
