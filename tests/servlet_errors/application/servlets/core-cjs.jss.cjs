const fs=require("node:fs");
const path=require("node:path");

exports.servlet=function (session) {
    return fs.readFileSync(path.join(session.dirPath,"missing-cjs.txt"),"utf8");
};
