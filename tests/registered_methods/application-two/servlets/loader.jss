exports.servlet=function (context) {
  const cjs=context.loadCJS("./loaded.jss.cjs");
  context.allowAsync=true;
  context.loadESM("./loaded.jss.mjs").then(function (esm) {
    context.response.end(cjs.value+"|"+esm.value);
  }).catch(function (err) {
    context.response.statusCode=500;
    context.response.end(err.message);
  });
};