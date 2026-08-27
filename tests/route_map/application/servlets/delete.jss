exports.servlet=function (context) {
    return JSON.stringify({handler:"DELETE",method:context.request.method,url:context.request.url});
};