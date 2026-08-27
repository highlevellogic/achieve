const assert=require("node:assert");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const achieve=require("../../achieve");
const temporaryPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-route-validation-"));
achieve.setAppPath(temporaryPath);

function rejects(name,value,errorType,pattern) {
    assert.throws(() => achieve.setRouteMap(value),error => error instanceof errorType && pattern.test(error.message));
    console.log("PASS "+name);
}

try {
    achieve.setRouteMap({"/about":"/pages/about.htm"});
    console.log("PASS valid inline route map");
    achieve.setRouteMap(Object.assign(Object.create(null),{"/status":"/servlets/status.jss"}));
    console.log("PASS null-prototype route map and replacement");

    for (const [name,value] of [["array",[]],["null",null],["string","route"],["date",new Date()],["map",new Map()],["empty object",{}]]) {
        rejects("reject "+name,value,TypeError,/plain object|at least one route/);
    }
    for (const [name,key] of [["relative","about"],["query","/about?x=1"],["fragment","/about#top"],["backslash","/about\\x"],["dot segment","/about/../other"],["repeated separator","/about//other"],["empty",""]]) {
        rejects("invalid public route "+name,{[key]:"/target.txt"},TypeError,/invalid public route/);
    }
    for (const [name,target] of [["non-string",1],["relative","target.txt"],["query","/target.txt?x=1"],["fragment","/target.txt#top"],["backslash","/target\\x"],["traversal","/../outside.txt"],["dot segment","/safe/../outside.txt"],["repeated separator","/safe//target.txt"],["empty",""]]) {
        rejects("invalid mapped target "+name,{"/route":target},TypeError,/invalid mapped target/);
    }
    assert.throws(() => achieve.setRouteMap(),TypeError);
    assert.throws(() => achieve.setRouteMap("routes.json"),TypeError);
    console.log("PASS malformed API arguments");
    console.log("All route-map configuration validation tests passed.");
} finally {
    fs.rmSync(temporaryPath,{recursive:true,force:true});
}
