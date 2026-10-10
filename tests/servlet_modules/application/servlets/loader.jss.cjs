exports.servlet = async function (session) {
    const explicit = session.load("./loaded.jss.cjs");
    const shorthand = session.load("./loaded.jss");
    const legacy = session.load("./legacy");
    const documented = session.load("./documented.js");
    const esm = await session.load("./loaded.jss.mjs");
    return [
        explicit.value,
        shorthand.value,
        legacy.value,
        documented.value,
        esm.value,
        typeof session.loadCJS,
        typeof session.loadESM
    ].join("|");
};
