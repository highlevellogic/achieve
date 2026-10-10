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

function write(relativePath,content) {
    const destination=path.join(applicationPath,relativePath);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,content);
}

(async function () {
    write(path.join("static","resource.txt"),"Achieve conditional request fixture.\n");
    write(path.join("servlets","counter.jss"),
        "let count = 0;\n\n"+
        "exports.servlet = function (context) {\n"+
        "    if (context.request.method === \"POST\") count++;\n"+
        "    return String(count);\n"+
        "};\n");
    write(path.join("media","sample.mp4"),Buffer.from("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"));

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
