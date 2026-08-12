// JSS_SOURCE_MUST_NEVER_BE_SERVED
exports.servlet = function (context) {
  return "hello method=" + context.request.method + " x=" + (context.request.get.x || "");
};
