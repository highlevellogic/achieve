import childProcess from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

if (process.version !== "v24.22.2") throw new Error(`Expected Node v24.22.2, received ${process.version}`);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const expectedVersion=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).version;
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
    if (metadata.version !== expectedVersion) throw new Error(`Installed version is ${metadata.version}; expected ${expectedVersion}`);
    const achieve=require("achieve");
    achieve.setAppPath(application);
    let port;
    for (let attempt=0;port === undefined && attempt<100;attempt++) {
        const candidate=1024+Math.floor(Math.random()*(49151-1024+1));
        const reservation=net.createServer();
        try {
            await new Promise((resolve,reject)=>{
                reservation.once("error",reject);
                reservation.listen(candidate,"127.0.0.1",resolve);
            });
            port=candidate;
        } catch (err) {
            if (err.code !== "EADDRINUSE" && err.code !== "EACCES") throw err;
        } finally {
            if (reservation.listening) await new Promise(resolve=>reservation.close(resolve));
        }
    }
    if (port === undefined) throw new Error("Unable to reserve an available application port");
    server=achieve.listen(port);
    await new Promise((resolve,reject)=>{if(server.listening)return resolve();server.once("listening",resolve);server.once("error",reject);});
    await new Promise((resolve,reject)=>{
        const request="GET /index.htm HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n";
        const expectedBody=Buffer.from("node24 smoke\n");
        const response=[];
        const lifecycle=[];
        let completed=false;
        const socket=net.connect(port,"127.0.0.1",()=>{
            lifecycle.push("connect");
            socket.write(request,()=>lifecycle.push("write"));
        });
        socket.setTimeout(5000,()=>socket.destroy(new Error("Smoke request timeout")));
        socket.on("data",chunk=>{
            lifecycle.push(`data:${chunk.length}`);
            response.push(chunk);
        });
        socket.on("error",reject);
        socket.on("end",()=>{
            lifecycle.push("end");
            const bytes=Buffer.concat(response);
            const separator=bytes.indexOf("\r\n\r\n");
            if (separator < 0) return reject(new Error(`Smoke response missing header terminator: ${JSON.stringify({bytes:bytes.length,lifecycle})}`));
            const headerText=bytes.subarray(0,separator).toString("latin1");
            const lines=headerText.split("\r\n");
            const status=/^HTTP\/1\.1 (\d{3})(?: |$)/.exec(lines.shift());
            const headers={};
            for (const line of lines) {
                const colon=line.indexOf(":");
                if (colon < 1) return reject(new Error(`Malformed smoke response header: ${JSON.stringify({line,headerText,lifecycle})}`));
                headers[line.slice(0,colon).toLowerCase()]=line.slice(colon+1).trim();
            }
            const body=bytes.subarray(separator+4);
            const evidence={status:status?Number(status[1]):null,headers,responseBytes:bytes.length,bodyBytes:body.length,body:body.toString("utf8"),lifecycle};
            if (!status || evidence.status !== 200) return reject(new Error(`Unexpected smoke response status: ${JSON.stringify(evidence)}`));
            if (!body.equals(expectedBody)) return reject(new Error(`Unexpected smoke response body: ${JSON.stringify(evidence)}`));
            completed=true;
            resolve();
        });
        socket.on("close",hadError=>{
            lifecycle.push(`close:${hadError}`);
            if (!completed && !hadError) reject(new Error(`Smoke connection closed before a complete response: ${JSON.stringify({responseBytes:Buffer.concat(response).length,lifecycle})}`));
        });
    });
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
