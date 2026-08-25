exports.servlet=function (context) {
  return JSON.stringify({handler:"trace",method:context.request.method,url:context.request.url});
};