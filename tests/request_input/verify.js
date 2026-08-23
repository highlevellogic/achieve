const childProcess=require("node:child_process");
const http=require("node:http");
const net=require("node:net");
const path=require("node:path");

let failures=0;

function check(name,condition,detail="") {
    if (condition) console.log("PASS",name,detail);
    else {
        failures++;
        console.error("FAIL",name,detail);
    }
}

function wait(child,event) {
    return new Promise(function (resolve,reject) {
        const timer=setTimeout(function () {
            cleanup();
            reject(new Error("Timed out waiting for "+event));
        },10000);
        function cleanup() {
            clearTimeout(timer);
            child.off("message",listener);
            child.off("exit",exited);
        }
        function listener(message) {
            if (message.event !== event) return;
            cleanup();
            resolve(message);
        }
        function exited(code) {
            cleanup();
            reject(new Error("Fixture exited before "+event+": "+code));
        }
        child.on("message",listener);
        child.once("exit",exited);
    });
}

function request(port,options,body="",chunks) {
    return new Promise(function (resolve,reject) {
        const req=http.request(Object.assign({host:"127.0.0.1",port:port,method:"GET"},options),function (res) {
            const received=[];
            res.on("data",chunk => received.push(chunk));
            res.on("end",function () {
                resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(received).toString()});
            });
        });
        req.on("error",reject);
        if (chunks) {
            for (let chunk of chunks) req.write(chunk);
            req.end();
        } else {
            req.end(body);
        }
    });
}

function abortXmlRequest(port) {
    return new Promise(function (resolve,reject) {
        const socket=net.connect(port,"127.0.0.1",function () {
            socket.write(
                "POST /servlets/sax.jss HTTP/1.1\r\n"+
                "Host: 127.0.0.1:"+port+"\r\n"+
                "Content-Type: application/xml;charset=utf-8\r\n"+
                "Content-Length: 1000\r\n\r\n"+
                "<root><item>partial"
            );
            setImmediate(function () { socket.destroy(); });
        });
        socket.on("error",function (err) {
            if (err.code === "ECONNRESET") resolve();
            else reject(err);
        });
        socket.on("close",resolve);
    });
}

