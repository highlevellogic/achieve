import fs from "node:fs";
import http from "node:http";
import http2 from "node:http2";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const delay=milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));
const results=[];
let failures=0;
const watchdog=setTimeout(()=>{
    console.error("FAIL: protocol qualification exceeded 120 seconds");
    process.exit(1);
},120000);

function record(name,state,details) {
    results.push({name,state,details});
    console.log(`${state}: ${name}: ${JSON.stringify(details)}`);
    if (state === "FAIL") failures++;
}

function frame(type,flags,stream,payload=Buffer.alloc(0)) {
    const header=Buffer.alloc(9);
    header.writeUIntBE(payload.length,0,3);
    header[3]=type;
    header[4]=flags;
    header.writeUInt32BE(stream&0x7fffffff,5);
    return Buffer.concat([header,payload]);
}

function setting(id,value) {
    const payload=Buffer.alloc(6);
    payload.writeUInt16BE(id,0);
    payload.writeUInt32BE(value,2);
    return payload;
}

function decodeFrames(buffer) {
    const frames=[];
    let offset=0;
    while (offset+9 <= buffer.length) {
        const length=buffer.readUIntBE(offset,3);
        if (offset+9+length > buffer.length) break;
        const type=buffer[offset+3];
        const flags=buffer[offset+4];
        const stream=buffer.readUInt32BE(offset+5)&0x7fffffff;
        const payload=buffer.subarray(offset+9,offset+9+length);
        frames.push({
            type,flags,stream,
            error:type === 3 && length >= 4 ? payload.readUInt32BE(0) :
                type === 7 && length >= 8 ? payload.readUInt32BE(4) : undefined,
            ping:type === 6 && length === 8 ? payload.toString("ascii") : undefined
        });
        offset+=9+length;
    }
    return frames;
}

const preface=Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
const requestHeaders=Buffer.concat([
    Buffer.from([0x82,0x86,0x84,0x01,0x09]),
    Buffer.from("localhost")
]);

async function rawRequest(port,request) {
    return new Promise((resolve,reject) => {
        let response="";
        const socket=net.connect(port,"127.0.0.1",()=>socket.end(request));
        socket.setTimeout(3000,()=>socket.destroy(new Error("raw request timeout")));
        socket.on("data",chunk=>response+=chunk.toString("latin1"));
        socket.on("error",reject);
        socket.on("close",()=>resolve(response));
    });
}

