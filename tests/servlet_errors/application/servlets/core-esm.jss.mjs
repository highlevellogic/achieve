import fs from "node:fs";
import path from "node:path";

export function servlet(session) {
    return fs.readFileSync(path.join(session.dirPath,"missing-esm.txt"),"utf8");
}
