exports.servlet=async function (session) {
    switch (session.params.kind) {
        case "string": return "hello";
        case "buffer": return Buffer.from("buffer hello");
        case "undefined": return undefined;
        case "null": return null;
        case "reject-immediate": throw new Error("CJS_ASYNC_MARKER");
        case "reject-after-await":
            await Promise.resolve();
            throw new Error("CJS_ASYNC_AFTER_AWAIT_MARKER");
        case "head-delay":
            await new Promise(resolve => setTimeout(resolve,60));
            return "head body";
        case "head-reject":
            await new Promise(resolve => setTimeout(resolve,60));
            throw new Error("CJS_HEAD_REJECTION");
        case "headers-reject":
            session.response.write("prefix");
            await Promise.resolve();
            throw new Error("CJS_AFTER_HEADERS_MARKER");
        case "pending":
            await new Promise(resolve => setTimeout(resolve,75));
            return "late response";
        case "allow-async":
            session.allowAsync=true;
            await Promise.resolve();
            session.response.statusCode=201;
            session.response.end("application owned");
            return "ignored";
        case "allow-rejection":
            session.allowAsync=true;
            try {
                await Promise.reject(new Error("APPLICATION_OWNED_MARKER"));
            } catch (err) {
                session.response.statusCode=202;
                session.response.end("application caught rejection");
            }
            return "ignored";
        case "ended-rejection":
            session.response.end("already ended");
            await Promise.resolve();
            throw new Error("REJECTION_AFTER_END_MARKER");
    }
};
