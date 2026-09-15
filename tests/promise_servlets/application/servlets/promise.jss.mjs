export async function servlet(session) {
    switch (session.params.kind) {
        case "string": return "hello";
        case "buffer": return Buffer.from("buffer hello");
        case "undefined": return undefined;
        case "null": return null;
        case "reject-immediate": throw new Error("ESM_ASYNC_MARKER");
        case "reject-after-await":
            await Promise.resolve();
            throw new Error("ESM_ASYNC_AFTER_AWAIT_MARKER");
        case "allow-async":
            session.allowAsync=true;
            await Promise.resolve();
            session.response.statusCode=201;
            session.response.end("application owned");
            return "ignored";
    }
}
