exports.servlet = function (context) {
    return "hello " + (context.params.x || "");
};
