import childProcess from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

if (process.version !== "v24.22.2") throw new Error(`Expected Node v24.22.2, received ${process.version}`);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"achieve-node24-package-"));
let server;
const watchdog=setTimeout(()=>{
    console.error("Package qualification exceeded 120 seconds");
    if (server) {
        if (server.closeAllConnections) server.closeAllConnections();
        server.close();
    }
    fs.rmSync(temporary,{recursive:true,force:true});
    process.exit(1);
},120000);
try {
    const pack=JSON.parse(childProcess.execFileSync("npm",["pack","--json","--pack-destination",temporary],{cwd:root,encoding:"utf8",shell:process.platform==="win32",timeout:120000}));
    if (pack.length !== 1) throw new Error("npm pack did not produce exactly one package");
    const files=pack[0].files.map(item=>item.path).sort();
    const expected=["CHANGELOG.md","LICENSE","README.md","achieve.js","package.json"].sort();
    if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error(`Unexpected package files: ${JSON.stringify(files)}`);
    const project=path.join(temporary,"project");
    const application=path.join(project,"application");
    fs.mkdirSync(application,{recursive:true});
    fs.writeFileSync(path.join(application,"index.htm"),"node24 smoke\n");
    fs.writeFileSync(path.join(project,"package.json"),'{"private":true}\n');
    const tarball=path.join(temporary,pack[0].filename);
    childProcess.execFileSync("npm",["install","--ignore-scripts",tarball],{cwd:project,stdio:"inherit",shell:process.platform==="win32",timeout:120000});
    const require=createRequire(path.join(project,"smoke.cjs"));
    const metadata=JSON.parse(fs.readFileSync(path.join(project,"node_modules/achieve/package.json"),"utf8"));
    if (metadata.version !== "3.0.6") throw new Error(`Installed version is ${metadata.version}`);
    const achieve=require("achieve");
    achieve.setAppPath(application);
    let port;
    while (port === undefined) {
        const reservation=net.createServer();
        await new Promise(resolve=>reservation.listen(0,"127.0.0.1",resolve));
        const candidate=reservation.address().port;
        await new Promise(resolve=>reservation.close(resolve));
        if (candidate >= 1024 && candidate <= 49151) port=candidate;
    }
    server=achieve.listen(port);
    await new Promise((resolve,reject)=>{if(server.listening)return resolve();server.once("listening",resolve);server.once("error",reject);});
    await new Promise((resolve,reject)=>{const socket=net.connect(port,"127.0.0.1",()=>{socket.end("GET /index.htm HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")});let response="";socket.setTimeout(5000,()=>socket.destroy(new Error("Smoke request timeout")));socket.on("data",chunk=>response+=chunk);socket.on("error",reject);socket.on("close",()=>response.includes("node24 smoke")?resolve():reject(new Error("Smoke response missing expected body")));});
    await new Promise(resolve=>server.close(resolve));
    server=undefined;
    console.log(JSON.stringify({version:metadata.version,files,smoke:"passed"},null,2));
} finally {
    clearTimeout(watchdog);
    if (server) {
        if (server.closeAllConnections) server.closeAllConnections();
        server.close();
    }
    fs.rmSync(temporary,{recursive:true,force:true});
}
