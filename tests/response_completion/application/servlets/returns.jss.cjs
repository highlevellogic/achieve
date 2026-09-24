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
        case "invalid": return {};
        case "owned":
            session.allowAsync=true;
            session.response.statusCode=202;
            session.response.end("owned");
            return "ignored";
    }
};
