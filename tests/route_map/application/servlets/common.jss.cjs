exports.servlet=function (context) {
    return JSON.stringify({format:"jss.cjs",url:context.request.url});
};