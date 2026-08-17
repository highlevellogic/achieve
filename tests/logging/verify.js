const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const http2 = require("http2");
const os = require("os");
const path = require("path");

const repositoryPath = path.join(__dirname, "..", "..");
const achieveModule = path.join(repositoryPath, "achieve.js");
const applicationPath = path.join(repositoryPath, "examples");
const fixturePath = path.join(__dirname, "fixture.js");
let nextPort = 19030;
let failures = 0;

function check(name, condition, detail) {
    console.log((condition ? "PASS" : "FAIL") + " " + name +
        (detail === undefined ? "" : ": " + detail));
    if (!condition) failures++;
}

function request(port, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            port: port,
            path: options.path || "/",
            method: options.method || "GET",
            headers: options.headers || {}
        }, function (res) {
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", function () {
                resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks)});
            });
        });
        req.on("error", reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

function abortRequest(port, requestPath) {
    return new Promise(resolve => {
        const req = http.request({port: port, path: requestPath}, function (res) {
            res.resume();
        });
        req.on("error", function () {});
        req.on("close", resolve);
        req.end();
        setTimeout(function () {
            req.destroy();
        }, 50);
    });
}

function http2Request(port, requestPath) {
    return new Promise((resolve, reject) => {
        const client = http2.connect("http://localhost:" + port);
        const req = client.request({":path": requestPath});
        const chunks = [];
        let status;
        req.on("response", headers => status = headers[":status"]);
        req.on("data", chunk => chunks.push(chunk));
        req.on("end", function () {
            client.close();
            resolve({status: status, body: Buffer.concat(chunks)});
        });
        req.on("error", function (err) {
            client.destroy();
            reject(err);
        });
        req.end();
    });
}

function startCase(scenario, options = {}) {
    return new Promise((resolve, reject) => {
        const script = options.fixturePath || fixturePath;
        const child = childProcess.spawn(process.execPath, [script], {
            cwd: options.cwd || repositoryPath,
            env: Object.assign({}, process.env, {
                ACHIEVE_MODULE: achieveModule,
                ACHIEVE_APP_PATH: options.appPath || applicationPath,
                ACHIEVE_LOGGING_SCENARIO: scenario,
                ACHIEVE_LOGGING_PORT: String(nextPort++),
                ACHIEVE_LOG_PATH: options.logPath || "",
                ACHIEVE_INJECT_STREAM_ERROR: options.injectStreamError ? "true" : "false",
                ACHIEVE_INJECT_STREAM_ERROR_CATEGORY: options.injectStreamErrorCategory || ""
            }),
            stdio: ["ignore", "pipe", "pipe", "ipc"]
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", data => stdout += data);
        child.stderr.on("data", data => stderr += data);
        child.on("message", message => {
            if (!settled && (message.type === "ready" || message.type === "checks" || message.type === "startup-result" || message.type === "failure")) {
                settled = true;
                resolve({child: child, message: message, stdout: () => stdout, stderr: () => stderr});
            }
        });
        child.on("error", reject);
        child.on("exit", code => {
            if (!settled) reject(new Error(scenario + " exited before reporting readiness: " + code + "\n" + stderr));
        });
        setTimeout(function () {
            if (!settled) {
                settled = true;
                child.kill();
                reject(new Error(scenario + " timed out\n" + stdout + stderr));
            }
        }, 5000).unref();
    });
}

function stopCase(testCase) {
    return new Promise(resolve => {
        if (testCase.child.exitCode !== null) return resolve();
        testCase.child.once("exit", resolve);
        testCase.child.kill();
    });
}

function serverLogFiles(root) {
    const directory = path.join(root, "server");
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).map(name => path.join(directory, name));
}

function accessLogFiles(root) {
    const directory = path.join(root, "access");
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).map(name => path.join(directory, name));
}

function accessRecords(root) {
    const files = accessLogFiles(root);
    if (!files.length) return [];
    return fs.readFileSync(files[0], "utf8").trim().split(/\r?\n/).filter(Boolean);
}

function recordsForTarget(records, target) {
    return records.filter(record => record.includes(' target="' + target + '" '));
}

function removeTree(target) {
    if (!fs.existsSync(target)) return;
    for (const entry of fs.readdirSync(target, {withFileTypes: true})) {
        const entryPath = path.join(target, entry.name);
        if (entry.isDirectory()) removeTree(entryPath);
        else fs.unlinkSync(entryPath);
    }
    fs.rmdirSync(target);
}

async function runningCase(scenario, options, inspect) {
    const testCase = await startCase(scenario, options);
    try {
        check(scenario + " listener started", testCase.message.type === "ready");
        if (testCase.message.type === "ready") {
            const response = await request(testCase.message.port);
            await new Promise(resolve => setTimeout(resolve, 175));
            check(scenario + " HTTP service", response.status === 200, response.status);
            await inspect(testCase, response);
        }
    } finally {
        await stopCase(testCase);
    }
}

(async function () {
    const temporaryPath = fs.mkdtempSync(path.join(os.tmpdir(), "achieve-logging-"));
    try {
        const invalid = await startCase("invalid-api");
        await stopCase(invalid);
        check("invalid mode throws", invalid.message.checks.mode);
        check("zero-argument logging throws", invalid.message.checks.zero);
        check("mixed logging form throws", invalid.message.checks.mixed);
        check("unknown destination throws", invalid.message.checks.unknown);

        const defaultRoot = path.join(temporaryPath, "default");
        await runningCase("default", {logPath: defaultRoot}, async function (testCase) {
            check("default mode is development", testCase.stdout().includes("mode=development"));
            check("default console logging is on", testCase.stdout().includes("logging console=on server=off access=off"));
            check("development request trace is visible", testCase.stdout().includes("GET") && testCase.stdout().includes("req.url:"));
            check("default server logging creates no files", serverLogFiles(defaultRoot).length === 0);
            check("configuration locks after startup", Object.values(testCase.message.checks).every(Boolean));
            const getResult = await request(testCase.message.port, {path: "/get/servlets/hello.jss"});
            const headResult = await request(testCase.message.port, {method: "HEAD", path: "/head/servlets/hello.jss"});
            const postResult = await request(testCase.message.port, {method: "POST", path: "/post/servlets/hello.jss", body: "value=1"});
            const containmentResult = await request(testCase.message.port, {path: "/..%2fpackage.json"});
            check("GET .jss regression", getResult.status === 200 && getResult.body.toString().includes("Hello World"));
            check("HEAD regression", headResult.status === 200 && headResult.body.length === 0);
            check("POST .jss regression", postResult.status === 200 && postResult.body.toString().includes("Hello World"));
            check("request containment regression", containmentResult.status >= 400 && !containmentResult.body.toString().includes('"name": "achieve"'));
        });

        const labelRoot = path.join(temporaryPath, "labels");
        await runningCase("labels", {
            logPath: labelRoot,
            appPath: path.join(__dirname, "application")
        }, async function (testCase) {
            let start = testCase.stdout().length;
            const getResult = await request(testCase.message.port, {path: "/servlets/lifecycle.jss"});
            await new Promise(resolve => setTimeout(resolve, 25));
            let trace = testCase.stdout().substring(start);
            check("GET lifecycle label", getResult.status === 200 && trace.includes("INFO: GET ") && !trace.includes("INFO: POST "));

            start = testCase.stdout().length;
            const headResult = await request(testCase.message.port, {method: "HEAD", path: "/servlets/lifecycle.jss"});
            await new Promise(resolve => setTimeout(resolve, 25));
            trace = testCase.stdout().substring(start);
            check("HEAD lifecycle label", headResult.status === 200 && trace.includes("INFO: HEAD ") && !trace.includes("INFO: GET ") && !trace.includes("INFO: POST "));

            start = testCase.stdout().length;
            const postResult = await request(testCase.message.port, {method: "POST", path: "/servlets/lifecycle.jss", body: "value=1"});
            await new Promise(resolve => setTimeout(resolve, 25));
            trace = testCase.stdout().substring(start);
            check("POST lifecycle label", postResult.status === 200 && trace.includes("INFO: POST ") && !trace.includes("INFO: GET "));
        });

        const accessRoot = path.join(temporaryPath, "access-suite");
        await runningCase("access-suite", {
            logPath: accessRoot,
            appPath: path.join(__dirname, "application")
        }, async function (testCase) {
            check("access-only creates no server directory", !fs.existsSync(path.join(accessRoot, "server")));
            check("access daily file created", accessLogFiles(accessRoot).length === 1);
            check("access daily filename", /^\d{4}-\d{2}-\d{2}\.log$/.test(path.basename(accessLogFiles(accessRoot)[0])));

            await request(testCase.message.port, {path: "/resource.txt?value=one"});
            await request(testCase.message.port, {method: "HEAD", path: "/resource.txt?head=true"});
            await request(testCase.message.port, {method: "GET", path: "/servlets/lifecycle.jss?method=get"});
            await request(testCase.message.port, {method: "POST", path: "/servlets/lifecycle.jss?method=post", body: "value=1"});
            await request(testCase.message.port, {path: "/directory"});

            const current = await request(testCase.message.port, {path: "/resource.txt?conditional=current"});
            await request(testCase.message.port, {
                path: "/resource.txt?conditional=304",
                headers: {"If-None-Match": current.headers.etag}
            });
            await request(testCase.message.port, {path: "/missing?status=404"});
            await request(testCase.message.port, {
                path: "/resource.txt?conditional=412",
                headers: {"If-Match": '"stale"'}
            });
            await request(testCase.message.port, {
                path: "/media/sample.mp4?status=416",
                headers: {Range: "bytes=999999-"}
            });
            await request(testCase.message.port, {
                path: "/media/sample.mp4?status=400",
                headers: {Range: "bytes=abc-def"}
            });
            await request(testCase.message.port, {path: "/servlets/lifecycle.jss?status=405"});
            await request(testCase.message.port, {path: "/servlets/lifecycle.jss?throw=true"});
            await request(testCase.message.port, {method: "PUT", path: "/resource.txt?status=501"});
            await abortRequest(testCase.message.port, "/servlets/lifecycle.jss?abort=true");
            await new Promise(resolve => setTimeout(resolve, 125));

            const records = accessRecords(accessRoot);
            const expected = [
                ["/resource.txt?value=one", "GET", 200, "complete"],
                ["/resource.txt?head=true", "HEAD", 200, "complete"],
                ["/servlets/lifecycle.jss?method=get", "GET", 200, "complete"],
                ["/servlets/lifecycle.jss?method=post", "POST", 200, "complete"],
                ["/directory", "GET", 301, "complete"],
                ["/resource.txt?conditional=304", "GET", 304, "complete"],
                ["/missing?status=404", "GET", 404, "complete"],
                ["/resource.txt?conditional=412", "GET", 412, "complete"],
                ["/media/sample.mp4?status=416", "GET", 416, "complete"],
                ["/media/sample.mp4?status=400", "GET", 400, "complete"],
                ["/servlets/lifecycle.jss?status=405", "GET", 405, "complete"],
                ["/servlets/lifecycle.jss?throw=true", "GET", 500, "complete"],
                ["/resource.txt?status=501", "PUT", 501, "complete"],
                ["/servlets/lifecycle.jss?abort=true", "GET", 200, "aborted"]
            ];

            for (const item of expected) {
                const matching = recordsForTarget(records, item[0]);
                check("one access record for " + item[0], matching.length === 1, matching.length);
                check(
                    "access fields for " + item[0],
                    matching.length === 1 &&
                    matching[0].includes(' method="' + item[1] + '" ') &&
                    matching[0].includes(" status=" + item[2] + " ") &&
                    matching[0].endsWith(" state=" + item[3]),
                    matching[0]
                );
            }

            check("access remote address present", records.every(record => {
                const match = / remote="([^"]*)" /.exec(record);
                return match && match[1] && match[1] !== "-";
            }));
            check("access elapsed time is nonnegative milliseconds", records.every(record => / elapsed=\d+\.\d{3}ms /.test(record)));
            check("access timestamp uses local offset", records.every(record => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2} /.test(record)));
            check("development trace absent from access log", records.every(record => !record.includes("req.url:") && !record.includes("using GET")));
            check("access records are not printed to console", testCase.stdout().trim() === "");
        });

        const productionRoot = path.join(temporaryPath, "production");
        await runningCase("production", {logPath: productionRoot}, async function (testCase) {
            check("production mode reported", testCase.stdout().includes("mode=production"));
            check("production request trace suppressed", !testCase.stdout().includes("req.url:") && !testCase.stdout().includes("using GET"));
        });

        const serverRoot = path.join(temporaryPath, "server");
        await runningCase("server", {logPath: serverRoot}, async function (testCase) {
            const files = serverLogFiles(serverRoot);
            check("server directory and daily file created", files.length === 1);
            check("local daily filename", files.length === 1 && /^\d{4}-\d{2}-\d{2}\.log$/.test(path.basename(files[0])));
            const log = files.length ? fs.readFileSync(files[0], "utf8") : "";
            const events = [" START ", " CONFIG ", " CONFIG ", " LISTEN "];
            let position = -1;
            const ordered = events.every(event => {
                position = log.indexOf(event, position + 1);
                return position !== -1;
            });
            check("startup records append in order", ordered, log);
            check("startup configuration persisted", log.includes("mode=development") && log.includes("appPath=") && log.includes("caching="));
            check("timestamp includes numeric offset", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}/m.test(log));
            check("development request trace absent from server file", !log.includes("req.url:") && !log.includes("using GET"));
            check("setAppPath did not move explicit log root", files.every(file => file.startsWith(serverRoot)));
        });

        for (const scenario of ["all", "duplicate", "selective", "invalid-preserves"]) {
            const root = path.join(temporaryPath, scenario);
            await runningCase(scenario, {logPath: root}, async function (testCase) {
                check(scenario + " enables server sink", serverLogFiles(root).length === 1);
                if (scenario === "all" || scenario === "selective") {
                    check(scenario + " enables access sink", accessLogFiles(root).length === 1);
                    const serverLog = fs.readFileSync(serverLogFiles(root)[0], "utf8");
                    const accessLog = fs.readFileSync(accessLogFiles(root)[0], "utf8");
                    check(scenario + " access records stay out of server log", !serverLog.includes(' remote="'));
                    check(scenario + " server events stay out of access log", !accessLog.includes(" START ") && !accessLog.includes(" CONFIG "));
                } else {
                    check(scenario + " leaves access disabled", !fs.existsSync(path.join(root, "access")));
                }
                if (scenario === "all") {
                    const log = fs.readFileSync(serverLogFiles(root)[0], "utf8");
                    check("setLogging(true) enables all selections", log.includes("console=on server=on access=on"));
                }
                if (scenario === "selective") {
                    const log = fs.readFileSync(serverLogFiles(root)[0], "utf8");
                    check("rest list is declarative", log.includes("console=off server=on access=on"));
                }
                if (scenario === "invalid-preserves") {
                    check("invalid call leaves prior state", testCase.message.checks.invalidPreservesThrew && serverLogFiles(root).length === 1);
                }
            });
        }

        for (const scenario of ["none"]) {
            const root = path.join(temporaryPath, scenario);
            await runningCase(scenario, {logPath: root}, async function (testCase) {
                check(scenario + " creates no server directory", !fs.existsSync(path.join(root, "server")));
                check(scenario + " creates no access directory", !fs.existsSync(path.join(root, "access")));
                if (scenario === "none") {
                    check("setLogging(false) suppresses normal Achieve console output", testCase.stdout().trim() === "");
                }
            });
        }

        const productionAccessRoot = path.join(temporaryPath, "access-production");
        await runningCase("access-production", {
            logPath: productionAccessRoot,
            appPath: path.join(__dirname, "application")
        }, async function (testCase) {
            const records = accessRecords(productionAccessRoot);
            check("production access record created", records.length === 1);
            check(
                "production uses the same access structure",
                records.length === 1 &&
                /^\S+ remote="[^"]+" method="GET" target="\/" status=200 elapsed=\d+\.\d{3}ms state=complete$/.test(records[0])
            );
            check("production access logging stays off console", testCase.stdout().trim() === "");
        });

        const http2AccessRoot = path.join(temporaryPath, "access-http2");
        const http2Case = await startCase("access-http2", {
            logPath: http2AccessRoot,
            appPath: path.join(__dirname, "application")
        });
        try {
            const response = await http2Request(http2Case.message.port, "/resource.txt?protocol=http2");
            await new Promise(resolve => setTimeout(resolve, 75));
            const records = recordsForTarget(accessRecords(http2AccessRoot), "/resource.txt?protocol=http2");
            check("HTTP/2 access response", response.status === 200);
            check("HTTP/2 access record", records.length === 1 && records[0].includes(' method="GET" ') && records[0].includes(" status=200 ") && records[0].endsWith(" state=complete"));
            const remoteMatch = records.length === 1
                ? / remote="([^"]*)" /.exec(records[0])
                : null;
            check("HTTP/2 remote address", remoteMatch && remoteMatch[1] && remoteMatch[1] !== "-");
        } finally {
            await stopCase(http2Case);
        }

        const relativeLauncher = path.join(temporaryPath, "launcher");
        fs.mkdirSync(relativeLauncher);
        const copiedFixture = path.join(relativeLauncher, "fixture.js");
        fs.copyFileSync(fixturePath, copiedFixture);
        await runningCase("server-only", {
            fixturePath: copiedFixture,
            cwd: repositoryPath,
            logPath: "relative-logs"
        }, async function () {
            check("relative log path uses launcher directory", serverLogFiles(path.join(relativeLauncher, "relative-logs")).length === 1);
        });

        const blockedParent = path.join(temporaryPath, "blocked");
        fs.writeFileSync(blockedParent, "not a directory");
        const initializationFailure = await startCase("init-failure", {logPath: blockedParent});
        check("logging initialization failure prevents listener", initializationFailure.message.refused === true);
        check("initialization failure reports directly", initializationFailure.stderr().includes("logging failed") && initializationFailure.stderr().includes("listener was not started"));
        await stopCase(initializationFailure);

        const accessFailureRoot = path.join(temporaryPath, "access-init-failure");
        fs.mkdirSync(accessFailureRoot);
        fs.writeFileSync(path.join(accessFailureRoot, "access"), "not a directory");
        const accessInitializationFailure = await startCase("access-init-failure", {logPath: accessFailureRoot});
        check("access initialization failure prevents listener", accessInitializationFailure.message.refused === true);
        check("access initialization failure closes server sink", accessInitializationFailure.message.serverStreamDestroyed === true);
        check("access initialization failure reports directly", accessInitializationFailure.stderr().includes("access logging failed") && accessInitializationFailure.stderr().includes("listener was not started"));
        await stopCase(accessInitializationFailure);

        const runtimeRoot = path.join(temporaryPath, "runtime-failure");
        await runningCase("server-only", {logPath: runtimeRoot, injectStreamError: true}, async function (testCase) {
            check("runtime sink failure reported", testCase.stderr().includes("injected server log failure"));
            const secondResponse = await request(testCase.message.port);
            check("runtime sink failure keeps HTTP service running", secondResponse.status === 200);
        });

        const accessRuntimeRoot = path.join(temporaryPath, "access-runtime-error");
        await runningCase("access-runtime-error", {
            logPath: accessRuntimeRoot,
            injectStreamErrorCategory: "access"
        }, async function (testCase) {
            const before = accessRecords(accessRuntimeRoot).length;
            const response = await request(testCase.message.port, {path: "/get/servlets/hello.jss?after=failure"});
            await new Promise(resolve => setTimeout(resolve, 75));
            const after = accessRecords(accessRuntimeRoot).length;
            const serverLog = fs.readFileSync(serverLogFiles(accessRuntimeRoot)[0], "utf8");
            const diagnosticCount = (testCase.stderr().match(/injected access log failure/g) || []).length;
            check("access runtime failure reported once", diagnosticCount === 1, diagnosticCount);
            check("access runtime failure drops later records", after === before, before + " -> " + after);
            check("access runtime failure keeps HTTP service running", response.status === 200);
            check("access runtime failure leaves server logging healthy", serverLog.includes("ERROR ERROR: setCompress(true) requires a boolean argument."));
        });

        const rolloverRoot = path.join(temporaryPath, "rollover-error");
        await runningCase("rollover-error", {logPath: rolloverRoot}, async function (testCase) {
            const diagnosticCount = (testCase.stderr().match(/injected retiring stream failure/g) || []).length;
            check("rollover opened a new daily stream", testCase.message.checks.rolloverCreatedNewStream);
            check("retiring stream failure reported once", diagnosticCount === 1, diagnosticCount);
            check("retiring stream failure marks sink failed", testCase.message.checks.sinkFailed);
            check("later server records are dropped", testCase.message.checks.laterRecordDropped);
            const secondResponse = await request(testCase.message.port);
            check("retiring stream failure keeps HTTP service running", secondResponse.status === 200);
        });

        check("repository default logs remain unpolluted", !fs.existsSync(path.join(repositoryPath, "logs", "server")) && !fs.existsSync(path.join(repositoryPath, "logs", "access")));
    } finally {
        removeTree(temporaryPath);
    }

    if (failures) {
        console.error(failures + " logging verification test(s) failed.");
        process.exitCode = 1;
    } else {
        console.log("All Stage 2 logging verification tests passed.");
    }
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
