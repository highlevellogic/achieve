const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

let failures = 0;

function check(name, condition, detail) {
    console.log((condition ? "PASS" : "FAIL") + " " + name + (detail === undefined ? "" : ": " + detail));
    if (!condition) failures++;
}

function removeTree(target) {
    if (!fs.existsSync(target)) return;
    for (const entry of fs.readdirSync(target, {withFileTypes: true})) {
        const entryPath = path.join(target, entry.name);
        if (entry.isDirectory()) {
            removeTree(entryPath);
        } else {
            fs.unlinkSync(entryPath);
        }
    }
    fs.rmdirSync(target);
}

function request(port, options) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            port: port,
            method: options.method || "GET",
            path: options.path,
            headers: options.headers || {}
        }, res => {
            const chunks = [];
            res.on("data", chunk => chunks.push(chunk));
            res.on("end", () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks)}));
        });
        req.on("error", reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

function startServer(port, caching, compression) {
    return new Promise((resolve, reject) => {
        const child = childProcess.spawn(process.execPath, [path.join(__dirname, "fixture.js")], {
            cwd: path.join(__dirname, "..", ".."),
            env: Object.assign({}, process.env, {
                ACHIEVE_CONDITIONAL_PORT: String(port),
                ACHIEVE_CONDITIONAL_CACHING: String(caching),
                ACHIEVE_CONDITIONAL_COMPRESSION: String(compression)
            }),
            stdio: ["ignore", "pipe", "pipe"]
        });
        let output = "";
        let settled = false;
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", data => {
            output += data;
            process.stdout.write(data);
            const match = output.match(/CONDITIONAL_READY (\d+) ([^\r\n]+)/);
            if (match && !settled) {
                settled = true;
                resolve({child: child, port: Number(match[1]), applicationPath: match[2]});
            }
        });
        child.stderr.on("data", data => process.stderr.write(data));
        child.on("error", err => {
            if (!settled) {
                settled = true;
                reject(err);
            }
        });
        child.on("exit", code => {
            if (!settled) {
                settled = true;
                reject(new Error("Conditional server exited before readiness with code " + code));
            }
        });
    });
}

function stopServer(serverInfo) {
    return new Promise(resolve => {
        function finished() {
            removeTree(serverInfo.applicationPath);
            resolve();
        }
        if (serverInfo.child.exitCode !== null) return finished();
        serverInfo.child.once("exit", finished);
        serverInfo.child.kill();
    });
}

function waitForCurrentArtifact(sourcePath,artifactPath,timeout=5000) {
    return new Promise((resolve,reject) => {
        const started=Date.now();
        function inspect() {
            try {
                const sourceStats=fs.statSync(sourcePath);
                const artifactStats=fs.statSync(artifactPath);
                if (sourceStats.mtimeMs <= artifactStats.mtimeMs) {
                    resolve();
                    return;
                }
            } catch (err) {
                if (err.code !== "ENOENT") {
                    reject(err);
                    return;
                }
            }
            if (Date.now()-started >= timeout) {
                reject(new Error("Timed out waiting for compressed artifact: " + artifactPath));
                return;
            }
            setTimeout(inspect,10);
        }
        inspect();
    });
}

