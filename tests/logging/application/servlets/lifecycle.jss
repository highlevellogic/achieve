exports.servlet = function (context) {
    context.response.statusCode = 200;
    context.response.end(context.request.method);
};
