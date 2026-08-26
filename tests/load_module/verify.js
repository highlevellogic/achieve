const assert=require("node:assert");
const childProcess=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const repositoryPath=path.join(__dirname,"..","..");
const achievePath=path.join(repositoryPath,"achieve.js");
const temporaryPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-load-module-"));
const applicationPath=path.join(temporaryPath,"application");
const packagePath=path.join(applicationPath,"node_modules","achieve-load-module-fixture");

function write(filePath,value) {
    fs.mkdirSync(path.dirname(filePath),{recursive:true});
    fs.writeFileSync(filePath,value);
}

function launcherSource(moduleSyntax) {
    const load=moduleSyntax === "esm"
        ? "import achieve from "+JSON.stringify(pathToFileURL(achievePath).href)+";"
        : "const achieve=require("+JSON.stringify(achievePath)+");";
    return load+"\n"+
        "const originalError=console.error;\n"+
        "const errors=[];\n"+
        "console.error=(...values)=>errors.push(values.map(String).join(' '));\n"+
        "const loaded=achieve.loadModule('achieve-load-module-fixture');\n"+
        "const missing=achieve.loadModule('achieve-load-module-missing');\n"+
        "console.error=originalError;\n"+
        "console.log('RESULT '+JSON.stringify({value:loaded.value,missing:missing,errors:errors}));\n";
}

function run(fileName) {
    return childProcess.spawnSync(process.execPath,[path.join(applicationPath,fileName)],{
        cwd:repositoryPath,
        encoding:"utf8"
    });
}

try {
    write(path.join(packagePath,"package.json"),JSON.stringify({
        name:"achieve-load-module-fixture",
        main:"achieve-load-module-fixture.js"
    }));
    write(path.join(packagePath,"achieve-load-module-fixture.js"),
        "exports.value='application-local module';\n");
    write(path.join(applicationPath,"startup.cjs"),launcherSource("commonjs"));
    write(path.join(applicationPath,"startup.mjs"),launcherSource("esm"));

    for (const testCase of [
        ["CommonJS","startup.cjs"],
        ["ESM","startup.mjs"]
    ]) {
        const result=run(testCase[1]);
        assert.strictEqual(result.status,0,result.stderr || result.stdout);
        const resultLine=result.stdout.trim().split(/\r?\n/).find(line => line.startsWith("RESULT "));
        assert(resultLine,testCase[0]+" startup did not report a result.");
        const value=JSON.parse(resultLine.substring(7));
        assert.strictEqual(value.value,"application-local module");
        assert.strictEqual(value.missing,undefined);
        assert.strictEqual(value.errors.length,1);
        assert(value.errors[0].includes("achieve-load-module-missing"));
        assert(!value.errors[0].includes(temporaryPath));
        assert(!value.errors[0].includes(repositoryPath));
        console.log("PASS "+testCase[0]+" application-local loadModule resolution and sanitized error");
    }
} finally {
    fs.rmSync(temporaryPath,{recursive:true,force:true});
}

console.log("All loadModule verification tests passed.");