import achieve from "achieve";
import { applicationPath,mainPort } from "./example-config.mjs";

achieve.setAppPath(applicationPath);
achieve.setMode("development");
achieve.listen(mainPort);
