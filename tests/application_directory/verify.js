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
    const missingFixture=path.join(__dirname,"missing_default","fixture.js");
    check("adjacent root fixture exists but is not implicit",fs.existsSync(path.join(path.dirname(missingFixture),"root","implicit.html")),true);
    const missingMessage="ERROR: Application space has not been configured. Use setAppPath() before starting the server.";
    for (const listener of ["listen","slisten","listen2","listen2-secure"]) {
        const missingResult=childProcess.spawnSync(process.execPath,[missingFixture,listener],{encoding:"utf8"});
        check(listener+" without setAppPath exits cleanly",missingResult.status,0);
        check(listener+" without setAppPath returns no server",missingResult.stderr.trim(),missingMessage);
    }

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

    const configuredPath = path.join(__dirname,"root");
    achieve.setRootDir("still-ignored");
    achieve.setAppPath(configuredPath);
    await withServer(async function (port) {
        const result = await request(port, "/fixtures/default.html");
        check("setAppPath override status", result.status, 200);
        check("setRootDir followed by setAppPath", result.body.trim(), "default root application");
        const outside=await request(port,"/outside.html");
        check("resource adjacent to configured application is not served",outside.status,404);
    });

    const temporaryPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-application-path-"));
    const nonexistentPath=path.join(temporaryPath,"missing");
    const filePath=path.join(temporaryPath,"file.txt");
    fs.writeFileSync(filePath,"not a directory");
    try {
        assertPathFailure("nonexistent setAppPath",nonexistentPath,/does not exist/);
        assertPathFailure("non-directory setAppPath",filePath,/is not a directory/);
        await withServer(async function (port) {
            const result=await request(port,"/fixtures/default.html");
            check("failed setAppPath preserves configured application status",result.status,200);
            check("failed setAppPath does not silently select another path",result.body.trim(),"default root application");
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
