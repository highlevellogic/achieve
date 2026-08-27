export function servlet(context) {
    return JSON.stringify({format:"jss.mjs",url:context.request.url});
}