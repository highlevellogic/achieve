exports.servlet = function (context) {
    if (context.params.abort === "true") {
        context.allowAsync = true;
        return;
    }
    if (context.params.throw === "true") {
        throw new Error("Logging fixture servlet error.");
    }
    if (context.params.status) {
        context.response.statusCode = Number(context.params.status);
    } else {
        context.response.statusCode = 200;
    }
    context.response.end(context.request.method);
};
