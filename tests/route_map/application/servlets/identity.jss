exports.servlet=function (context) {
    return JSON.stringify({
        format:"jss",
        method:context.request.method,
        url:context.request.url,
        params:context.params
    });
};