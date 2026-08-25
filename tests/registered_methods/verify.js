const assert=require("node:assert");
const childProcess=require("node:child_process");
const http=require("node:http");
const https=require("node:https");
const http2=require("node:http2");
const path=require("node:path");

let nextPort=19380;
function wait(child,event) {
  return new Promise(function (resolve,reject) {
    const timer=setTimeout(() => { cleanup(); reject(new Error("Timed out waiting for "+event)); },10000);
    function cleanup(){ clearTimeout(timer); child.off("message",message); child.off("exit",exit); }
    function message(value){ if(value.event !== event)return; cleanup(); resolve(value); }
    function exit(code){ cleanup(); reject(new Error("Fixture exited early: "+code)); }
    child.on("message",message); child.once("exit",exit);
  });
}
async function start(protocol) {
  const port=nextPort++;
  const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{silent:true,env:Object.assign({},process.env,{
    ACHIEVE_REGISTERED_PROTOCOL:protocol,ACHIEVE_REGISTERED_PORT:String(port)
  })});
  child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
  await wait(child,"ready");
  return {child:child,port:port,protocol:protocol};
}
async function stop(testCase) {
  if(testCase.child.exitCode !== null)return;
  const exited=new Promise(resolve => testCase.child.once("exit",resolve));
  testCase.child.send({command:"stop"});
  await exited;
}
function requestHttp(testCase,method,target,headers={},chunks=[]) {
  return new Promise(function (resolve,reject) {
    const transport=testCase.protocol === "https" ? https : http;
    const req=transport.request({host:"127.0.0.1",port:testCase.port,method:method,path:target,
      headers:headers,rejectUnauthorized:false},function (res) {
      const data=[]; res.on("data",chunk => data.push(chunk));
      res.on("end",() => resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(data).toString()}));
    });
    req.on("error",reject);
    for(const chunk of chunks)req.write(chunk);
    req.end();
  });
}
function requestHttp2(testCase,method,target,headers={},chunks=[]) {
  return new Promise(function (resolve,reject) {
    const secure=testCase.protocol === "http2s";
    const client=http2.connect((secure ? "https" : "http")+"://127.0.0.1:"+testCase.port,
      secure ? {rejectUnauthorized:false} : {});
    client.on("error",reject);
    const req=client.request(Object.assign({":method":method,":path":target},headers));
    let responseHeaders; const data=[];
    req.on("response",value => { responseHeaders=value; });
    req.on("data",chunk => data.push(chunk));
    req.on("end",function () { client.close(); resolve({status:responseHeaders[":status"],headers:responseHeaders,body:Buffer.concat(data).toString()}); });
    req.on("error",function (err) { client.close(); reject(err); });
    for(const chunk of chunks)req.write(chunk);
    req.end();
  });
}
function request(testCase,method,target,headers,chunks){
  return testCase.protocol.startsWith("http2") ? requestHttp2(testCase,method,target,headers,chunks) : requestHttp(testCase,method,target,headers,chunks);
}
function json(response){ return JSON.parse(response.body); }

