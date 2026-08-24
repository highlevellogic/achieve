const sourceText = "COMMONJS_SHORTHAND_SOURCE_MUST_NOT_BE_SERVED";

exports.servlet = function (session) {
    return "COMMONJS shorthand " + (session.params.name || "");
};
