const fs=require("node:fs");
const path=require("node:path");
const achieve=require("../../achieve");

achieve.setMode("development");
achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"application-one"));
const registrations=[
  ["DELETE","servlets/delete.jss"],["MiXeD","servlets/delete.jss"],["PATCH","servlets/patch.jss.mjs"],
  ["PURGE","servlets/purge.jss.cjs"],["TRACE","servlets/trace.jss"],
  ["PUT","servlets/body.jss"],["PROPPATCH","servlets/xml.jss"],
  ["MKCOL","servlets/loader.jss"],["LOCK","servlets/async.jss"],
  ["CHECKOUT","servlets/reload.jss"],["PROPFIND","servlets/missing.jss"],["COPY","servlets/noexport.jss"],
  ["MOVE","servlets/syntax.jss"],["UNLOCK","servlets/throw.jss"]
];
for (const registration of registrations) achieve.registerMethod(registration[0],registration[1]);
achieve.setAppPath(path.join(__dirname,"application-two"));
achieve.allowOrigins("http://target.example","/allowed/","*");
achieve.allowOrigins("http://handler.example","/servlets/","*");

const protocol=process.env.ACHIEVE_REGISTERED_PROTOCOL || "http";
const port=Number(process.env.ACHIEVE_REGISTERED_PORT);
let server;
if (protocol === "http") server=achieve.listen(port);
else if (protocol === "https") server=achieve.slisten({
  httpsPort:port,
  key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
  cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem"))
});
else if (protocol === "http2") server=achieve.listen2(port);
else server=achieve.listen2({
  http2Port:port,
  key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
  cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem"))
});
server.on("listening",function () { process.send({event:"ready",protocol:protocol}); });
process.on("message",function (message) {
  if (message.command === "stop") server.close(function () { process.exit(); });
});