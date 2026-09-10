import achieve from "achieve";
import "./soap-service.mjs";
import { examplesPath,mainPort } from "./example-config.mjs";

achieve.setAppPath(examplesPath);
achieve.setMode("production");
achieve.listen(mainPort);
