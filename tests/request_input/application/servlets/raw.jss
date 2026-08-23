exports.servlet = function (context) {
    context.allowAsync=true;
    const chunks=[];

    context.request.on("data",function (chunk) {
        chunks.push(chunk);
    });
    context.request.on("error",function (err) {
        if (!context.response.writableEnded) {
            context.response.statusCode=400;
            context.response.end("request error: "+err.message);
        }
    });
    context.request.on("end",function () {
        if (context.response.writableEnded) return;
        context.response.statusCode=200;
        context.response.end(JSON.stringify({
            params:context.params,
            chunks:chunks.length,
            body:Buffer.concat(chunks).toString("utf8")
        }));
    });
};
