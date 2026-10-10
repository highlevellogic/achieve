const childProcess=require("node:child_process");
const http=require("node:http");
const path=require("node:path");

const port=19170;
let failures=0;

function check(name,condition,detail="") {
    if (condition) {
        console.log("PASS",name,detail);
    } else {
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

function request(options,body="") {
    return new Promise(function (resolve,reject) {
        const req=http.request(Object.assign({
            host:"127.0.0.1",
            port:port,
            path:"/servlets/echo.jss",
            method:"GET"
        },options),function (res) {
            const chunks=[];
            res.on("data",chunk => chunks.push(chunk));
            res.on("end",function () {
                resolve({
                    status:res.statusCode,
                    headers:res.headers,
                    body:Buffer.concat(chunks).toString()
                });
            });
        });
        req.on("error",reject);
        req.end(body);
    });
}

function parsedBody(response) {
    return JSON.parse(response.body);
}

(async function () {
    let output="";
    const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
        silent:true,
        env:Object.assign({},process.env,{ACHIEVE_REQUEST_METHODS_PORT:String(port)})
    });
    child.stdout.on("data",data => { output+=data; });
    child.stderr.on("data",data => { output+=data; });

    try {
        await wait(child,"ready");

        let response=await request({path:"/servlets/echo.jss?x=one&y=two"});
        let value=parsedBody(response);
        check("GET session.params",response.status === 200 &&
            value.params.x === "one" && value.params.y === "two");
        check("GET does not populate request.get",value.requestHasGet === false);

        response=await request({
            method:"POST",
            headers:{"Content-Type":"application/x-www-form-urlencoded"}
        },"x=form&y=post");
        value=parsedBody(response);
        check("form POST session.params",response.status === 200 &&
            value.params.x === "form" && value.params.y === "post");
        check("form POST does not populate request.post",value.requestHasPost === false);

        response=await request({
            method:"POST",
            headers:{"Content-Type":"application/json"}
        },JSON.stringify({x:"json",count:2}));
        value=parsedBody(response);
        check("JSON POST session.params",response.status === 200 &&
            value.params.x === "json" && value.params.count === 2);

        const swedishText="ÅÄÖ åäö räksmörgås";
        response=await request({
            method:"POST",
            headers:{"Content-Type":"application/json"}
        },JSON.stringify({text:swedishText}));
        value=parsedBody(response);
        check("POST string response uses UTF-8",response.status === 200 &&
            value.params.text === swedishText);

        response=await request({
            method:"POST",
            headers:{"Content-Type":"application/json; charset=utf-8"}
        },JSON.stringify({charset:true}));
        value=parsedBody(response);
        check("JSON POST content-type parameter",response.status === 200 &&
            value.params.charset === true);

        response=await request({
            method:"POST",
            headers:{"Content-Type":"application/json"}
        },'{"broken":');
        check("malformed JSON response",response.status === 400 &&
            response.body === "Bad Request: Invalid JSON data.",
            response.status+" "+JSON.stringify(response.body));

        response=await request({path:"/servlets/echo.jss?after=invalid-json"});
        value=parsedBody(response);
        check("server survives malformed JSON",response.status === 200 &&
            value.params.after === "invalid-json");

        response=await request({method:"OPTIONS",path:"/resource"});
        check("OPTIONS resource status and body",response.status === 204 && response.body === "");
        check("OPTIONS Allow header",response.headers.allow === "GET, HEAD, POST, OPTIONS",
            String(response.headers.allow));
        check("OPTIONS does not activate CORS policy",
            response.headers["access-control-allow-origin"] === undefined &&
            response.headers["access-control-allow-headers"] === undefined &&
            response.headers["access-control-max-age"] === undefined);

        response=await request({method:"OPTIONS",path:"*"});
        check("OPTIONS asterisk-form",response.status === 204 && response.body === "");

        response=await request({method:"PUT",path:"/resource"});
        check("unsupported method remains 501",response.status === 501);

        check("OPTIONS respects disabled console logging",!output.includes("OPTIONS REQUEST"));
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send({command:"stop"});
            await exited;
        }
    }

    if (failures) throw new Error(failures+" request-method verification test(s) failed.");
    console.log("All request-method verification tests passed.");
}()).catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
