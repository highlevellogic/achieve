exports.servlet=async function (context) {
  const cjs=context.load("./loaded.jss.cjs");
  const esm=await context.load("./loaded.jss.mjs");
  return cjs.value+"|"+esm.value+"|"+
    String(context.loadCJS)+"|"+String(context.loadESM);
};
