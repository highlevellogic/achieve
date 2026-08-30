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

function directRequest(server,target) {
    const requestListener=server.listeners("request")[0];
    const headers={};
    const req={
        method:"GET",
        url:target,
        httpVersion:"2.0",
        headers:{},
        rawHeaders:[],
        socket:{remoteAddress:"direct-test"}
    };
    const res={
        statusCode:200,
        destroyed:false,
        writableEnded:false,
        setHeader:function (name,value) {
            headers[name.toLowerCase()]=value;
        },
        end:function (body) {
            this.body=body === undefined ? "" : String(body);
            this.writableEnded=true;
        }
    };
    requestListener(req,res);
    return {status:res.statusCode,headers:headers,body:res.body};
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

        result=await request("/foo");
        check("origin-form path",result.status === 301 && result.headers.location === "/foo/");

        result=await request("/index.html");
        check("index file",result.status === 200 && result.body.includes("request-path root"));

        result=await request("/foo/bar");
        check("nested resource",result.status === 200 && result.body.includes("nested resource"));

        result=await request("/foo/bar?x=1");
        check("nested resource with query",result.status === 200 && result.body.includes("nested resource"));

        result=await request("/servlets/query.jss?x=1");
        check("origin-form single query value",
            result.status === 200 && result.body === '{"x":"1"}');

        result=await request("/servlets/query.jss?x=1&y=2");
        check("origin-form multiple query values",
            result.status === 200 && result.body === '{"x":"1","y":"2"}');

        result=await request("/servlets/query.jss?x=1?y=2");
        check("origin-form preserves query after first question mark",
            result.status === 200 && result.body === '{"x":"1?y=2"}');

        result=await request("/servlets/query.jss?");
        check("origin-form empty query",result.status === 200 && result.body === "{}");

        result=await rawRequest("/encoded%20name");
        check("origin-form preserves encoded percent-20 pathname",
            result.status === 200 && result.raw.includes("encoded percent-20 pathname"),
            result.status);

        result=await rawRequest("/encoded%2fname");
        check("origin-form preserves encoded percent-2f pathname",
            result.status === 200 && result.raw.includes("encoded percent-2f pathname"),
            result.status);

        result=await rawRequest("/foo#bar");
        check("origin-form raw fragment is not rewritten",
            result.status === 404 && !result.raw.includes("nested resource"),
            result.status);

        result=await request("/accounting/index.html");
        check("URL directory stays in one application",
            result.status === 200 && result.body.includes("accounting directory"));

        result=await request("/servlets/accounting/account.jss");
        check("nested servlet stays in one application",
            result.status === 200 && result.body === "accounting servlet");

        result=await rawRequest("http://localhost:" + port + "/foo/bar?x=1");
        check("absolute-form nested resource",
            result.status === 200 && result.raw.includes("nested resource"),
            result.status + " " + JSON.stringify(result.raw));

        result=await rawRequest("https://localhost:" + port + "/foo/bar?x=1");
        check("HTTPS absolute-form nested resource",
            result.status === 200 && result.raw.includes("nested resource"),
            result.status);

        for (const target of [
            "HTTP://example.com/foo/bar",
            "http://example.com:80/foo/bar",
            "http://example.com:99999/foo/bar",
            "http://example.com:/foo/bar",
            "http://[::1]/foo/bar",
            "http://[::1]:8080/foo/bar",
            "http://[v1.a]/foo/bar",
            "http://[v1.a]:99999/foo/bar"
        ]) {
            result=await rawRequest(target);
            check("absolute-form authority accepted " + JSON.stringify(target),
                result.status === 200 && result.raw.includes("nested resource"),
                result.status);
        }

        result=await rawRequest("http://localhost:" + port);
        check("absolute-form without explicit path",
            result.status === 200 && result.raw.includes("request-path root"),
            result.status);

        result=await rawRequest("http://localhost:" + port + "?x=1");
        check("absolute-form query without explicit path",
            result.status === 200 && result.raw.includes("request-path root"),
            result.status);

        result=await rawRequest("http://localhost:" + port + "/foo/../bar");
        check("absolute-form contained dot segment maps normally",
            result.status === 200 && result.raw.includes("contained dot-segment target"),
            result.status);

        result=await rawRequest("http://localhost:" + port + "/foo/../../secret.txt");
        check("absolute-form raw dot segments reach containment",
            result.status === 404 && !result.raw.includes("inside application secret marker"),
            result.status);

        result=await rawRequest("http://localhost:" + port + "/foo//bar");
        check("absolute-form preserves repeated forward slashes",
            result.status === 200 && result.raw.includes("nested resource"),
            result.status);

        result=await rawRequest("http://localhost:" + port + "/encoded%2fname");
        check("absolute-form preserves encoded pathname",
            result.status === 200 && result.raw.includes("encoded percent-2f pathname"),
            result.status);

        result=await rawRequest("http://localhost:" + port + "/encoded%20name");
        check("absolute-form preserves encoded percent-20 pathname",
            result.status === 200 && result.raw.includes("encoded percent-20 pathname"),
            result.status);

        result=await rawRequest("http://localhost:" + port + "/servlets/query.jss?x=1?y=2");
        check("absolute-form preserves query after first question mark",
            result.status === 200 && result.raw.includes('{"x":"1?y=2"}'),
            result.status);

        result=await rawRequest("http://localhost:" + port + "/foo#bar");
        check("absolute-form fragment is rejected",result.status === 400,result.status);

        result=await rawRequest("ftp://localhost:" + port + "/foo/bar");
        check("non-HTTP absolute-form is rejected",result.status === 400,result.status);

        result=await rawRequest("not-an-absolute-target");
        check("invalid absolute-form is rejected",result.status === 400,result.status);

        for (const target of [
            "http:///foo/bar",
            "http://exa[mple.com/foo/bar",
            "http://example.com:abc/foo/bar",
            "http://::1/foo/bar",
            "http://[::1/foo/bar"
        ]) {
            result=await rawRequest(target);
            check("malformed absolute-form authority rejected " + JSON.stringify(target),
                result.status === 400,
                result.status);
        }

        result=directRequest(server,"http://user@@example.com/foo/bar");
        check("Achieve rejects multiple raw userinfo delimiters",
            result.status === 400 &&
            result.headers["content-type"] === "text/plain;charset=utf-8" &&
            result.body === "Bad Request",
            result.status + " " + result.headers["content-type"] + " " + result.body);

        result=await rawRequest("http://user:pass@example.com/foo/bar");
        check("absolute-form userinfo is rejected",
            result.status === 400 && !result.raw.includes("nested resource"),
            result.status);

        result=await request("/servlets/hello.jss?x=query");
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
