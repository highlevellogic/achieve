const childProcess=require("node:child_process");
const http=require("node:http");
const path=require("node:path");

const port=19180;
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

function crossOrigin(origin,extra={}) {
    return Object.assign({Origin:origin,"Sec-Fetch-Site":"cross-site"},extra);
}

(async function () {
    const child=childProcess.fork(path.join(__dirname,"fixture.js"),[],{
        silent:true,
        env:Object.assign({},process.env,{ACHIEVE_CORS_PORT:String(port)})
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);

    try {
        await wait(child,"ready");

        let response=await request({path:"/public/nested.txt",headers:crossOrigin("http://allowed.example")});
        check("allowed cross-origin request",response.status === 200 &&
            response.body.trim() === "public wildcard path" &&
            response.headers["access-control-allow-origin"] === "http://allowed.example" &&
            response.headers.vary.split(/\s*,\s*/).includes("Accept-Encoding") &&
            response.headers.vary.split(/\s*,\s*/).includes("Origin"));

        response=await request({path:"/public/nested.txt",headers:crossOrigin("http://denied.example")});
        check("disallowed origin",response.status === 403 && response.body === "");

        response=await request({path:"/public/nested.txt",headers:crossOrigin("http://star.example")});
        check("wildcard path covers descendants",response.status === 200 && response.body.trim() === "public wildcard path");

        response=await request({path:"/restricted/allowed.txt",headers:crossOrigin("http://longest.example")});
        check("longest matching path permits its allowed asset",response.status === 200,"status="+response.status);
        response=await request({path:"/restricted/denied.txt",headers:crossOrigin("http://longest.example")});
        check("longest matching path overrides wildcard policy",response.status === 403,"status="+response.status);

        response=await request({path:"/assets/allowed.txt",headers:crossOrigin("http://asset.example")});
        check("specifically allowed asset",response.status === 200,"status="+response.status);
        response=await request({path:"/assets/denied.txt",headers:crossOrigin("http://asset.example")});
        check("asset excluded by applicable policy",response.status === 403,"status="+response.status);

        response=await request({
            method:"OPTIONS",path:"/servlets/echo.jss",
            headers:crossOrigin("http://json.example",{
                "Access-Control-Request-Method":"POST",
                "Access-Control-Request-Headers":"Content-Type"
            })
        });
        check("JSON POST preflight",response.status === 204 && response.body === "" &&
            response.headers["access-control-allow-origin"] === "http://json.example" &&
            response.headers["access-control-allow-methods"] === "GET, HEAD, POST, OPTIONS" &&
            response.headers["access-control-allow-headers"] === "Content-Type");
        response=await request({
            method:"POST",path:"/servlets/echo.jss",
            headers:crossOrigin("http://json.example",{"Content-Type":"application/json"})
        },JSON.stringify({cors:"works"}));
        check("JSON POST after preflight",response.status === 200 && JSON.parse(response.body).cors === "works");

        response=await request({method:"OPTIONS",path:"/public/nested.txt"});
        check("ordinary resource OPTIONS has no CORS preflight headers",
            response.status === 204 && response.body === "" &&
            response.headers.allow === "GET, HEAD, POST, OPTIONS" &&
            response.headers["access-control-allow-origin"] === undefined &&
            response.headers["access-control-allow-methods"] === undefined &&
            response.headers["access-control-allow-headers"] === undefined);

        response=await request({
            path:"/public/nested.txt",
            headers:{Origin:"http://denied.example","Sec-Fetch-Site":"same-origin"}
        });
        check("same-origin request bypasses CORS policy",response.status === 200 && response.body.trim() === "public wildcard path");

        response=await request({method:"OPTIONS",path:"*",headers:crossOrigin("http://denied.example")});
        check("OPTIONS * is server-wide",response.status === 204 && response.body === "" &&
            response.headers.allow === "GET, HEAD, POST, OPTIONS" &&
            response.headers["access-control-allow-origin"] === undefined);

        response=await request({path:"/docs/",headers:crossOrigin("http://directory.example")});
        check("directory policy uses resolved default asset",response.status === 200 &&
            response.body.trim() === "directory default","status="+response.status);

        await request({path:"/servlets/echo.jss"});
        for (let method of ["GET","POST","HEAD"]) {
            response=await request({
                method:method,path:"/servlets/echo.jss",
                headers:crossOrigin("http://denied.example",method === "POST" ? {"Content-Type":"application/json"} : {})
            },method === "POST" ? "{}" : "");
            check("cached servlet cannot bypass CORS: "+method,response.status === 403,"status="+response.status);
        }
    } finally {
        if (child.exitCode === null) {
            const exited=new Promise(resolve => child.once("exit",resolve));
            child.send({command:"stop"});
            await exited;
        }
    }

    if (failures) throw new Error(failures+" CORS verification test(s) failed.");
    console.log("All CORS verification tests passed.");
}()).catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
