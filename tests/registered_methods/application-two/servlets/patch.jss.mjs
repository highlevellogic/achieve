export function servlet(context) {
  return JSON.stringify({handler:"patch-esm",method:context.request.method,url:context.request.url});
}