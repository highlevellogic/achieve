const assert=require("node:assert");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const achieve=require("../../achieve");
const temporaryPath=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-path-validation-"));
achieve.setAppPath(temporaryPath);

function rejects(name,value,pattern) {
    assert.throws(() => achieve.setPathMap(value),error => error instanceof TypeError && pattern.test(error.message));
    console.log("PASS "+name);
}

try {
    achieve.setPathMap({"/public/docs/":"/internal/docs/"});
    console.log("PASS valid inline path map");
    achieve.setPathMap(Object.assign(Object.create(null),{"/assets/":"/internal/assets/"}));
    console.log("PASS null-prototype path map and replacement");

    for (const [name,value] of [["array",[]],["null",null],["string","path"],["date",new Date()],["map",new Map()],["empty object",{}]]) {
        rejects("reject "+name,value,/plain object|at least one path mapping/);
    }
    for (const [name,key] of [["root","/"],["missing slash","/public"],["relative","public/"],["query","/public/?x=1"],["fragment","/public/#top"],["backslash","/public\\x/"],["dot segment","/public/../other/"],["repeated separator","/public//other/"],["empty",""]]) {
        rejects("invalid public path "+name,{[key]:"/target/"},/invalid public path/);
    }
    for (const [name,target] of [["non-string",1],["missing slash","/target"],["relative","target/"],["query","/target/?x=1"],["fragment","/target/#top"],["backslash","/target\\x/"],["traversal","/../outside/"],["dot segment","/safe/../outside/"],["repeated separator","/safe//target/"],["empty",""]]) {
        rejects("invalid mapped target "+name,{"/route/":target},/invalid mapped target/);
    }
    assert.throws(() => achieve.setPathMap(),TypeError);
    console.log("PASS malformed API arguments");
    console.log("All path-map configuration validation tests passed.");
} finally {
    fs.rmSync(temporaryPath,{recursive:true,force:true});
}
