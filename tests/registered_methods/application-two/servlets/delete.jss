exports.servlet=function (context) {
  return JSON.stringify({handler:"delete",method:context.request.method,url:context.request.url,
    header:context.request.headers["x-handler-test"],params:Object.keys(context.params),
    alias:context.params === context.parms});
};