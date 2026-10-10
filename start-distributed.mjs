import { spawn } from "node:child_process";
import achieve from "achieve";
import { examplesPath,mainPort,secondaryPort } from "./example-config.mjs";

if (process.env.ACHIEVE_DISTRIBUTED_ROLE === "worker") {
  achieve.setAppPath(examplesPath);
  achieve.setMode("production");
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

  achieve.setAppPath(examplesPath);
  achieve.setMode("production");
  achieve.listen(mainPort);
}
