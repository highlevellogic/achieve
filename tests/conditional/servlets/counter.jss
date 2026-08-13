let count = 0;

exports.servlet = function (context) {
    if (context.request.method === "POST") count++;
    return String(count);
}
