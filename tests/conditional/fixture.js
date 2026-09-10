const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const achieve = require("../../achieve");

const port = Number(process.env.ACHIEVE_CONDITIONAL_PORT);
const caching = process.env.ACHIEVE_CONDITIONAL_CACHING !== "false";
const compression = process.env.ACHIEVE_CONDITIONAL_COMPRESSION !== "false";
const applicationPath = fs.mkdtempSync(path.join(os.tmpdir(),"achieve-conditional-"));
process.on("exit",function () {
    fs.rmSync(applicationPath,{recursive:true,force:true});
});

function copy(source,destination) {
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.copyFileSync(source,destination);
}

(async function () {
    const {examplesPath}=await import("../../example-config.mjs");
    const sourcePath=path.join(examplesPath,"intermediate","conditional");

    copy(path.join(sourcePath,"index.html"),path.join(applicationPath,"index.html"));
    copy(path.join(sourcePath,"conditional.js"),path.join(applicationPath,"conditional.js"));
    copy(path.join(sourcePath,"static","resource.txt"),path.join(applicationPath,"static","resource.txt"));
    copy(path.join(sourcePath,"servlets","counter.jss"),path.join(applicationPath,"servlets","counter.jss"));
    copy(path.join(examplesPath,"basics","media","media","mov_bbb.mp4"),path.join(applicationPath,"media","sample.mp4"));

    achieve.setAppPath(applicationPath);
    achieve.setCaching(caching);
    achieve.setCompress(compression);
    const server=achieve.listen(port);
    server.on("listening",function () {
        console.log("CONDITIONAL_READY " + port + " " + applicationPath);
    });
}()).catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
