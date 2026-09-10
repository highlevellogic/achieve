export function servlet(session) {
    return JSON.stringify({format:"jss.mjs",method:session.request.method,url:session.request.url,params:session.params});
}
