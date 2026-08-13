const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
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
            method: options.method || "GET"
        }, function (res) {
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", function () {
                resolve({status: res.statusCode, body: Buffer.concat(chunks)});
            });
        });
        req.on("error", reject);
        if (options.body) req.write(options.body);
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
                ACHIEVE_INJECT_STREAM_ERROR: options.injectStreamError ? "true" : "false"
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
            const getResult = await request(testCase.message.port, {path: "/get/servlets/hello"});
            const headResult = await request(testCase.message.port, {method: "HEAD", path: "/head/servlets/hello"});
            const postResult = await request(testCase.message.port, {method: "POST", path: "/post/servlets/hello", body: "value=1"});
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
            const getResult = await request(testCase.message.port, {path: "/servlets/lifecycle"});
            await new Promise(resolve => setTimeout(resolve, 25));
            let trace = testCase.stdout().substring(start);
            check("GET lifecycle label", getResult.status === 200 && trace.includes("INFO: GET ") && !trace.includes("INFO: POST "));

            start = testCase.stdout().length;
            const headResult = await request(testCase.message.port, {method: "HEAD", path: "/servlets/lifecycle"});
            await new Promise(resolve => setTimeout(resolve, 25));
            trace = testCase.stdout().substring(start);
            check("HEAD lifecycle uses GET label", headResult.status === 200 && trace.includes("INFO: GET ") && !trace.includes("INFO: POST "));

            start = testCase.stdout().length;
            const postResult = await request(testCase.message.port, {method: "POST", path: "/servlets/lifecycle", body: "value=1"});
            await new Promise(resolve => setTimeout(resolve, 25));
            trace = testCase.stdout().substring(start);
            check("POST lifecycle label", postResult.status === 200 && trace.includes("INFO: POST ") && !trace.includes("INFO: GET "));
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
                check(scenario + " creates no access sink", !fs.existsSync(path.join(root, "access")));
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

        for (const scenario of ["none", "access-only"]) {
            const root = path.join(temporaryPath, scenario);
            await runningCase(scenario, {logPath: root}, async function (testCase) {
                check(scenario + " creates no server directory", !fs.existsSync(path.join(root, "server")));
                check(scenario + " creates no access directory in Stage 1", !fs.existsSync(path.join(root, "access")));
                if (scenario === "none") {
                    check("setLogging(false) suppresses normal Achieve console output", testCase.stdout().trim() === "");
                }
            });
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

        const runtimeRoot = path.join(temporaryPath, "runtime-failure");
        await runningCase("server-only", {logPath: runtimeRoot, injectStreamError: true}, async function (testCase) {
            check("runtime sink failure reported", testCase.stderr().includes("injected server log failure"));
            const secondResponse = await request(testCase.message.port);
            check("runtime sink failure keeps HTTP service running", secondResponse.status === 200);
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
        console.log("All Stage 1 logging verification tests passed.");
    }
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
