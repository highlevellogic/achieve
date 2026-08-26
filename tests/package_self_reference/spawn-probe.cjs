const childProcess=require("node:child_process");

const result=childProcess.spawnSync(process.execPath,[process.argv[2]],{
    cwd:process.argv[3],
    encoding:"utf8"
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode=result.status;