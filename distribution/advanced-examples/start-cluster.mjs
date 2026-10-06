import cluster from "node:cluster";
import os from "node:os";
import achieve from "achieve";
import { applicationPath,mainPort,secondaryPort } from "./example-config.mjs";

const workers = os.availableParallelism();
cluster.schedulingPolicy = cluster.SCHED_RR;

if (cluster.isPrimary) {
  achieve.setAppPath(applicationPath);
  achieve.setMode("development");
  achieve.listen(mainPort);

  console.log(`Starting ${workers} clustered Achieve workers`);
  for (let i = 0; i < workers; i++) cluster.fork();

  cluster.on("exit",function (worker) {
    console.log(`Worker ${worker.process.pid} exited`);
    cluster.fork();
  });
} else {
  achieve.setAppPath(applicationPath);
  achieve.setMode("development");
  achieve.allowOrigins(
    `http://localhost:${mainPort}`,
    "/advanced/cluster/servlets",
    "primes.jss"
  );
  achieve.listen(secondaryPort);
  console.log(`Worker ${process.pid} listening on port ${secondaryPort}`);
}
