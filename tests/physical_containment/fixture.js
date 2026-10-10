const achieve=require("../../achieve");

achieve.setLogging(false);
achieve.setMode("development");
achieve.setAppPath(process.env.ACHIEVE_CONTAINMENT_APP);
achieve.setRouteMap({
    "/exact-outside-static":"/outside-tree/outside-static.txt",
    "/exact-outside-servlet":"/outside-tree/outside-servlet.jss",
    "/exact-outside-esm":"/outside-tree/outside-servlet.jss.mjs",
    "/exact-inside-static":"/inside-tree/inside-static.txt",
    "/exact-inside-servlet":"/inside-tree/inside-servlet.jss",
    "/exact-inside-esm":"/inside-tree/inside-servlet.jss.mjs"
});
achieve.registerMethod("DELETE","outside-tree/outside-servlet.jss");
achieve.registerMethod("PATCH","inside-tree/inside-servlet.jss");
achieve.setPathMap({
    "/outside-mapped/":"/outside-tree/",
    "/inside-mapped/":"/inside-tree/"
});

const server=achieve.listen(Number(process.env.ACHIEVE_CONTAINMENT_PORT));
server.on("listening",function () {
    if (process.send) process.send({event:"ready"});
});
process.on("message",function (message) {
    if (message.command === "stop") server.close(function () { process.exit(); });
});