async function staticTests(server) {
    const identity = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity"}});
    const firstGzip = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "gzip"}});
    const sourcePath = path.join(server.applicationPath,"static","resource.txt");
    const cachePath = path.join(server.applicationPath,".compression-cache","static","resource.txt");
    await waitForCurrentArtifact(sourcePath,cachePath+".gz");
    const gzip = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "gzip"}});
    const firstDeflate = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "deflate"}});
    await waitForCurrentArtifact(sourcePath,cachePath+".zl");
    const deflate = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "deflate"}});
    const identityTag = identity.headers.etag;
    const gzipTag = gzip.headers.etag;
    const deflateTag = deflate.headers.etag;

    check("static identity 200", identity.status === 200);
    check("first gzip miss returns identity", firstGzip.status === 200 && firstGzip.headers["content-encoding"] === undefined);
    check("first deflate miss returns identity", firstDeflate.status === 200 && firstDeflate.headers["content-encoding"] === undefined);
    check("identity ETag suffix", /-i"$/.test(identityTag), identityTag);
    check("gzip ETag suffix", /-g"$/.test(gzipTag), gzipTag);
    check("deflate ETag suffix", /-d"$/.test(deflateTag), deflateTag);
    check("representation ETags distinct", new Set([identityTag, gzipTag, deflateTag]).size === 3);
    check("representation ETags remain strong entity tags", [identityTag, gzipTag, deflateTag].every(tag => /^"[^"]+"$/.test(tag) && !tag.startsWith("W/")));
    check("gzip Content-Encoding", gzip.headers["content-encoding"] === "gzip");
    check("deflate Content-Encoding", deflate.headers["content-encoding"] === "deflate");
    check("Vary identity", identity.headers.vary === "Accept-Encoding");
    check("Vary gzip", gzip.headers.vary === "Accept-Encoding");

    let result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": identityTag}});
    check("same-representation If-None-Match", result.status === 304);
    check("304 ETag metadata", result.headers.etag === identityTag);
    check("304 Vary metadata", result.headers.vary === "Accept-Encoding");

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "gzip", "If-None-Match": identityTag}});
    check("cross-representation validator", result.status === 200);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": ' "other" , ' + identityTag + " "}});
    check("If-None-Match list and whitespace", result.status === 304);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": "W/" + identityTag}});
    check("weak If-None-Match comparison", result.status === 304);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": "*"}});
    check("If-None-Match wildcard GET", result.status === 304);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-Match": identityTag}});
    check("strong If-Match", result.status === 200);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-Match": ' "other" , ' + identityTag}});
    check("If-Match list", result.status === 200);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-Match": "W/" + identityTag}});
    check("weak If-Match fails", result.status === 412);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-Match": "*"}});
    check("If-Match wildcard", result.status === 200);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-Match": '"stale"', "If-None-Match": identityTag}});
    check("If-Match precedence", result.status === 412);

    result = await request(server.port, {method: "HEAD", path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": identityTag}});
    check("HEAD matching If-None-Match", result.status === 304 && result.body.length === 0);

    result = await request(server.port, {method: "POST", path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": identityTag}});
    check("POST matching If-None-Match", result.status === 412);

    return identityTag;
}

async function servletTests(server) {
    let result = await request(server.port, {path: "/servlets/counter.jss"});
    check("servlet has no automatic ETag", result.status === 200 && result.headers.etag === undefined);
    check("counter starts at zero", result.body.toString() === "0");

    result = await request(server.port, {path: "/servlets/counter.jss", headers: {"If-Match": "*"}});
    check("servlet If-Match wildcard", result.status === 200);

    result = await request(server.port, {path: "/servlets/counter.jss", headers: {"If-Match": '"specific"'}});
    check("servlet specific If-Match fails", result.status === 412);

    result = await request(server.port, {path: "/servlets/counter.jss", headers: {"If-None-Match": "*"}});
    check("servlet GET If-None-Match wildcard", result.status === 304);

    result = await request(server.port, {method: "HEAD", path: "/servlets/counter.jss", headers: {"If-None-Match": "*"}});
    check("servlet HEAD If-None-Match wildcard", result.status === 304 && result.body.length === 0);

    result = await request(server.port, {method: "POST", path: "/servlets/counter.jss", headers: {"If-None-Match": "*"}, body: "value=1"});
    check("servlet POST If-None-Match wildcard", result.status === 412);

    result = await request(server.port, {path: "/servlets/counter.jss"});
    check("failed POST did not execute servlet", result.body.toString() === "0");

    result = await request(server.port, {path: "/servlets/counter.jss", headers: {"If-None-Match": '"specific"'}});
    check("servlet specific If-None-Match proceeds", result.status === 200);
}

async function mediaTests(server) {
    const ordinary = await request(server.port, {path: "/media/sample.mp4"});
    const tag = ordinary.headers.etag;
    check("media ordinary GET", ordinary.status === 200);
    check("media identity ETag", /-i"$/.test(tag), tag);

    let result = await request(server.port, {path: "/media/sample.mp4", headers: {"If-None-Match": tag}});
    check("media If-None-Match", result.status === 304);

    result = await request(server.port, {path: "/media/sample.mp4", headers: {"If-Match": tag}});
    check("media If-Match", result.status === 200);

    result = await request(server.port, {path: "/media/sample.mp4", headers: {Range: "bytes=0-9", "If-Range": tag}});
    check("matching strong If-Range", result.status === 206 && result.body.length === 10);

    for (const test of [
        ["stale If-Range", '"stale"'],
        ["weak If-Range", "W/" + tag],
        ["date-form If-Range", "Wed, 21 Oct 2015 07:28:00 GMT"]
    ]) {
        result = await request(server.port, {path: "/media/sample.mp4", headers: {Range: "bytes=0-9", "If-Range": test[1]}});
        check(test[0] + " returns full 200", result.status === 200 && result.headers["content-range"] === undefined && result.body.length === ordinary.body.length);
    }

    result = await request(server.port, {path: "/media/sample.mp4", headers: {Range: "bytes=abc-def"}});
    check("malformed Range unchanged", result.status === 400);

    result = await request(server.port, {path: "/media/sample.mp4", headers: {Range: "bytes=999999999-"}});
    check("unsatisfiable Range unchanged", result.status === 416 && /^bytes \*\//.test(result.headers["content-range"]));
}

async function sourceChangeTest(server, oldTag) {
    const resourcePath = path.join(server.applicationPath, "static", "resource.txt");
    const sameSizeFirst = "A".repeat(64);
    const sameSizeSecond = "B".repeat(64);
    const secondBase = Math.floor(Date.now() / 1000) + 2;

    fs.writeFileSync(resourcePath, sameSizeFirst);
    fs.utimesSync(resourcePath, secondBase + 0.1231, secondBase + 0.1231);
    const firstStats = fs.statSync(resourcePath);
    const first = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity"}});

    fs.writeFileSync(resourcePath, sameSizeSecond);
    fs.utimesSync(resourcePath, secondBase + 0.1238, secondBase + 0.1238);
    const secondStats = fs.statSync(resourcePath);
    const changed = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity"}});
    check(
        "sub-millisecond fixture timestamps are distinguishable within one millisecond",
        firstStats.mtimeMs !== secondStats.mtimeMs && Math.floor(firstStats.mtimeMs) === Math.floor(secondStats.mtimeMs),
        JSON.stringify({first:firstStats.mtimeMs,second:secondStats.mtimeMs})
    );
    check(
        "same-size sub-millisecond source change changes strong ETag",
        /^"[^"]+"$/.test(changed.headers.etag) && !changed.headers.etag.startsWith("W/") && changed.headers.etag !== first.headers.etag,
        changed.headers.etag
    );

    const preservedMtimeSeconds = secondStats.mtimeMs / 1000;
    fs.writeFileSync(resourcePath, sameSizeSecond + "larger");
    fs.utimesSync(resourcePath, preservedMtimeSeconds, preservedMtimeSeconds);
    const sizeStats = fs.statSync(resourcePath);
    const sizeChanged = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity"}});
    check(
        "file size participates in strong ETag identity",
        sizeStats.mtimeMs === secondStats.mtimeMs && /^"[^"]+"$/.test(sizeChanged.headers.etag) && sizeChanged.headers.etag !== changed.headers.etag,
        sizeChanged.headers.etag
    );

    const oldValidator = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": oldTag}});
    check("old validator after source change", oldValidator.status === 200);
}

async function cachingDisabledTests(server) {
    let result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity"}});
    check("caching disabled ordinary response has no ETag", result.headers.etag === undefined);

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": '"stale"'}});
    const tag = result.headers.etag;
    check("explicit precondition generates ETag with caching disabled", result.status === 200 && Boolean(tag));

    result = await request(server.port, {path: "/static/resource.txt", headers: {"Accept-Encoding": "identity", "If-None-Match": tag}});
    check("generated validator works with caching disabled", result.status === 304);
}

(async function () {
    const primary = await startServer(19020, true, true);
    try {
        const identityTag = await staticTests(primary);
        await servletTests(primary);
        await mediaTests(primary);
        await sourceChangeTest(primary, identityTag);
    } finally {
        await stopServer(primary);
    }

    const uncached = await startServer(19021, false, false);
    try {
        await cachingDisabledTests(uncached);
    } finally {
        await stopServer(uncached);
    }

    if (failures) {
        console.error(failures + " conditional verification test(s) failed.");
        process.exitCode = 1;
    } else {
        console.log("All conditional verification tests passed.");
    }
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
