const sourceText = "EXPLICIT_COMMONJS_SOURCE_MUST_NOT_BE_SERVED";

exports.servlet = function (session) {
    return "COMMONJS explicit " + (session.params.name || "");
};
