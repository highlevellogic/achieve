exports.servlet = function (session) {
    return JSON.stringify({handler:"DELETE",method:session.request.method,url:session.request.url});
};
