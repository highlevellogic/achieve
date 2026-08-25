exports.servlet=function (context) {
  context.allowAsync=true;
  const chunks=[];
  context.request.on("data",chunk => chunks.push(chunk));
  context.request.on("end",function () {
    context.response.end(JSON.stringify({handler:"body",method:context.request.method,
      url:context.request.url,contentType:context.request.headers["content-type"],
      params:Object.keys(context.params),body:Buffer.concat(chunks).toString("utf8"),
      bodyBase64:Buffer.concat(chunks).toString("base64")}));
  });
};