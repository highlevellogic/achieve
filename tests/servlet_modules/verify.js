const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { fork } = require("node:child_process");

const fixture = path.join(__dirname, "fixture.js");
const sourceApplication = path.join(__dirname, "application");
const packageFixture = path.join(__dirname, "package-fixture");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "achieve-servlet-modules-"));

function verifyMimeGuard() {
    const achieve = require("../../achieve");
    const originalConsoleError = console.error;
    const errors = [];
    console.error = function (message) { errors.push(String(message)); };
    try {
        achieve.addMimeType("jss", "application/javascript");
    } finally {
        console.error = originalConsoleError;
    }
    assert.strictEqual(errors.length, 1);
    assert(errors[0].includes(".jss is reserved for protected Achieve server-side source"));
}

function request(port, requestPath) {
    return new Promise(function (resolve, reject) {
        const req = http.request({port, path: requestPath}, function (res) {
            const chunks = [];
            res.on("data", function (chunk) { chunks.push(chunk); });
            res.on("end", function () {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString("utf8")
                });
            });
        });
        req.setTimeout(5000, function () { req.destroy(new Error("request timeout")); });
        req.on("error", reject);
        req.end();
    });
}

function startServer(port, mode, applicationPath) {
    return new Promise(function (resolve, reject) {
        const child = fork(fixture, [String(port), mode, applicationPath], {
            stdio: ["ignore", "ignore", "ignore", "ipc"]
        });
        const timer = setTimeout(function () {
            child.kill();
            reject(new Error("server startup timeout"));
        }, 5000);
        child.once("error", function (err) {
            clearTimeout(timer);
            reject(err);
        });
        child.on("message", function (message) {
            if (message.type === "error") {
                clearTimeout(timer);
                child.kill();
                reject(new Error(message.message));
            } else if (message.type === "listening") {
                clearTimeout(timer);
                resolve(child);
            }
        });
    });
}

function stopServer(child) {
    return new Promise(function (resolve, reject) {
        let shutdownReceived = false;
        const timer = setTimeout(function () {
            child.kill();
            reject(new Error("server shutdown timeout"));
        }, 5000);
        child.once("exit", function () {
            if (!shutdownReceived) return;
            clearTimeout(timer);
            resolve();
        });
        child.on("message", function (message) {
            if (message.type === "shutdown") {
                if (message.error) {
                    clearTimeout(timer);
                    child.kill();
                    reject(new Error(message.error));
                } else {
                    shutdownReceived = true;
                    child.disconnect();
                }
            }
        });
        child.send("shutdown");
    });
}

function updateFile(filePath, content) {
    fs.writeFileSync(filePath, content);
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(filePath, future, future);
}

function helperStats(child, kind) {
    return new Promise(function (resolve, reject) {
        const timer = setTimeout(function () {
            child.off("message", receive);
            reject(new Error(kind + " helper stat count timeout"));
        }, 5000);
        function receive(message) {
            if (message.type !== kind + "-helper-stats") return;
            clearTimeout(timer);
            child.off("message", receive);
            resolve(message.count);
        }
        child.on("message", receive);
        child.send(kind + "-helper-stats");
    });
}

async function expectLoaderFailure(port,kind,message,fileName) {
    const result=await request(port,"/servlets/loader-errors.jss.cjs?kind="+kind);
    assert.strictEqual(result.status,500,kind+" status");
    assert(result.body.includes(message),kind+" message: "+result.body);
    if (fileName) assert(new RegExp(fileName.replace(/\./g,"\\.")+":\\d+:\\d+$").test(result.body),result.body);
    assert(!result.body.includes("?achieve-mtime="),result.body);
    assert(!result.body.includes("C:\\projects"),result.body);
}

function assertSafeDiagnostic(body, applicationPath) {
    assert(!body.includes("resolve:275:11"),body);
    assert(!body.includes("node:internal"),body);
    assert(!body.includes("achieve.js"),body);
    assert(!body.includes("?achieve-mtime="),body);
    assert(!body.includes(applicationPath),body);
    assert(!body.includes(applicationPath.replace(/\\/g,"/")),body);
}

async function expectESMLoadFailure(port, requestPath, message, moduleName, applicationPath) {
    const result=await request(port,requestPath);
    assert.strictEqual(result.status,500,requestPath+" status");
    assert(result.body.includes(message),requestPath+" message: "+result.body);
    assert(result.body.includes("while loading "+moduleName),requestPath+" context: "+result.body);
    assertSafeDiagnostic(result.body,applicationPath);
}

async function expectDirectRuntimeFailure(port, extension, message) {
    const result=await request(port,"/servlets/runtime-error"+extension);
    assert.strictEqual(result.status,500,extension+" runtime status");
    assert(result.body.includes(message),result.body);
    assert(new RegExp("servlets/runtime-error"+extension.replace(/\./g,"\\.")+":\\d+:\\d+$").test(result.body),result.body);
    assert(!result.body.includes("while loading"),result.body);
}

