const http = require("http");
const path = require("path");
const achieve = require("../../achieve");

let nextPort = 19010;
let failures = 0;

function check(name, actual, expected) {
    const passed = actual === expected;
    console.log((passed ? "PASS" : "FAIL") + " " + name + ": " + JSON.stringify(actual));
    if (!passed) {
        console.log("     expected: " + JSON.stringify(expected));
        failures++;
    }
}

function listening(server) {
    if (server.listening) return Promise.resolve();
    return new Promise(resolve => server.once("listening", resolve));
}

function request(port, requestPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({port: port, path: requestPath}, res => {
            let content = "";
            res.setEncoding("utf8");
            res.on("data", chunk => content += chunk);
            res.on("end", () => resolve({status: res.statusCode, body: content}));
        });
        req.on("error", reject);
        req.end();
    });
}

async function withServer(run) {
    const port = nextPort++;
    const server = achieve.listen(port);
    if (!server) {
        check("expected server starts", false, true);
        return;
    }
    await listening(server);
    try {
        await run(port);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

(async function () {
    await withServer(async function (port) {
        const result = await request(port, "/fixtures/default.html");
        check("server project root is default app status", result.status, 200);
        check("server project root is default app", result.body.trim(), "default application");
    });

    let diagnostic = "";
    const originalError = console.error;
    console.error = function (message) {
        diagnostic += String(message);
    };
    try {
        achieve.setRootDir("ignored");
    } finally {
        console.error = originalError;
    }
    check(
        "setRootDir diagnostic",
        diagnostic,
        "ERROR: setRootDir() is no longer supported. Use setAppPath() instead."
    );

    await withServer(async function (port) {
        const result = await request(port, "/fixtures/default.html");
        check("setRootDir does not prevent startup", result.status, 200);
        check("setRootDir changes no configuration", result.body.trim(), "default application");
    });

    const configuredPath = path.join(__dirname, "..", "request_path", "application");
    achieve.setRootDir("still-ignored");
    achieve.setAppPath(configuredPath);
    await withServer(async function (port) {
        const result = await request(port, "/index.html");
        check("setAppPath override status", result.status, 200);
        check("setRootDir followed by setAppPath", result.body.indexOf("request-path root") !== -1, true);
    });

    if (failures) process.exitCode = 1;
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
