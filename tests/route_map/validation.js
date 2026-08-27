const assert=require("node:assert");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const achieve=require("../../achieve");
const temporaryPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-route-validation-"));
achieve.setAppPath(temporaryPath);

function write(name,value) {
    const filePath=path.join(temporaryPath,name);
    fs.writeFileSync(filePath,value);
    return filePath;
}
function rejects(name,file,value,errorType,pattern) {
    const filePath=write(file,value);
    assert.throws(() => achieve.setRouteMap(filePath),error => error instanceof errorType && pattern.test(error.message));
    console.log("PASS "+name);
}

try {
    const valid=write("valid.json",JSON.stringify({"/about":"/pages/about.htm"}));
    achieve.setRouteMap(valid);
    console.log("PASS valid JSON route map");
    achieve.setRouteMap(write("replacement.json",JSON.stringify({"/status":"/servlets/status.jss"})));
    console.log("PASS setRouteMap reconfiguration replaces the map");

    const missing=path.join(temporaryPath,"physical-secret-name.json");
    assert.throws(() => achieve.setRouteMap(missing),error => /could not read/.test(error.message) && !error.message.includes(temporaryPath) && !error.message.includes("physical-secret-name"));
    console.log("PASS missing route map has sanitized error");

    rejects("malformed JSON","malformed.json","{",SyntaxError,/valid JSON/);
    for (const [name,value] of [["array","[]"],["null","null"],["string","\"route\""],["empty object","{}"]]) {
        rejects("reject "+name,"non-object-"+name+".json",value,TypeError,/JSON object|at least one route/);
    }
    for (const [name,key] of [["relative","about"],["query","/about?x=1"],["fragment","/about#top"],["backslash","/about\\x"],["dot segment","/about/../other"],["repeated separator","/about//other"],["empty",""]]) {
        rejects("invalid public route "+name,"public-"+name+".json",JSON.stringify({[key]:"/target.txt"}),TypeError,/invalid public route/);
    }
    for (const [name,target] of [["non-string",1],["relative","target.txt"],["query","/target.txt?x=1"],["fragment","/target.txt#top"],["backslash","/target\\x"],["traversal","/../outside.txt"],["dot segment","/safe/../outside.txt"],["repeated separator","/safe//target.txt"],["empty",""]]) {
        rejects("invalid mapped target "+name,"target-"+name+".json",JSON.stringify({"/route":target}),TypeError,/invalid mapped target/);
    }
    rejects("duplicate decoded public route","duplicate.json",'{"/same":"/one","/sa\\u006de":"/two"}',SyntaxError,/duplicate public route/);
    assert.throws(() => achieve.setRouteMap(),TypeError);
    assert.throws(() => achieve.setRouteMap(""),TypeError);
    console.log("PASS malformed API arguments");
    console.log("All route-map configuration validation tests passed.");
} finally {
    fs.rmSync(temporaryPath,{recursive:true,force:true});
}