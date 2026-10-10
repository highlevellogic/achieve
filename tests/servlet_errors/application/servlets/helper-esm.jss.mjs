import {readMissing} from "../helpers/core-helper.jss.mjs";

export function servlet(session) {
    return readMissing(session.dirPath);
}
