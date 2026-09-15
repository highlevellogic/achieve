exports.servlet=async function (session) {
    let helper;
    switch (session.params.kind) {
        case "cjs-evaluation":
            return session.load("./error-evaluation.jss.cjs");
        case "cjs-call":
            helper=session.load("./error-call.jss");
            return helper.hello();
        case "esm-evaluation":
            return session.load("./error-evaluation.jss.mjs");
        case "esm-call":
            helper=await session.load("./error-call.jss.mjs");
            return helper.hello();
        case "unsupported":
            return session.load("./unsupported.txt");
    }
};
