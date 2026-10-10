import achieve from "achieve";

console.log(JSON.stringify({
    resolved: import.meta.resolve("achieve"),
    listen: typeof achieve.listen,
    setAppPath: typeof achieve.setAppPath,
    registerMethod: typeof achieve.registerMethod
}));