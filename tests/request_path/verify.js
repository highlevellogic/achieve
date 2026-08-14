const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const achieve = require("../../achieve");

const applicationPath = path.join(__dirname,"application");
const port = 19160;
let failures = 0;

function check(name,condition,detail) {
    console.log((condition ? "PASS" : "FAIL") + " " + name +
        (detail === undefined ? "" : ": " + detail));
    if (!condition) failures++;
}

function request(requestPath) {
    return new Promise((resolve,reject) => {
        const req = http.request({port:port,path:requestPath},function (res) {
            const chunks = [];
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
        req.end();
    });
}

function rawRequest(target) {
    return new Promise((resolve,reject) => {
        const socket = net.createConnection({port:port},function () {
            socket.write(
                "GET " + target + " HTTP/1.1\r\n" +
                "Host: localhost\r\n" +
                "Connection: close\r\n\r\n"
            );
        });
        let response="";
        socket.setEncoding("latin1");
        socket.on("data",data => response+=data);
        socket.on("end",function () {
            let statusMatch=response.match(/^HTTP\/1\.1 (\d{3})/);
            resolve({status:statusMatch ? Number(statusMatch[1]) : 0,raw:response});
        });
        socket.on("error",reject);
    });
}

(async function () {
    achieve.setAppPath(applicationPath);
    const server=achieve.listen(port);
    if (!server) throw new Error("request-path verifier listener did not start");
    if (!server.listening) {
        await new Promise(resolve => server.once("listening",resolve));
    }

    try {
        let result=await request("/");
        check("application root",result.status === 200 && result.body.includes("request-path root"));

        result=await request("/index.html");
        check("index file",result.status === 200 && result.body.includes("request-path root"));

        result=await request("/foo/bar");
        check("nested resource",result.status === 200 && result.body.includes("nested resource"));

        result=await request("/foo/bar?x=1");
        check("nested resource with query",result.status === 200 && result.body.includes("nested resource"));

        result=await request("/accounting/index.html");
        check("URL directory stays in one application",
            result.status === 200 && result.body.includes("accounting directory"));

        result=await request("/servlets/accounting/account");
        check("nested servlet stays in one application",
            result.status === 200 && result.body === "accounting servlet");

        result=await rawRequest("http://localhost:" + port + "/foo/bar?x=1");
        check("absolute-form nested resource",
            result.status === 200 && result.raw.includes("nested resource"),
            result.status + " " + JSON.stringify(result.raw));

        result=await request("/servlets/hello?x=query");
        check("jss servlet and query",result.status === 200 && result.body === "hello query");

        result=await request("/servlets/legacy");
        check("legacy extensionless servlet",result.status === 200 && result.body === "legacy servlet");

        result=await request("/directory?x=1");
        check("directory redirect with query",
            result.status === 301 && result.headers.location === "/directory/?x=1",
            result.status + " " + result.headers.location);

        const outsideSecret=fs.readFileSync(path.join(__dirname,"secret.txt"),"utf8");
        check("outside containment fixture exists",
            outsideSecret.includes("outside application boundary"));

        result=await request("/../secret.txt");
        check("parent escape is rejected by containment",
            result.status === 404 && !result.body.includes("outside application boundary"),
            result.status);

        result=await request("/foo/../../secret.txt");
        check("nested parent escape is rejected by containment",
            result.status === 404 && !result.body.includes("outside application boundary"),
            result.status);

        result=await rawRequest("/foo/../bar");
        check("contained dot segment maps normally",
            result.status === 200 && result.raw.includes("contained dot-segment target"),
            result.status);

        result=await rawRequest("/accounting/../bar");
        check("first segment does not change containment boundary",
            result.status === 200 && result.raw.includes("contained dot-segment target"),
            result.status);

        for (const target of ["/foo//bar","//foo/bar","///foo/bar"]) {
            result=await rawRequest(target);
            check("repeated forward slash maps normally " + JSON.stringify(target),
                result.status === 200 && result.raw.includes("nested resource"),
                result.status);
        }

        for (const target of ["/foo\\bar","/\\foo/bar"]) {
            result=await rawRequest(target);
            check("raw backslash is rejected " + JSON.stringify(target),
                result.status === 400 && !result.raw.includes("nested resource"),
                result.status);
        }

        result=await rawRequest("http://localhost:" + port + "/foo\\bar");
        check("absolute-form raw backslash is rejected",
            result.status === 400 && !result.raw.includes("nested resource"),
            result.status);

        result=await rawRequest("/foo/bar?value=one\\two");
        check("query backslash does not reject resource pathname",
            result.status === 200 && result.raw.includes("nested resource"),
            result.status);

        result=await request("/servlets/legacy.js");
        check("explicit legacy .js remains static",
            result.status === 200 && result.body.includes("exports.servlet"));
    } finally {
        await new Promise(resolve => server.close(resolve));
    }

    check("application fixture remains intact",fs.existsSync(path.join(applicationPath,"foo","bar")));
    if (failures) process.exitCode=1;
})().catch(function (err) {
    console.error(err);
    process.exitCode=1;
});
