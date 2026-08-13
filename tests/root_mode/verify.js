const fs = require("fs");
const http = require("http");
const os = require("os");
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

function listening(server) {
    if (server.listening) return Promise.resolve();
    return new Promise(resolve => server.once("listening", resolve));
}

function request(port, method, requestPath, body) {
    return new Promise((resolve, reject) => {
        const req = http.request({port: port, method: method, path: requestPath}, res => {
            let content = "";
            res.setEncoding("utf8");
            res.on("data", chunk => content += chunk);
            res.on("end", () => resolve({status: res.statusCode, body: content}));
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

async function withServer(configure, run) {
    configure();
    const port = nextPort++;
    const server = achieve.listen(port);
    if (!server) {
        check("expected server starts", false, true);
        return false;
    }
    await listening(server);
    try {
        await run(port);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
    return true;
}

(async function () {
    const fixturePath = __dirname;

    await withServer(function () {
        achieve.setAppPath(fixturePath);
        achieve.useRoot(false);
    }, async function (port) {
        const result = await request(port, "GET", "/index.html");
        check("useRoot(false) serves appPath directly", result.status, 200);
        check("simple-mode setup page", result.body.indexOf("complete Achieve application space") !== -1, true);
    });

    await withServer(function () {
        achieve.setAppPath(fixturePath);
        achieve.useRoot(true);
    }, async function (port) {
        let result = await request(port, "GET", "/");
        check("ROOT owns /", result.status, 200);
        check("ROOT page body", result.body.indexOf("ROOT application") !== -1, true);

        result = await request(port, "GET", "/servlets/hello");
        check("ROOT .jss status", result.status, 200);
        check("ROOT .jss", result.body, "ROOT .jss servlet");

        result = await request(port, "GET", "/servlets/legacy");
        check("ROOT legacy .js status", result.status, 200);
        check("ROOT legacy .js", result.body, "ROOT legacy .js servlet");

        result = await request(port, "GET", "/accounting/collision.txt");
        check("named sibling precedence status", result.status, 200);
        check("named sibling precedence", result.body.trim(), "accounting collision");

        result = await request(port, "GET", "/accounting/missing.txt");
        check("no ROOT fallback status", result.status, 404);
        check("no ROOT fallback body", result.body.indexOf("ROOT fallback must not be served") === -1, true);

        result = await request(port, "HEAD", "/accounting/collision.txt");
        check("named application HEAD", result.status, 200);
        check("HEAD body suppressed", result.body, "");

        result = await request(port, "POST", "/accounting/servlets/hello", "value=1");
        check("named application POST status", result.status, 200);
        check("named application POST", result.body, "accounting .jss servlet");
    });

    await withServer(function () {
        achieve.useRoot(true);
        achieve.setAppPath(fixturePath);
    }, async function (port) {
        const result = await request(port, "GET", "/index.html");
        check("useRoot then setAppPath status", result.status, 200);
        check("useRoot then setAppPath order", result.body.indexOf("ROOT application") !== -1, true);
    });

    const temporaryPath = fs.mkdtempSync(path.join(os.tmpdir(), "achieve-root-config-"));
    try {
        const missingPath = path.join(temporaryPath, "missing");
        fs.mkdirSync(missingPath);
        achieve.setAppPath(missingPath);
        achieve.useRoot(true);
        check("missing ROOT refuses startup", achieve.listen(nextPort++), undefined);

        const filePath = path.join(temporaryPath, "file");
        fs.mkdirSync(filePath);
        fs.writeFileSync(path.join(filePath, "ROOT"), "not a directory");
        achieve.setAppPath(filePath);
        check("ROOT as file refuses startup", achieve.listen(nextPort++), undefined);
    } finally {
        removeTree(temporaryPath);
    }

    check("setRootDir removed", typeof achieve.setRootDir, "undefined");
    if (failures) process.exitCode = 1;
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
