const achieve = require("../../../achieve");

const listener=process.argv[2];
let server;

if (listener === "listen") {
    server=achieve.listen(24949);
} else if (listener === "slisten") {
    server=achieve.slisten({key:"unused",cert:"unused",httpsPort:24950});
} else if (listener === "listen2") {
    server=achieve.listen2(24951);
} else if (listener === "listen2-secure") {
    server=achieve.listen2({key:"unused",cert:"unused",http2Port:24952});
} else {
    throw new Error("Unknown listener fixture: " + listener);
}

if (server !== undefined) {
    server.close();
    process.exitCode=1;
}
