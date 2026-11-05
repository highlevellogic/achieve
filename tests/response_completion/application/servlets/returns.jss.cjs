exports.servlet=function (session) {
    switch (session.params.kind) {
        case "string": return "hello";
        case "buffer": return Buffer.from([0,1,2,253,254,255]);
        case "uint8": return new Uint8Array([3,4,5,250,251,252]);
        case "promise": return Promise.resolve("promised");
        case "undefined": return undefined;
        case "null": return null;
        case "empty": return "";
        case "headers":
            session.response.setHeader("X-Servlet","preserved");
            return "headers";
        case "length":
            session.response.setHeader("Content-Length","5");
            return "hello";
        case "status":
            session.response.statusCode=201;
            return "status";
        case "not-found":
            session.response.statusCode=404;
            return "not found";
        case "not-found-null":
            session.response.statusCode=404;
            return null;
        case "not-found-undefined":
            session.response.statusCode=404;
            return undefined;
        case "promise-status":
            session.response.statusCode=201;
            return Promise.resolve("promised status");
        case "promise-null-status":
            session.response.statusCode=404;
            return Promise.resolve(null);
        case "thenable-status":
            session.response.statusCode=202;
            return {then(resolve) { resolve("thenable status"); }};
        case "thenable-null-status":
            session.response.statusCode=409;
            return {then(resolve) { resolve(undefined); }};
        case "reset-string":
            session.response.statusCode=205;
            session.response.setHeader("Content-Length","16");
            return "forbidden string";
        case "reset-buffer":
            session.response.statusCode=205;
            if (session.request.httpVersion !== "2.0") {
                session.response.setHeader("Transfer-Encoding","chunked");
            }
            return Buffer.from("forbidden buffer");
        case "reset-uint8":
            session.response.statusCode=205;
            return new Uint8Array([1,2,3,4]);
        case "reset-promise":
            session.response.statusCode=205;
            return Promise.resolve("forbidden promise");
        case "reset-owned-end":
            session.autoEnd=false;
            session.response.statusCode=205;
            session.response.setHeader("Content-Length","16");
            session.response.end(Buffer.from("forbidden buffer"));
            return "ignored";
        case "reset-owned-write":
            session.autoEnd=false;
            session.response.statusCode=205;
            if (session.request.httpVersion !== "2.0") {
                session.response.setHeader("Transfer-Encoding","chunked");
            }
            session.response.write(new Uint8Array([1,2,3,4]));
            session.response.end();
            return "ignored";
        case "reset-owned-write-head":
            session.autoEnd=false;
            session.response.writeHead(205,{
                "Content-Length":"16",
                "Transfer-Encoding":"chunked",
                "X-Reset":"preserved"
            });
            session.response.end("forbidden string");
            return "ignored";
        case "reset-owned-flush":
            session.autoEnd=false;
            session.response.statusCode=205;
            session.response.setHeader("Content-Length","16");
            session.response.flushHeaders();
            session.response.end("forbidden string");
            return "ignored";
        case "reset-write-head-message":
            session.autoEnd=false;
            session.response.writeHead(205,"Reset Content",{
                "Content-Length":"16",
                "X-Reset-Form":"message"
            });
            session.response.end("forbidden string");
            return "ignored";
        case "reset-write-head-array":
            session.autoEnd=false;
            session.response.writeHead(205,[
                "Content-Length","16",
                "Transfer-Encoding","chunked",
                "X-Reset-Form","array"
            ]);
            session.response.end("forbidden string");
            return "ignored";
        case "reset-invalid-write":
            session.response.statusCode=205;
            try {
                session.response.write({invalid:true});
            } catch (error) {
                console.log("RESET_INVALID_WRITE " + error.code);
                session.response.statusCode=200;
                return error.code;
            }
            return "invalid write accepted";
        case "reset-invalid-end":
            session.response.statusCode=205;
            try {
                session.response.end({invalid:true});
            } catch (error) {
                console.log("RESET_INVALID_END " + error.code);
                session.response.statusCode=200;
                return error.code;
            }
            return "invalid end accepted";
        case "reset-callback": {
            session.autoEnd=false;
            session.response.statusCode=205;
            session.response.on("error",() => {});
            const order=["before"];
            session.response.write("forbidden",error => {
                order.push(error ? error.code : "callback");
                console.log("RESET_CALLBACK " + order.join(","));
            });
            order.push("after");
            session.response.end();
            return "ignored";
        }
        case "reset-after-end":
            session.autoEnd=false;
            session.response.statusCode=205;
            session.response.on("error",() => {});
            session.response.end();
            session.response.write("forbidden",error => {
                console.log("RESET_AFTER_END " + (error && error.code));
            });
            return "ignored";
        case "reset-after-destroy":
            session.autoEnd=false;
            session.response.statusCode=205;
            session.response.on("error",() => {});
            session.response.destroy();
            session.response.write("forbidden",error => {
                console.log("RESET_AFTER_DESTROY " + (error && error.code));
            });
            return "ignored";
        case "invalid": return {};
        case "sync-delayed":
            session.autoEnd=false;
            setTimeout(() => session.response.end("Delayed response"),50);
            return "ignored";
        case "async-before-await":
            return (async function () {
                session.autoEnd=false;
                await Promise.resolve();
                setTimeout(() => session.response.end("Delayed response"),50);
            })();
        case "async-after-await":
        case "async-after-await-value":
            return (async function () {
                await Promise.resolve();
                session.autoEnd=false;
                setTimeout(() => {
                    session.response.setHeader("X-Delayed","preserved");
                    session.response.end("Delayed response");
                },50);
                if (session.params.kind === "async-after-await-value") return "ignored";
            })();
        case "async-normal":
            return (async function () {
                await Promise.resolve();
                return "async normal";
            })();
        case "async-reject":
            return (async function () {
                await Promise.resolve();
                throw new Error("Async completion failure");
            })();
        case "head-async-reject":
            return (async function () {
                await Promise.resolve();
                throw new Error("HEAD asynchronous completion failure");
            })();
        case "async-owned-reject":
            return (async function () {
                await Promise.resolve();
                session.autoEnd=false;
                throw new Error("Async completion failure");
            })();
        case "sync-throw":
            throw new Error("Sync completion failure");
        case "head-sync-throw":
            throw new Error("HEAD synchronous completion failure");
        case "auto-default":
            return JSON.stringify({autoEnd:session.autoEnd,allowAsync:session.allowAsync});
        case "auto-owned":
            session.autoEnd=false;
            session.response.statusCode=202;
            session.response.end("autoEnd application owned");
            return "ignored";
        case "auto-restored":
            session.autoEnd=false;
            session.autoEnd=true;
            return JSON.stringify({autoEnd:session.autoEnd,allowAsync:session.allowAsync});
        case "alias-owned":
            session.allowAsync=true;
            session.response.statusCode=202;
            session.response.end("allowAsync application owned");
            return "ignored";
        case "alias-restored":
            session.autoEnd=false;
            session.allowAsync=false;
            return JSON.stringify({autoEnd:session.autoEnd,allowAsync:session.allowAsync});
        case "auto-last":
            session.allowAsync=true;
            session.autoEnd=true;
            return JSON.stringify({autoEnd:session.autoEnd,allowAsync:session.allowAsync});
        case "alias-last":
            session.autoEnd=true;
            session.allowAsync=true;
            session.response.statusCode=202;
            session.response.end(JSON.stringify({autoEnd:session.autoEnd,allowAsync:session.allowAsync}));
            return "ignored";
    }
};
