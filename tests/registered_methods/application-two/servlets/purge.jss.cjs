exports.servlet=function (context) {
  return JSON.stringify({handler:"purge-cjs",method:context.request.method,url:context.request.url});
};