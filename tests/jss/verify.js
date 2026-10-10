const assert = require("node:assert");
const http = require("node:http");
const path = require("node:path");
const { fork } = require("node:child_process");

const port = 24660;
const serverPath = path.join(__dirname, "..", "server.js");

function request(requestPath) {
    return new Promise(function (resolve, reject) {
        const req = http.request({port, path: requestPath}, function (res) {
            const chunks = [];
            res.on("data", function (chunk) { chunks.push(chunk); });
            res.on("end", function () {
                resolve({
                    status: res.statusCode,
                    body: Buffer.concat(chunks).toString("utf8")
                });
            });
        });
        req.setTimeout(5000, function () { req.destroy(new Error("request timeout")); });
        req.on("error", reject);
        req.end();
    });
}

function startServer() {
    return new Promise(function (resolve, reject) {
        const child = fork(serverPath, [], {
            env: Object.assign({}, process.env, {ACHIEVE_TEST_PORT: String(port)}),
            stdio: ["ignore", "pipe", "pipe", "ipc"]
        });
        let output = "";
        const timer = setTimeout(function () {
            child.kill();
            reject(new Error("JSS test server startup timeout\n" + output));
        }, 5000);
        child.stdout.on("data", function (chunk) {
            output += chunk.toString();
            if (output.includes("Engineering test fixtures ready:")) {
                clearTimeout(timer);
                resolve(child);
            }
        });
        child.stderr.on("data", function (chunk) { output += chunk.toString(); });
        child.once("error", function (err) {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function stopServer(child) {
    return new Promise(function (resolve) {
        child.once("exit", resolve);
        child.kill();
    });
}

(async function () {
    const child = await startServer();
    try {
        let result = await request("/jss/jss_only/servlets/hello.jss");
        assert.strictEqual(result.status, 200);
        assert(result.body.includes("Hello from hello.jss"));

        result = await request("/jss/both/servlets/hello.jss");
        assert.strictEqual(result.status, 200);
        assert(result.body.includes("Hello from hello.jss"));

        result = await request("/jss/index_defaults/jss_only/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body.trim(), "PASS: index.jss executed");

        result = await request("/jss/index_defaults/jss_beats_js/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body.trim(), "PASS: index.jss beat index.js");

        result = await request("/jss/index_defaults/html_beats_jss/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body.trim(), "PASS: index.html beat index.jss");

        result = await request("/jss/index_defaults/htm_beats_jss/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body.trim(), "PASS: index.htm beat index.jss");

        result = await request("/jss/index_defaults/js_only/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body.trim(), "PASS: legacy index.js executed");

        result = await request("/jss/source_protection/servlets/hello.jss?x=one");
        assert.strictEqual(result.status, 200);
        assert(result.body.includes("x=one"));
        assert(!result.body.includes("JSS_SOURCE_MUST_NEVER_BE_SERVED"));

        result = await request("/jss/source_protection/servlets/noexport.jss");
        assert.strictEqual(result.status, 500);
        assert(!result.body.includes("JSS_SOURCE_MUST_NEVER_BE_SERVED"));

        result = await request("/jss/source_protection/servlets/syntax-error.jss");
        assert.strictEqual(result.status, 500);
        assert(!result.body.includes("JSS_SOURCE_MUST_NEVER_BE_SERVED"));

        result = await request("/jss/source_protection/static/index.html");
        assert.strictEqual(result.status, 200);
        assert(result.body.includes("static html response"));

        console.log("PASS: JSS shorthand and source-protection verification");
    } finally {
        await stopServer(child);
    }
}()).catch(function (err) {
    console.error(err.stack || err);
    process.exitCode = 1;
});
