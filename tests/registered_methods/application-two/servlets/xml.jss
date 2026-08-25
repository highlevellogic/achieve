exports.servlet=function (context) {
  context.allowAsync=true;
  let xml="";
  context.request.setEncoding("utf8");
  context.request.on("data",chunk => { xml += chunk; });
  context.request.on("end",function () {
    const elements=(xml.match(/<item(?:\s|>)/g) || []).length;
    context.response.end(JSON.stringify({handler:"xml",elements:elements,body:xml}));
  });
};