const fs = require("fs");
const os = require("os");
const path = require("path");
const achieve = require("../../achieve");

const port = Number(process.env.ACHIEVE_CONDITIONAL_PORT || 8991);
const caching = process.env.ACHIEVE_CONDITIONAL_CACHING !== "false";
const compression = process.env.ACHIEVE_CONDITIONAL_COMPRESSION !== "false";
const applicationPath = fs.mkdtempSync(path.join(os.tmpdir(), "achieve-conditional-"));

function removeTree(target) {
    if (!fs.existsSync(target)) return;
    for (const entry of fs.readdirSync(target, {withFileTypes: true})) {
        const entryPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            removeTree(entryPath);
        } else {
            fs.unlinkSync(entryPath);
        }
    }
    fs.rmdirSync(target);
}

function copy(source, destination) {
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(source, destination);
}

copy(path.join(__dirname, "index.html"), path.join(applicationPath, "index.html"));
copy(path.join(__dirname, "conditional.js"), path.join(applicationPath, "conditional.js"));
copy(path.join(__dirname, "static", "resource.txt"), path.join(applicationPath, "static", "resource.txt"));
copy(path.join(__dirname, "servlets", "counter.jss"), path.join(applicationPath, "servlets", "counter.jss"));
copy(path.join(__dirname, "..", "media", "media", "mov_bbb.mp4"), path.join(applicationPath, "media", "sample.mp4"));

achieve.setAppPath(applicationPath);
achieve.setCaching(caching);
achieve.setCompress(compression);
const server = achieve.listen(port);

let closing = false;
function close() {
    if (closing) return;
    closing = true;
    if (server && server.listening) {
        server.close(function () {
            removeTree(applicationPath);
            process.exit();
        });
    } else {
        removeTree(applicationPath);
        process.exit();
    }
}

server.on("listening", function () { console.log("CONDITIONAL_READY " + port + " " + applicationPath); });
process.on("SIGINT", close);
process.on("SIGTERM", close);
process.on("exit", function () {
    removeTree(applicationPath);
});
