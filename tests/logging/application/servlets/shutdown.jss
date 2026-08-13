exports.servlet = function (context) {
    context.allowAsync = true;
    context.response.statusCode = 200;
    context.response.setHeader("Content-Type", "text/plain;charset=utf-8");
    context.response.write("started\n");

    function complete(message) {
        if (message !== "complete-in-flight") return;
        process.removeListener("message",complete);
        context.response.end("completed\n");
    }

    process.on("message",complete);
};
