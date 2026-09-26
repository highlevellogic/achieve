const achieve = require("../../../achieve");

try {
    const server=achieve.listen(24949);
    if (server) server.close();
    process.exitCode=1;
} catch (error) {
    console.log(error.message);
}
