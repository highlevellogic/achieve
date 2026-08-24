exports.servlet = function (session) {
    const explicit = session.loadCJS("./loaded.jss.cjs");
    const shorthand = session.loadCJS("./loaded.jss");
    const legacy = session.load("./legacy");

    session.allowAsync = true;
    (async function () {
        try {
            const esm = await session.loadESM("./loaded.jss.mjs");
            session.response.end([
                explicit.value,
                shorthand.value,
                legacy.value,
                esm.value
            ].join("|"));
        } catch (err) {
            session.response.statusCode = 500;
            session.response.end(String(err));
        }
    }());
};