async function withFixture(file,port,run) {
    const child=childProcess.fork(path.join(__dirname,file),[],{
        silent:true,
        env:Object.assign({},process.env,{ACHIEVE_REQUEST_INPUT_PORT:String(port)})
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    try {
        await wait(child,"ready");
        await run(child);
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send({command:"stop"});
            await exited;
        }
    }
}

(async function () {
    await withFixture("fixture.js",19190,async function () {
        let response=await request(19190,{path:"/servlets/echo.jss?x=get"});
        check("GET query params",response.status === 200 && JSON.parse(response.body).x === "get");

        response=await request(19190,{method:"HEAD",path:"/servlets/echo.jss?x=head"});
        check("HEAD query params without body buffering",response.status === 200 &&
            response.headers["x-param-x"] === "head" && response.body === "");

        response=await request(19190,{
            method:"POST",path:"/servlets/echo.jss",headers:{"Content-Type":"application/json"}
        },JSON.stringify({x:"json"}));
        check("buffered JSON",response.status === 200 && JSON.parse(response.body).x === "json");

        response=await request(19190,{
            method:"POST",path:"/servlets/echo.jss",headers:{"Content-Type":"Application/JSON"}
        },JSON.stringify({x:"case-insensitive"}));
        check("JSON media type is case-insensitive",response.status === 200 &&
            JSON.parse(response.body).x === "case-insensitive");

        const unicodeValue="räksmörgås";
        const unicodeJson=Buffer.from(JSON.stringify({value:unicodeValue}),"utf8");
        const multibyteStart=unicodeJson.indexOf(Buffer.from("ä","utf8"));
        response=await request(19190,{
            method:"POST",path:"/servlets/echo.jss",headers:{"Content-Type":"application/json"}
        },"",[
            unicodeJson.subarray(0,multibyteStart+1),
            unicodeJson.subarray(multibyteStart+1)
        ]);
        check("buffered JSON preserves split UTF-8 characters",response.status === 200 &&
            JSON.parse(response.body).value === unicodeValue,
            response.status+" "+JSON.stringify(response.body));

        response=await request(19190,{
            method:"POST",path:"/servlets/echo.jss",headers:{"Content-Type":"application/json"}
        },"{");
        check("malformed JSON",response.status === 400 && response.body === "Bad Request: Invalid JSON data.");

        response=await request(19190,{
            method:"POST",path:"/servlets/echo.jss",headers:{"Content-Type":"application/x-www-form-urlencoded"}
        },"x=form");
        check("buffered form",response.status === 200 && JSON.parse(response.body).x === "form");

        response=await request(19190,{method:"POST",path:"/servlets/echo.jss"},"x=legacy");
        check("POST without Content-Type uses legacy form parsing",response.status === 200 &&
            JSON.parse(response.body).x === "legacy");

        const xml="<root><value>streamed</value></root>";
        response=await request(19190,{
            method:"POST",path:"/servlets/raw.jss",headers:{"Content-Type":"application/xml;charset=utf-8"}
        },"",[xml.substring(0,8),xml.substring(8,20),xml.substring(20)]);
        let raw=JSON.parse(response.body);
        check("declared XML remains developer-managed",response.status === 200 &&
            Object.keys(raw.params).length === 0 && raw.chunks > 0 && raw.body === xml);

        const largeRaw="z".repeat(512);
        response=await request(19190,{
            method:"POST",path:"/servlets/raw.jss",headers:{"Content-Type":"text/plain"}
        },largeRaw);
        raw=JSON.parse(response.body);
        check("developer-managed input bypasses Achieve buffer limit",response.status === 200 &&
            raw.body === largeRaw && Object.keys(raw.params).length === 0);

        response=await request(19190,{path:"/servlets/empty.jss"});
        check("undefined servlet return becomes empty 200",response.status === 200 && response.body === "");
        response=await request(19190,{path:"/servlets/null.jss"});
        check("null servlet return becomes empty 200",response.status === 200 && response.body === "");

        const largeJson=JSON.stringify({value:"x".repeat(180)});
        response=await request(19190,{
            method:"POST",path:"/servlets/echo.jss",headers:{"Content-Type":"application/json"}
        },"",[largeJson.substring(0,70),largeJson.substring(70,140),largeJson.substring(140)]);
        check("oversized JSON returns 413",response.status === 413 && response.body === "Payload Too Large");

        response=await request(19190,{
            method:"POST",path:"/servlets/echo.jss",headers:{"Content-Type":"application/x-www-form-urlencoded"}
        },"x="+"y".repeat(180));
        check("oversized form returns 413",response.status === 413 && response.body === "Payload Too Large");

        response=await request(19190,{path:"/servlets/echo.jss?x=alive"});
        check("server survives oversized buffered input",response.status === 200 && JSON.parse(response.body).x === "alive");
    });

    await withFixture("sax-fixture.js",19191,async function () {
        const valid="<?xml version=\"1.0\"?><root><item>one</item><item>two</item></root>";
        let response=await request(19191,{
            method:"POST",path:"/servlets/sax.jss",headers:{"Content-Type":"application/xml;charset=utf-8"}
        },"",[valid.substring(0,17),valid.substring(17,39),valid.substring(39)]);
        check("SAX streamed XML",response.status === 200 && response.body === "completed processing of XML");

        response=await request(19191,{
            method:"POST",path:"/servlets/sax.jss",headers:{"Content-Type":"application/xml;charset=utf-8"}
        },"<root><item></root>");
        check("malformed XML is client error",response.status === 400 && response.body.startsWith("XML parse error:"),
            response.status+" "+JSON.stringify(response.body));

        response=await request(19191,{
            method:"POST",path:"/servlets/sax.jss",headers:{"Content-Type":"application/xml;charset=utf-8"}
        },"<root/>");
        check("server survives malformed XML",response.status === 200);

        await abortXmlRequest(19191);
        await new Promise(resolve => setTimeout(resolve,100));
        response=await request(19191,{
            method:"POST",path:"/servlets/sax.jss",headers:{"Content-Type":"application/xml;charset=utf-8"}
        },"<after-abort/>");
        check("SAX example survives an aborted request stream",response.status === 200);
    });

    if (failures) throw new Error(failures+" request-input verification test(s) failed.");
    console.log("All request-input verification tests passed.");
}()).catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
