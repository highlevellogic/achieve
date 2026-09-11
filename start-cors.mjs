import achieve from "achieve";
import { examplesPath,mainPort,secondaryPort } from "./example-config.mjs";

achieve.setAppPath(examplesPath);

const browserOrigin = `http://localhost:${secondaryPort}`;
achieve.allowOrigins(
  browserOrigin,
  "/intermediate/cors/servlets",
  "hello.jss"
);
achieve.allowOrigins(browserOrigin,"/intermediate/cors/public/frameworks");
achieve.allowOrigins(browserOrigin,"/intermediate/cors/public/frameworks2");

achieve.listen(mainPort);
achieve.listen(secondaryPort);
