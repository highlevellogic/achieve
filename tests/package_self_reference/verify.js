const assert=require("node:assert");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const repositoryPath=path.join(__dirname,"..","..");
const achievePath=path.join(repositoryPath,"achieve.js");
const esmProbePath=path.join(__dirname,"esm-probe.mjs");
const spawnProbePath=path.join(__dirname,"spawn-probe.cjs");
const startupDirectory=__dirname;
const startupPath=path.join(startupDirectory,"startup.mjs");
const temporaryPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-package-reference-"));

function pass(name) {
    console.log("PASS "+name);
}

function run(args,cwd) {
    return childProcess.spawnSync(process.execPath,args,{cwd:cwd,encoding:"utf8"});
}

function checkedResult(name,result) {
    assert.strictEqual(result.status,0,result.stderr || result.stdout);
    assert.strictEqual(result.stderr,"");
    pass(name);
    return result.stdout.trim();
}

function requestStartup() {
    return new Promise(function (resolve) {
        const request=http.get({host:"127.0.0.1",port:8989,path:"/"},function (response) {
            const chunks=[];
            response.on("data",chunk => chunks.push(chunk));
            response.on("end",function () {
                resolve({status:response.statusCode,body:Buffer.concat(chunks).toString("utf8")});
            });
        });
        request.on("error",function () { resolve(null); });
    });
}

async function liveStartupTest() {
    const expected='import achieve from "achieve";\n\nachieve.setAppPath("./application");\nachieve.listen(8989);\n';
    assert.strictEqual(fs.readFileSync(startupPath,"utf8").replace(/\r\n/g,"\n"),expected);
    const child=childProcess.spawn(process.execPath,[startupPath],{
        cwd:startupDirectory,
        stdio:["ignore","pipe","pipe"]
    });
    let stdout="";
    let stderr="";
    child.stdout.on("data",data => stdout+=data);
    child.stderr.on("data",data => stderr+=data);
    try {
        let response=null;
        for (let attempt=0; attempt<80 && response === null; attempt++) {
            if (child.exitCode !== null) break;
            await new Promise(resolve => setTimeout(resolve,50));
            response=await requestStartup();
        }
        assert(response,"Startup example did not begin serving.\n"+stdout+stderr);
        assert.strictEqual(response.status,200);
        assert(response.body.includes("Achieve package self-reference fixture"));
        assert.strictEqual(stderr,"");
        pass("test-local ESM startup serves through package self-reference");
    } finally {
        if (child.exitCode === null) {
            child.kill();
            await new Promise(resolve => child.once("exit",resolve));
        }
    }
}

(async function () {
    try {
        const packageMetadata=JSON.parse(fs.readFileSync(path.join(repositoryPath,"package.json"),"utf8"));
        assert.strictEqual(packageMetadata.main,"achieve");
        assert.strictEqual(packageMetadata.exports,"./achieve.js");
        pass("package exposes one root entry while retaining main");

        const requiredByName=require("achieve");
        const requiredRelatively=require("../../achieve.js");
        assert.strictEqual(requiredByName,requiredRelatively);
        assert.strictEqual(require.resolve("achieve"),achievePath);
        for (const api of ["listen","setAppPath","registerMethod"]) {
            assert.strictEqual(typeof requiredByName[api],"function");
        }
        pass("CommonJS self-reference exposes the normal Achieve API");
        pass("existing relative internal import is unaffected");

        assert.throws(
            () => require("achieve/achieve.js"),
            error => error && error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED"
        );
        pass("undeclared root deep import is rejected");

        let output=checkedResult("ESM self-reference inside repository",run([esmProbePath],repositoryPath));
        let esmResult=JSON.parse(output);
        assert.strictEqual(esmResult.resolved,"file:///"+achievePath.replace(/\\/g,"/"));
        assert.strictEqual(esmResult.listen,"function");
        assert.strictEqual(esmResult.setAppPath,"function");
        assert.strictEqual(esmResult.registerMethod,"function");
        pass("ESM default import exposes the normal Achieve API");

        output=checkedResult("changed cwd does not affect self-reference",run([esmProbePath],temporaryPath));
        assert.strictEqual(JSON.parse(output).resolved,esmResult.resolved);

        output=checkedResult("spawned child resolves the repository package",run([spawnProbePath,esmProbePath,temporaryPath],temporaryPath));
        assert.strictEqual(JSON.parse(output).resolved,esmResult.resolved);

        const installedPackage=path.join(temporaryPath,"external","node_modules","achieve");
        fs.mkdirSync(installedPackage,{recursive:true});
        fs.copyFileSync(achievePath,path.join(installedPackage,"achieve.js"));
        fs.copyFileSync(path.join(repositoryPath,"package.json"),path.join(installedPackage,"package.json"));
        const externalProject=path.join(temporaryPath,"external");
        const externalEsm=path.join(externalProject,"startup.mjs");
        const externalCjs=path.join(externalProject,"startup.cjs");
        fs.writeFileSync(externalEsm,'import achieve from "achieve"; console.log(JSON.stringify({listen:typeof achieve.listen,resolved:import.meta.resolve("achieve")}));\n');
        fs.writeFileSync(externalCjs,'const achieve=require("achieve"); console.log(JSON.stringify({listen:typeof achieve.listen,resolved:require.resolve("achieve")}));\n');
        output=checkedResult("temporary npm-style ESM install",run([externalEsm],temporaryPath));
        assert.strictEqual(JSON.parse(output).listen,"function");
        output=checkedResult("temporary npm-style CommonJS install",run([externalCjs],temporaryPath));
        assert.strictEqual(JSON.parse(output).listen,"function");

        await liveStartupTest();
        console.log("All package self-reference verification tests passed.");
    } finally {
        fs.rmSync(temporaryPath,{recursive:true,force:true});
    }
}()).catch(function (error) {
    console.error(error);
    process.exitCode=1;
});
