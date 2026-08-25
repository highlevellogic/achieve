const assert=require("node:assert");
const path=require("node:path");
const achieve=require("../../achieve");
achieve.setLogging(false);
achieve.setAppPath(path.join(__dirname,"application-one"));
function rejects(method,servletPath,ErrorType) {
  assert.throws(function () { achieve.registerMethod(method,servletPath); },ErrorType);
}
rejects("","servlets/x.jss",TypeError);
rejects(null,"servlets/x.jss",TypeError);
rejects("BAD METHOD","servlets/x.jss",TypeError);
rejects("BAD\r\nX","servlets/x.jss",TypeError);
rejects("DELETE","",TypeError);
rejects("DELETE",null,TypeError);
for (const method of ["GET","get","HEAD","POST","OPTIONS","CONNECT"]) rejects(method,"servlets/x.jss",RangeError);
for (const handler of ["servlets/x.js","servlets/x.cjs","servlets/x.mjs","/servlets/x.jss","C:\\servlets\\x.jss","../x.jss","servlets/x.jss?x=1","servlets/x.jss#x"]) rejects("X"+Math.random().toString(16).slice(2),handler,TypeError);
achieve.registerMethod("TRACE","servlets/x.jss");
achieve.registerMethod("MiXeD","servlets/x.jss.cjs");
achieve.registerMethod("DUPLICATE","servlets/x.jss");
rejects("DUPLICATE","servlets/y.jss",RangeError);
console.log("Registered method validation passed.");