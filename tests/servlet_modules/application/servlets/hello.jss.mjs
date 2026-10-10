import { packageValue } from "test-esm-package";
import { relativeValue } from "./relative.jss.mjs";

const sourceText = "ESM_SERVLET_SOURCE_MUST_NOT_BE_SERVED";
globalThis.__achieveServletModuleLoads = (globalThis.__achieveServletModuleLoads || 0) + 1;

export function servlet(session) {
    return JSON.stringify({
        name: session.params.name || "",
        packageValue,
        relativeValue,
        loads: globalThis.__achieveServletModuleLoads
    });
}
