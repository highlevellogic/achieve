exports.servlet = function (session) {
    return JSON.stringify({format:"jss",method:session.request.method,url:session.request.url,params:session.params});
};
