exports.servlet = function (context) {
    return JSON.stringify(context.request.get);
};
