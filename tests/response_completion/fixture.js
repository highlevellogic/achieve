const fs=require("node:fs");
const path=require("node:path");
const achieve=require(process.env.ACHIEVE_COMPLETION_IMPLEMENTATION || "../../achieve.js");

const protocol=process.env.ACHIEVE_COMPLETION_PROTOCOL;
const port=Number(process.env.ACHIEVE_COMPLETION_PORT);
const credentials={
    key:fs.readFileSync(path.join(__dirname,"..","logging","test-key.pem")),
    cert:fs.readFileSync(path.join(__dirname,"..","logging","test-cert.pem"))
};

achieve.setMode("production");
achieve.setLogging(false);
achieve.setCaching(false);
achieve.setCompress(false);
achieve.setAppPath(path.join(__dirname,"application"));

const server=protocol === "http" ? achieve.listen(port)
    : protocol === "https" ? achieve.slisten({...credentials,httpsPort:port})
    : protocol === "h2c" ? achieve.listen2(port)
    : achieve.listen2({...credentials,http2Port:port});

server.once("listening",() => process.send({type:"ready"}));
process.on("message",message => {
    if (message.type === "stop") server.close(() => process.exit(0));
});
