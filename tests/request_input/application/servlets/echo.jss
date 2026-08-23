exports.servlet = function (context) {
    if (context.params.x !== undefined) {
        context.response.setHeader("X-Param-X",String(context.params.x));
    }
    return JSON.stringify(context.params);
};
