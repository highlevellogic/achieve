exports.servlet = function () {
    const err = new Error("Synthetic internal fallback failure");
    err.stack = "Synthetic internal fallback failure\n" +
        "    at moduleResolve (node:internal/modules/esm/resolve:275:11)";
    throw err;
};
