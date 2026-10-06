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
        case "invalid": return {};
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
