import achieve from "achieve";
import "./soap-service.mjs";
import { applicationPath,mainPort } from "./example-config.mjs";

achieve.setAppPath(applicationPath);
achieve.setMode("development");
achieve.listen(mainPort);
