import fs from "node:fs";
import path from "node:path";

export function readMissing(servletDirectory) {
    return fs.readFileSync(path.join(servletDirectory,"missing-helper-esm.txt"),"utf8");
}
