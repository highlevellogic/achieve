const achieve = require("./achieve");
const path = require("node:path");

achieve.setAppPath(path.join(__dirname, "docs"));
achieve.listen(8989);