async function http1Probes() {
    const seen=[];
    const server=http.createServer((request,response) => {
        let body="";
        request.on("data",chunk=>body+=chunk.toString("latin1"));
        request.on("end",()=>{seen.push({url:request.url,body});response.end("ok");});
    });
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const port=server.address().port;
    const longTarget=await rawRequest(port,`GET /${"a".repeat(20000)} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
    const transfer=await rawRequest(port,"POST /transfer HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: frobnicate, chunked\r\nConnection: close\r\n\r\n4\r\nWiki\r\n0\r\n\r\n");
    await new Promise(resolve=>server.close(resolve));
    const targetStatus=Number(longTarget.match(/^HTTP\/1\.1 (\d+)/)?.[1]);
    const transferStatus=Number(transfer.match(/^HTTP\/1\.1 (\d+)/)?.[1]);
    record("RFC 9112 request-target overflow",targetStatus === 414 ? "FIXED" : targetStatus === 431 ? "KNOWN" : "FAIL",{targetStatus});
    record("RFC 9112 unknown transfer coding",transferStatus === 501 ? "FIXED" : transferStatus === 200 && seen[0]?.body === "Wiki" ? "KNOWN" : "FAIL",{transferStatus,seen});
}

async function connectProbe() {
    let invoked=0;
    const server=http2.createServer((request,response)=>{invoked++;response.end();});
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const client=http2.connect(`http://127.0.0.1:${server.address().port}`);
    const headers=await new Promise((resolve,reject) => {
        const request=client.request({":method":"CONNECT",":authority":"example.test:443"});
        let responseHeaders;
        request.on("response",value=>{responseHeaders=value;request.resume();});
        request.on("end",()=>resolve(responseHeaders));
        request.on("error",reject);
        request.end();
    });
    client.close();
    await new Promise(resolve=>server.close(resolve));
    const fixed=headers[":status"] === 405 && typeof headers.allow === "string" && headers.allow.length > 0;
    const known=headers[":status"] === 405 && headers.allow === undefined && invoked === 0;
    record("RFC 9110 CONNECT 405 Allow",fixed ? "FIXED" : known ? "KNOWN" : "FAIL",{invoked,headers});
}

async function rawH2(name,sequence,options={}) {
    const server=http2.createServer(options);
    server.on("session",session=>session.on("error",()=>{}));
    server.on("stream",stream=>stream.on("error",()=>{}));
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const socket=net.connect(server.address().port,"127.0.0.1");
    let bytes=Buffer.alloc(0);
    socket.on("data",chunk=>bytes=Buffer.concat([bytes,chunk]));
    socket.setTimeout(5000,()=>socket.destroy(new Error(`${name} socket timeout`)));
    socket.on("error",()=>{});
    await new Promise((resolve,reject)=>{socket.once("connect",resolve);socket.once("error",reject);});
    await sequence(socket);
    await delay(300);
    const observed=decodeFrames(bytes);
    socket.destroy();
    server.close();
    return {name,observed};
}

async function initialize(socket,settings=Buffer.alloc(0)) {
    socket.write(Buffer.concat([preface,frame(4,0,0,settings)]));
    await delay(80);
    socket.write(frame(4,1,0));
}

function terminal(frames) {
    return frames.findLast(item=>item.type === 3 || item.type === 7);
}

async function h2StateProbes() {
    const probes=[];
    probes.push(await rawH2("even stream",async socket=>{await initialize(socket);socket.write(frame(1,5,2,requestHeaders));}));
    probes.push(await rawH2("ENABLE_PUSH=2",async socket=>socket.write(Buffer.concat([preface,frame(4,0,0,setting(2,2))]))));
    probes.push(await rawH2("MAX_FRAME_SIZE=16383",async socket=>socket.write(Buffer.concat([preface,frame(4,0,0,setting(5,16383))]))));
    probes.push(await rawH2("client PUSH_PROMISE",async socket=>{await initialize(socket);socket.write(frame(1,4,1,requestHeaders));await delay(50);const id=Buffer.alloc(4);id.writeUInt32BE(2);socket.write(frame(5,4,1,Buffer.concat([id,requestHeaders])));}));
    probes.push(await rawH2("connection WINDOW_UPDATE(0)",async socket=>{await initialize(socket);socket.write(frame(8,0,0,Buffer.alloc(4)));}));
    probes.push(await rawH2("stream WINDOW_UPDATE(0)",async socket=>{await initialize(socket);socket.write(frame(1,4,1,requestHeaders));await delay(50);socket.write(frame(8,0,1,Buffer.alloc(4)));}));
    probes.push(await rawH2("concurrency limit",async socket=>{await initialize(socket);socket.write(frame(1,4,1,requestHeaders));await delay(50);socket.write(frame(1,5,3,requestHeaders));},{settings:{maxConcurrentStreams:1}}));
    probes.push(await rawH2("active window overflow",async socket=>{await initialize(socket,setting(4,0));socket.write(frame(1,5,1,requestHeaders));await delay(50);const one=Buffer.alloc(4);one.writeUInt32BE(1);socket.write(frame(8,0,1,one));await delay(50);socket.write(frame(4,0,0,setting(4,0x7fffffff)));}));
    for (const probe of probes) {
        const end=terminal(probe.observed);
        let state="FAIL";
        if (["even stream","ENABLE_PUSH=2","MAX_FRAME_SIZE=16383","client PUSH_PROMISE","connection WINDOW_UPDATE(0)"].includes(probe.name)) {
            state=end?.type === 7 && end.error === 1 ? "FIXED" : "FAIL";
        } else if (probe.name === "stream WINDOW_UPDATE(0)") {
            state=end?.type === 3 && end.stream === 1 && end.error === 1 ? "FIXED" : end?.type === 7 && end.error === 1 ? "KNOWN" : "FAIL";
        } else if (probe.name === "concurrency limit") {
            state=end?.type === 3 && end.stream === 3 && [1,7].includes(end.error) ? "FIXED" : end?.type === 7 && end.error === 1 ? "KNOWN" : "FAIL";
        } else if (probe.name === "active window overflow") {
            state=end?.type === 7 && end.error === 3 ? "FIXED" : "FAIL";
        }
        record(`HTTP/2 ${probe.name}`,state,{terminal:end,frames:probe.observed});
    }
}

async function waitFor(predicate,timeout) {
    const start=Date.now();
    while (Date.now()-start < timeout) {
        if (predicate()) return true;
        await delay(10);
    }
    return false;
}

async function tlsProbes() {
    const key=fs.readFileSync(path.join(root,"tests/logging/test-key.pem"));
    const cert=fs.readFileSync(path.join(root,"tests/logging/test-cert.pem"));
    const server=http2.createSecureServer({key,cert,minVersion:"TLSv1.2",maxVersion:"TLSv1.2",allowHTTP1:false});
    const serverErrors=[];
    server.on("secureConnection",socket=>socket.on("error",error=>serverErrors.push(error.code)));
    server.on("session",session=>session.on("error",()=>{}));
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const socket=tls.connect({host:"127.0.0.1",port:server.address().port,rejectUnauthorized:false,ALPNProtocols:["h2"],minVersion:"TLSv1.2",maxVersion:"TLSv1.2"});
    let bytes=Buffer.alloc(0),callback="not-called";
    socket.on("data",chunk=>bytes=Buffer.concat([bytes,chunk]));
    socket.on("error",()=>{});
    await new Promise((resolve,reject)=>{socket.once("secureConnect",resolve);socket.once("error",reject);});
    socket.write(Buffer.concat([preface,frame(4,0,0)]));
    await waitFor(()=>decodeFrames(bytes).filter(item=>item.type===4).length>=2,1500);
    socket.write(frame(6,0,0,Buffer.from("BEFORE01")));
    const before=await waitFor(()=>decodeFrames(bytes).some(item=>item.type===6&&(item.flags&1)&&item.ping==="BEFORE01"),1500);
    socket.renegotiate({},error=>callback=error?error.code:"success");
    await waitFor(()=>callback!=="not-called",2500);
    if (!socket.destroyed) socket.write(frame(6,0,0,Buffer.from("AFTER001")));
    const after=await waitFor(()=>decodeFrames(bytes).some(item=>item.type===6&&(item.flags&1)&&item.ping==="AFTER001"),1500);
    const goaway=decodeFrames(bytes).findLast(item=>item.type===7);
    const disabled=serverErrors.includes("ERR_TLS_RENEGOTIATION_DISABLED") && callback !== "success" && !after;
    const reaction=disabled && goaway?.error === 1 ? "FIXED" :
        disabled && goaway === undefined ? "KNOWN" : "FAIL";
    record("TLS 1.2 post-preface renegotiation",before && reaction !== "FAIL" ? reaction : "FAIL",{before,after,callback,serverErrors,goaway});
    socket.destroy();
    if (server.closeAllConnections) server.closeAllConnections();
    server.close();

    const ciphers="AES128-SHA:@SECLEVEL=0";
    const cipherServer=http2.createSecureServer({key,cert,minVersion:"TLSv1.2",maxVersion:"TLSv1.2",ciphers,allowHTTP1:false});
    const cipherServerErrors=[];
    cipherServer.on("tlsClientError",error=>cipherServerErrors.push({code:error.code,message:error.message}));
    await new Promise(resolve=>cipherServer.listen(0,"127.0.0.1",resolve));
    const cipherSocket=tls.connect({host:"127.0.0.1",port:cipherServer.address().port,rejectUnauthorized:false,ALPNProtocols:["h2"],minVersion:"TLSv1.2",maxVersion:"TLSv1.2",ciphers});
    let cipherError;
    try {
        await new Promise((resolve,reject)=>{cipherSocket.once("secureConnect",resolve);cipherSocket.once("error",reject);});
        const selected=cipherSocket.getCipher()?.standardName;
        const prohibited=selected === "TLS_RSA_WITH_AES_128_CBC_SHA" && cipherSocket.alpnProtocol === "h2";
        record("TLS 1.2 prohibited cipher policy",prohibited ? "KNOWN" : "FIXED",{selected,alpn:cipherSocket.alpnProtocol});
    } catch (error) {
        cipherError={code:error.code,message:error.message};
        await delay(50);
        const evidence=[cipherError,...cipherServerErrors].map(item=>`${item.code || ""} ${item.message || ""}`).join(" ");
        const policyRejection=/NO_SHARED_CIPHER|HANDSHAKE_FAILURE|no shared cipher|handshake failure/i.test(evidence);
        record("TLS 1.2 prohibited cipher policy",policyRejection ? "FIXED" : "FAIL",{connectionRejected:true,error:cipherError,serverErrors:cipherServerErrors});
    } finally {
        cipherSocket.destroy();
    }
    cipherServer.close();
}

if (process.version !== "v24.22.2") {
    throw new Error(`Qualification requires exactly Node v24.22.2; received ${process.version}`);
}

await http1Probes();
await connectProbe();
await h2StateProbes();
await tlsProbes();

const summary={runtime:{node:process.version,openssl:process.versions.openssl,nghttp2:process.versions.nghttp2,llhttp:process.versions.llhttp},failures,results};
fs.writeFileSync(path.join(root,"node24-linux-protocol-results.json"),`${JSON.stringify(summary,null,2)}\n`);
console.log(`Protocol qualification completed with ${failures} unexpected failure(s).`);
clearTimeout(watchdog);
process.exitCode=failures === 0 ? 0 : 1;
