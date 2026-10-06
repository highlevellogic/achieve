import assert from "node:assert/strict";
import { spawn,spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distribution = path.resolve(process.argv[2] || "");
if (!fs.existsSync(path.join(distribution,"package.json"))) {
  throw new Error("Pass the extracted distribution directory as the first argument.");
}

const { WebSocket } = await import(pathToFileURL(
  path.join(distribution,"node_modules/ws/wrapper.mjs")
));

function start(script,mainPort,secondaryPort) {
  const child = spawn(process.execPath,[script],{
    cwd:distribution,
    env:{
      ...process.env,
      ACHIEVE_EXAMPLES_PORT:String(mainPort),
      ACHIEVE_EXAMPLES_SECONDARY_PORT:String(secondaryPort)
    },
    stdio:["ignore","pipe","pipe"],
    windowsHide:true
  });
  child.output = "";
  child.stdout.on("data",chunk => child.output += chunk);
  child.stderr.on("data",chunk => child.output += chunk);
  return child;
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 20 && child.exitCode === null; attempt++) {
    await new Promise(resolve => setTimeout(resolve,100));
  }
  if (child.exitCode === null && process.platform === "win32") {
    spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],{windowsHide:true});
  }
}

async function waitFor(url,child) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`Launcher exited early:\n${child.output}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise(resolve => setTimeout(resolve,100));
  }
  throw new Error(`Timed out waiting for ${url}\n${child.output}`);
}

async function withLauncher(script,mainPort,secondaryPort,test) {
  const child = start(script,mainPort,secondaryPort);
  try {
    await waitFor(`http://localhost:${mainPort}/`,child);
    await test(child);
  } finally {
    await stop(child);
  }
}

async function verifySource(mainPort,application,key,pattern) {
  const response = await fetch(
    `http://localhost:${mainPort}/advanced/${application}/servlets/loadCode.jss.mjs?file=${key}`
  );
  assert.equal(response.status,200);
  assert.match(await response.text(),pattern);
}

async function websocketRoundTrip(mainPort) {
  const first = new WebSocket(`ws://localhost:${mainPort}/?room=verification`);
  const second = new WebSocket(`ws://localhost:${mainPort}/?room=verification`);
  await Promise.all([
    new Promise((resolve,reject) => { first.once("open",resolve); first.once("error",reject); }),
    new Promise((resolve,reject) => { second.once("open",resolve); second.once("error",reject); })
  ]);
  try {
    const received = new Promise((resolve,reject) => {
      second.once("message",data => resolve(data.toString()));
      second.once("error",reject);
    });
    first.send("hello");
    assert.equal(await received,"hello");
  } finally {
    first.close();
    second.close();
  }
}

await withLauncher("start.mjs",18889,18890,async () => {
  const mainPort = 18889;
  const landing = await fetch(`http://localhost:${mainPort}/`);
  assert.match(await landing.text(),/Achieve v3 Advanced Examples/);

  const image = await fetch(`http://localhost:${mainPort}/images/skyhigh1.jpg`);
  assert.equal(image.status,200);
  assert.ok((await image.arrayBuffer()).byteLength > 1000);

  const confirmation = await fetch(`http://localhost:${mainPort}/confirm/servlets/hello.jss`);
  assert.equal(await confirmation.text(),"Achieve is running.");

  const mysqlPage = await fetch(`http://localhost:${mainPort}/advanced/mysql/`);
  assert.equal(mysqlPage.status,200);
  await verifySource(mainPort,"mysql","startup",/achieve\.listen/);

  const xml = await fetch(`http://localhost:${mainPort}/advanced/xml/servlets/sax.jss.mjs`,{
    method:"POST",
    headers:{"Content-Type":"application/xml"},
    body:"<items><book><title>Achieve</title></book></items>"
  });
  assert.equal(xml.status,200);
  assert.match(await xml.text(),/Achieve/);
});
console.log("PASS default, static, servlet, MySQL page, XML/SAX");

await withLauncher("start-websockets.mjs",18891,18892,async () => {
  await websocketRoundTrip(18891);
  await verifySource(18891,"websockets","start",/WebSocketServer/);
});
console.log("PASS WebSockets and Rooms");

await withLauncher("start-cluster.mjs",18893,18894,async () => {
  const mainPort = 18893;
  const secondaryPort = 18894;
  await waitFor(`http://localhost:${secondaryPort}/advanced/cluster/servlets/primes.jss`,{
    get exitCode() { return null; }, output:""
  });
  const response = await fetch(`http://localhost:${secondaryPort}/advanced/cluster/servlets/primes.jss`,{
    headers:{Origin:`http://localhost:${mainPort}`}
  });
  assert.equal(response.status,200);
  assert.match(await response.text(),/^\d+$/);
  await verifySource(mainPort,"cluster","startup",/cluster\.isPrimary/);
});
console.log("PASS Cluster");

await withLauncher("start-distributed.mjs",18895,18896,async child => {
  const mainPort = 18895;
  await waitFor("http://localhost:18896/",child);
  const svg = await fs.promises.readFile(path.join(
    distribution,"application/advanced/distributed/dots.svg"
  ));
  const response = await fetch(`http://localhost:${mainPort}/advanced/distributed/servlets/relay.jss.mjs`,{
    method:"POST",
    headers:{"Content-Type":"image/svg+xml"},
    body:svg
  });
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type") || "",/image\/svg\+xml/);
  assert.match(await response.text(),/<svg/);
  await verifySource(mainPort,"distributed","startup",/ACHIEVE_DISTRIBUTED_ROLE/);
});
console.log("PASS Distributed computing");

await withLauncher("start-soap.mjs",18897,18898,async child => {
  const mainPort = 18897;
  await waitFor("http://localhost:18898/soap?wsdl",child);
  const response = await fetch(`http://localhost:${mainPort}/advanced/soap/servlets/soap_request.jss.mjs`);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{price:"44.95"});
  await verifySource(mainPort,"soap","startup",/soap-service/);
});
console.log("PASS SOAP");

console.log("Advanced examples verification passed.");
