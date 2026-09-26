const http = require("http");
const childProcess = require("child_process");
const fs = require("fs");
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
        check("server-entry root directory is default app status", result.status, 200);
        check("server-entry root directory is default app", result.body.trim(), "default root application");
        const outside=await request(port,"/outside.html");
        check("startup-directory resource outside root is not served",outside.status,404);
    });

    const missingFixture=path.join(__dirname,"missing_default","fixture.js");
    const missingRoot=path.join(path.dirname(missingFixture),"root");
    const missingResult=childProcess.spawnSync(process.execPath,[missingFixture],{encoding:"utf8"});
    check("missing default root prevents startup",missingResult.status,0);
    check("missing default root reports complete path",missingResult.stdout.trim(),"Default application path does not exist: "+missingRoot);

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
        check("setRootDir changes no configuration", result.body.trim(), "default root application");
    });

    const configuredPath = path.join(__dirname, "..", "request_path", "application");
    achieve.setRootDir("still-ignored");
    achieve.setAppPath(configuredPath);
    await withServer(async function (port) {
        const result = await request(port, "/index.html");
        check("setAppPath override status", result.status, 200);
        check("setRootDir followed by setAppPath", result.body.indexOf("request-path root") !== -1, true);
    });

    const temporaryPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-application-path-"));
    const nonexistentPath=path.join(temporaryPath,"missing");
    const filePath=path.join(temporaryPath,"file.txt");
    fs.writeFileSync(filePath,"not a directory");
    try {
        assertPathFailure("nonexistent setAppPath",nonexistentPath,/does not exist/);
        assertPathFailure("non-directory setAppPath",filePath,/is not a directory/);
        await withServer(async function (port) {
            const result=await request(port,"/index.html");
            check("failed setAppPath preserves configured application status",result.status,200);
            check("failed setAppPath does not silently select another path",result.body.indexOf("request-path root") !== -1,true);
        });
    } finally {
        fs.rmSync(temporaryPath,{recursive:true,force:true});
    }

    if (failures) process.exitCode = 1;
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});

function assertPathFailure(name,target,pattern) {
    try {
        achieve.setAppPath(target);
        check(name+" throws",false,true);
    } catch (error) {
        check(name+" throws",pattern.test(error.message),true);
        check(name+" reports complete path",error.message.includes(path.resolve(target)),true);
    }
}
