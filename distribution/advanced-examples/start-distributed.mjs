import { spawn } from "node:child_process";
import achieve from "achieve";
import { applicationPath,mainPort,secondaryPort } from "./example-config.mjs";

if (process.env.ACHIEVE_DISTRIBUTED_ROLE === "worker") {
  achieve.setAppPath(applicationPath);
  achieve.setMode("development");
  achieve.listen(secondaryPort);
} else {
  const worker = spawn(process.execPath,[import.meta.filename],{
    cwd:import.meta.dirname,
    env:{...process.env,ACHIEVE_DISTRIBUTED_ROLE:"worker"},
    stdio:"inherit"
  });

  process.on("exit",function () {
    worker.kill();
  });

  achieve.setAppPath(applicationPath);
  achieve.setMode("development");
  achieve.listen(mainPort);
}
