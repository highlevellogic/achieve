exports.servlet=function (session) {
    switch (session.params.kind) {
        case "string": return "sync hello";
        case "buffer": return Buffer.from("sync buffer");
        case "undefined": return undefined;
        case "null": return null;
        case "throw": throw new Error("SYNC_MARKER");
    }
};
