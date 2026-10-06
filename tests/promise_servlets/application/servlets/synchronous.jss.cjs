exports.servlet=function (session) {
    switch (session.params.kind) {
        case "string": return "sync hello";
        case "buffer": return Buffer.from("sync buffer");
        case "undefined": return undefined;
        case "null": return null;
        case "no-return": break;
        case "return": return;
        case "missing-property":
            return session.load("missing-property.js").hell;
        case "throw": throw new Error("SYNC_MARKER");
        case "allow-throw":
            session.allowAsync=true;
            throw new Error("ALLOW_ASYNC_SYNC_THROW_MARKER");
        case "auto-throw":
            session.autoEnd=false;
            throw new Error("AUTO_END_SYNC_THROW_MARKER");
        case "allow-owned":
            session.autoEnd=false;
            session.response.statusCode=202;
            session.response.end("synchronous application owned");
            return "ignored";
        case "allow-headers-throw":
            session.autoEnd=false;
            session.response.write("synchronous prefix");
            throw new Error("ALLOW_ASYNC_HEADERS_THROW_MARKER");
        case "allow-ended-throw":
            session.autoEnd=false;
            session.response.statusCode=203;
            session.response.end("synchronous already ended");
            throw new Error("ALLOW_ASYNC_ENDED_THROW_MARKER");
        case "allow-timer":
            session.autoEnd=false;
            setTimeout(function () {
                session.response.statusCode=203;
                session.response.end("detached timer owned");
            },25);
            return "ignored";
    }
};
