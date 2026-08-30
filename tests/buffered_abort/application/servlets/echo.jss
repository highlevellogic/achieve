exports.servlet=function (context) {
    if (process.send) {
        process.send({
            event:"invoked",
            method:context.request.method,
            params:context.params
        });
    }
    context.response.setHeader("Content-Type","application/json");
    return JSON.stringify(context.params);
};
