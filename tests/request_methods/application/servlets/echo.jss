exports.servlet = function (context) {
    return JSON.stringify({
        method: context.request.method,
        params: context.params,
        requestHasGet: Object.prototype.hasOwnProperty.call(context.request,"get"),
        requestHasPost: Object.prototype.hasOwnProperty.call(context.request,"post")
    });
};