async function expectNoInternalFallback(port) {
    const result=await request(port,"/servlets/internal-stack.jss.cjs");
    assert.strictEqual(result.status,500);
    assert(result.body.includes("Synthetic internal fallback failure"),result.body);
    assert(!result.body.includes("resolve:275:11"),result.body);
    assert(!result.body.includes("node:internal"),result.body);
}

function prepareApplication(applicationPath) {
    fs.cpSync(sourceApplication, applicationPath, {recursive: true});
    fs.cpSync(
        packageFixture,
        path.join(applicationPath, "node_modules", "test-esm-package"),
        {recursive: true}
    );
}

async function verifyProduction(applicationPath) {
    const port = 24650;
    const child = await startServer(port, "production", applicationPath);
    try {
        let result = await request(port, "/servlets/hello.jss?name=short");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "COMMONJS shorthand short");
        assert(!result.body.includes("SOURCE_MUST_NOT_BE_SERVED"));

        result = await request(port, "/servlets/explicit.jss.cjs?name=explicit");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "COMMONJS explicit explicit");
        assert(!result.body.includes("SOURCE_MUST_NOT_BE_SERVED"));

        result = await request(port, "/servlets/hello.jss.mjs?name=one");
        assert.strictEqual(result.status, 200);
        let first = JSON.parse(result.body);
        assert.deepStrictEqual(first, {
            name: "one",
            packageValue: "package import",
            relativeValue: "relative import",
            loads: 1
        });

        fs.renameSync(
            path.join(applicationPath, "servlets", "hello.jss.mjs"),
            path.join(applicationPath, "servlets", "hello.jss.mjs.saved")
        );
        result = await request(port, "/servlets/hello.jss.mjs?name=two");
        assert.strictEqual(result.status, 200);
        let second = JSON.parse(result.body);
        assert.strictEqual(second.name, "two");
        assert.strictEqual(second.loads, 1);

        result = await request(port, "/servlets/relative.jss.mjs");
        assert.strictEqual(result.status, 500);
        assert(!result.body.includes("RELATIVE_ESM_SOURCE_MUST_NOT_BE_SERVED"));

        result = await request(port, "/servlets/protected.jss.txt");
        assert.strictEqual(result.status, 404);
        assert(!result.body.includes("PROTECTED_MARKER_SOURCE_MUST_NOT_BE_SERVED"));

        result = await request(port, "/js/client.mjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.headers["content-type"], "application/javascript");
        assert(result.body.includes("CLIENT_MJS_SOURCE"));

        result = await request(port, "/js/client.cjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.headers["content-type"], "application/javascript");
        assert(result.body.includes("CLIENT_CJS_SOURCE"));

        result = await request(port, "/servlets/loader.jss.cjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(
            result.body,
            "explicit CJS|bare JSS|legacy load|documented .js load|ESM one|undefined|undefined"
        );

        assert.strictEqual(await helperStats(child, "esm"), 0,
            "Initial production ESM session.load() performed helper change-detection stats.");
        await helperStats(child, "cjs");
        updateFile(path.join(applicationPath, "servlets", "loaded.jss.cjs"), "exports.value = \"explicit CJS two\";\n");
        updateFile(path.join(applicationPath, "servlets", "loaded.jss"), "exports.value = \"bare JSS two\";\n");
        updateFile(path.join(applicationPath, "servlets", "legacy.js"), "exports.value = \"legacy load two\";\n");
        updateFile(path.join(applicationPath, "servlets", "documented.js"), "exports.value = \"documented .js load two\";\n");
        updateFile(path.join(applicationPath, "servlets", "loaded.jss.mjs"), "export const value = \"ESM two\";\n");
        result = await request(port, "/servlets/loader.jss.cjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body,
            "explicit CJS|bare JSS|legacy load|documented .js load|ESM one|undefined|undefined");
        assert.strictEqual(await helperStats(child, "cjs"), 0,
            "Production CJS session.load() performed helper change-detection stats.");
        assert.strictEqual(await helperStats(child, "esm"), 0,
            "Production ESM session.load() performed helper change-detection stats.");

        await expectLoaderFailure(port,"cjs-evaluation","CJS helper evaluation failure","servlets/error-evaluation.jss.cjs");
        await expectLoaderFailure(port,"cjs-call","CJS helper call failure","servlets/error-call.jss");
        await expectLoaderFailure(port,"esm-evaluation","ESM helper evaluation failure","servlets/error-evaluation.jss.mjs");
        await expectESMLoadFailure(port,"/servlets/loader-errors.jss.cjs?kind=esm-syntax","Unexpected token ';'","servlets/error-syntax.jss.mjs",applicationPath);
        await expectESMLoadFailure(port,"/servlets/loader-errors.jss.cjs?kind=esm-missing","missing.jss.mjs","servlets/missing.jss.mjs",applicationPath);
        await expectLoaderFailure(port,"esm-call","ESM helper call failure","servlets/error-call.jss.mjs");
        await expectLoaderFailure(port,"unsupported","load() supports extensionless legacy names, .js, .jss, .jss.cjs, and .jss.mjs module filenames.");
        await expectESMLoadFailure(port,"/servlets/syntax-error.jss.mjs","Unexpected token ';'","servlets/syntax-error.jss.mjs",applicationPath);
        await expectDirectRuntimeFailure(port,".jss.cjs","CJS direct runtime failure");
        await expectDirectRuntimeFailure(port,".jss.mjs","ESM direct runtime failure");
        await expectNoInternalFallback(port);
        result=await request(port,"/servlets/hello.jss?name=healthy");
        assert.strictEqual(result.status,200);
        assert.strictEqual(result.body,"COMMONJS shorthand healthy");

        result = await request(port, "/servlets/legacy-servlet");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "legacy extensionless servlet");

        result = await request(port, "/defaults/esm/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "ESM directory default");

        result = await request(port, "/defaults/cjs/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "CJS directory default");

        result = await request(port, "/defaults/order/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "bare JSS directory default");

        result = await request(port, "/defaults/compound/");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "ESM compound default precedence");
    } finally {
        await stopServer(child);
    }
    const restarted = await startServer(24652, "production", applicationPath);
    try {
        const result = await request(24652, "/servlets/loader.jss.cjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body,
            "explicit CJS two|bare JSS two|legacy load two|documented .js load two|ESM two|undefined|undefined");
    } finally {
        await stopServer(restarted);
    }
}

async function verifyDevelopment(applicationPath) {
    const port = 24651;
    const child = await startServer(port, "development", applicationPath);
    try {
        let result = await request(port, "/servlets/reload.jss.mjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "reload one");

        updateFile(
            path.join(applicationPath, "servlets", "reload.jss.mjs"),
            "export function servlet() { return \"reload two\"; }\n"
        );
        result = await request(port, "/servlets/reload.jss.mjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body, "reload two");

        result = await request(port, "/servlets/loader.jss.cjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body,"explicit CJS|bare JSS|legacy load|documented .js load|ESM one|undefined|undefined");

        updateFile(
            path.join(applicationPath, "servlets", "loaded.jss.cjs"),
            "exports.value = \"explicit CJS two\";\n"
        );
        updateFile(
            path.join(applicationPath, "servlets", "loaded.jss"),
            "exports.value = \"bare JSS two\";\n"
        );
        updateFile(
            path.join(applicationPath, "servlets", "legacy.js"),
            "exports.value = \"legacy load two\";\n"
        );
        updateFile(
            path.join(applicationPath, "servlets", "documented.js"),
            "exports.value = \"documented .js load two\";\n"
        );
        updateFile(
            path.join(applicationPath, "servlets", "loaded.jss.mjs"),
            "export const value = \"ESM two\";\n"
        );
        result = await request(port, "/servlets/loader.jss.cjs");
        assert.strictEqual(result.status, 200);
        assert.strictEqual(result.body,"explicit CJS two|bare JSS two|legacy load two|documented .js load two|ESM two|undefined|undefined");
        assert((await helperStats(child, "esm")) >= 2,
            "Development ESM session.load() did not check the helper's modification time.");

        await expectESMLoadFailure(port,"/servlets/loader-errors.jss.cjs?kind=esm-syntax","Unexpected token ';'","servlets/error-syntax.jss.mjs",applicationPath);
        result=await request(port,"/servlets/loader-errors.jss.cjs?kind=esm-missing");
        assert.strictEqual(result.status,500);
        assert(result.body.includes("missing.jss.mjs"),result.body);
        assertSafeDiagnostic(result.body,applicationPath);
        await expectESMLoadFailure(port,"/servlets/syntax-error.jss.mjs","Unexpected token ';'","servlets/syntax-error.jss.mjs",applicationPath);
        await expectDirectRuntimeFailure(port,".jss.cjs","CJS direct runtime failure");
        await expectDirectRuntimeFailure(port,".jss.mjs","ESM direct runtime failure");
        await expectNoInternalFallback(port);
    } finally {
        await stopServer(child);
    }
}

(async function () {
    verifyMimeGuard();
    const productionApplication = path.join(temporaryRoot, "production");
    const developmentApplication = path.join(temporaryRoot, "development");
    prepareApplication(productionApplication);
    prepareApplication(developmentApplication);

    await verifyProduction(productionApplication);
    await verifyDevelopment(developmentApplication);
    console.log("PASS: servlet module-format verification");
}()).catch(function (err) {
    console.error(err.stack || err);
    process.exitCode = 1;
}).finally(function () {
    fs.rmSync(temporaryRoot, {recursive: true, force: true});
});