(async function () {
  childProcess.execFileSync(process.execPath,[path.join(__dirname,"validation.js")],{stdio:"inherit"});
  const main=await start("http");
  try {
    let response=await request(main,"DELETE","/documents/report.pdf?audit=yes",{"X-Handler-Test":"preserved"});
    assert.strictEqual(response.status,200); let value=json(response);
    assert.deepStrictEqual(value,{handler:"delete",method:"DELETE",url:"/documents/report.pdf?audit=yes",header:"preserved",params:[],alias:true});
    response=await request(main,"DELETE","/another/target");
    assert.strictEqual(json(response).handler,"delete");
    for(const item of [["PATCH","/missing","patch-esm"],["PURGE","/missing","purge-cjs"],["TRACE","/missing","trace"]]) {
      response=await request(main,item[0],item[1]); assert.strictEqual(response.status,200); value=json(response);
      assert.strictEqual(value.handler,item[2]); assert.strictEqual(value.method,item[0]); assert.strictEqual(value.url,item[1]);
    }
    for(const target of ["/existing.txt","/media/sample.mp4","/does-not-exist","/servlets/other.jss"]) {
      response=await request(main,"DELETE",target); assert.strictEqual(response.status,200); assert.strictEqual(json(response).handler,"delete");
      assert(!response.body.includes("STATIC CONTENT") && !response.body.includes("MEDIA CONTENT") && !response.body.includes("wrong servlet"));
    }
    response=await request(main,"DELETE","/no-body"); assert.strictEqual(response.status,200);
    for(const bodyCase of [
      ["/json?q=kept","application/json",['{"a":',"1}"]],
      ["/form?q=kept","application/x-www-form-urlencoded",["a=1&","b=2"]],
      ["/raw","application/octet-stream",[Buffer.from([0,1,2]),Buffer.from("raw")]]
    ]) {
      response=await request(main,"PUT",bodyCase[0],{"Content-Type":bodyCase[1]},bodyCase[2]);
      value=json(response); assert.strictEqual(value.handler,"body"); assert.deepStrictEqual(value.params,[]);
      assert.strictEqual(value.url,bodyCase[0]); assert.strictEqual(value.contentType,bodyCase[1]);
      const expectedBody=Buffer.concat(bodyCase[2].map(v => Buffer.isBuffer(v)?v:Buffer.from(v)));
      assert.strictEqual(value.bodyBase64,expectedBody.toString("base64"));
    }
    const xml='<root><item id="1"/><item>two</item></root>';
    response=await request(main,"PROPPATCH","/xml",{"Content-Type":"application/xml"},[xml.slice(0,12),xml.slice(12)]);
    value=json(response); assert.strictEqual(value.elements,2); assert.strictEqual(value.body,xml);
    response=await request(main,"MKCOL","/loader"); assert.strictEqual(response.body,"cjs-load|esm-load");
    response=await request(main,"LOCK","/async"); assert.strictEqual(response.body,"async-complete");
    const reloadPath=path.join(__dirname,"application-two","servlets","reload.jss");
    const reloadOriginal=require("node:fs").readFileSync(reloadPath,"utf8");
    try {
      response=await request(main,"CHECKOUT","/reload"); assert.strictEqual(response.body,"reload-one");
      await new Promise(resolve => setTimeout(resolve,20));
      require("node:fs").writeFileSync(reloadPath,'exports.servlet=function () { return "reload-two"; };\n');
      response=await request(main,"CHECKOUT","/reload"); assert.strictEqual(response.body,"reload-two");
    } finally { require("node:fs").writeFileSync(reloadPath,reloadOriginal); }
    response=await request(main,"UNSUBSCRIBE","/target"); assert.strictEqual(response.status,501);

    for(const method of ["PROPFIND","COPY","MOVE"]) {
      response=await request(main,method,"/target"); assert.strictEqual(response.status,500); assert.strictEqual(response.body,"Registered method handler is unavailable.");
      assert(!response.body.includes("application-two") && !response.body.includes("servlets"));
    }
    response=await request(main,"UNLOCK","/target"); assert.strictEqual(response.status,500); assert(!response.body.includes("C:\\projects"));

    const expected="GET, HEAD, POST, OPTIONS, DELETE, MiXeD, PATCH, PURGE, TRACE, PUT, PROPPATCH, MKCOL, LOCK, CHECKOUT, PROPFIND, COPY, MOVE, UNLOCK";
    response=await request(main,"OPTIONS","*"); assert.strictEqual(response.headers.allow,expected); assert(!response.headers.allow.includes("CONNECT"));
    response=await request(main,"OPTIONS","/allowed/item"); assert.strictEqual(response.headers.allow,expected);
    response=await request(main,"OPTIONS","/allowed/item",{Origin:"http://target.example","Access-Control-Request-Method":"DELETE","Sec-Fetch-Site":"cross-site"});
    assert.strictEqual(response.headers["access-control-allow-methods"],expected);
    assert.strictEqual(new Set(expected.split(", ")).size,expected.split(", ").length);
    response=await request(main,"DELETE","/allowed/item?query=ignored",{Origin:"http://target.example","Sec-Fetch-Site":"cross-site"});
    assert.strictEqual(response.status,200); assert.strictEqual(response.headers["access-control-allow-origin"],"http://target.example");
    response=await request(main,"DELETE","/allowed/item",{Origin:"http://handler.example","Sec-Fetch-Site":"cross-site"}); assert.strictEqual(response.status,403);
    response=await request(main,"DELETE","/denied/item",{Origin:"http://target.example","Sec-Fetch-Site":"cross-site"}); assert.strictEqual(response.status,403);
  } finally { await stop(main); }

  for(const protocol of ["https","http2","http2s"]) {
    const testCase=await start(protocol);
    try {
      const response=await request(testCase,"DELETE","/protocol/"+protocol);
      assert.strictEqual(response.status,200); assert.strictEqual(json(response).handler,"delete");
      if (protocol.startsWith("http2")) {
        const mixed=await request(testCase,"MiXeD","/protocol/mixed");
        assert.strictEqual(mixed.status,200); assert.strictEqual(json(mixed).method,"MiXeD");
      }
    } finally { await stop(testCase); }
  }
  console.log("Registered method handler verification passed.");
}()).catch(function (err) { console.error(err); process.exitCode=1; });