const childProcess=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const repositoryPath=path.resolve(__dirname,"..");
const structuredSummarySuites=new Set(["tests/physical_containment/verify.js"]);

function normalizedRelative(filePath) {
    return path.relative(repositoryPath,filePath).split(path.sep).join("/");
}

function discoverSuites() {
    return fs.readdirSync(__dirname,{withFileTypes:true})
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(__dirname,entry.name,"verify.js"))
        .filter(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
        .sort((left,right) => normalizedRelative(left).localeCompare(normalizedRelative(right),"en"));
}

function parseArguments(arguments_) {
    let reportPath;
    for (let index=0;index<arguments_.length;index++) {
        if (arguments_[index] !== "--report" || reportPath !== undefined || index+1 >= arguments_.length) {
            throw new Error("Usage: node tests/run-verifiers.js [--report <file>]");
        }
        reportPath=path.resolve(repositoryPath,arguments_[++index]);
    }
    return {reportPath};
}

function validSkip(skip) {
    return skip && typeof skip === "object" &&
        typeof skip.name === "string" && skip.name.length > 0 &&
        typeof skip.code === "string" && skip.code.length > 0 &&
        typeof skip.reason === "string" && skip.reason.length > 0;
}

function runSuite(filePath) {
    const name=normalizedRelative(filePath);
    const started=process.hrtime.bigint();
    console.log("\n=== "+name+" ===");
    return new Promise(resolve => {
        let launchError;
        let summaries=[];
        let settled=false;
        let child;
        try {
            child=childProcess.fork(filePath,[],{
                cwd:repositoryPath,
                silent:true
            });
        } catch (error) {
            return resolve(finish(undefined,undefined,error));
        }
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
        child.on("message",message => {
            if (message && message.type === "achieve-verifier-summary") summaries.push(message);
        });
        child.on("error",error => {
            launchError=error;
        });
        child.on("close",(exitCode,signal) => resolve(finish(exitCode,signal,launchError)));

        function finish(exitCode,signal,error) {
            if (settled) return;
            settled=true;
            const durationMs=Number(process.hrtime.bigint()-started)/1e6;
            let reportingError;
            let declaredSkips=null;
            if (structuredSummarySuites.has(name)) {
                if (summaries.length !== 1 || !Array.isArray(summaries[0].skips) ||
                    !summaries[0].skips.every(validSkip)) {
                    reportingError="missing or malformed structured verifier summary";
                } else {
                    declaredSkips=summaries[0].skips;
                }
            } else if (summaries.length > 0) {
                reportingError="unexpected structured verifier summary";
            }
            const passed=!error && exitCode === 0 && signal === null && !reportingError;
            return {name,passed,exitCode,signal,durationMs,error,reportingError,declaredSkips};
        }
    });
}

function gitValue(args) {
    try {
        return {
            available:true,
            value:childProcess.execFileSync("git",args,{
            cwd:repositoryPath,
            encoding:"utf8",
            windowsHide:true,
            stdio:["ignore","pipe","ignore"]
            }).trim()
        };
    } catch (_) {
        return {available:false,value:null};
    }
}

function gitMetadata() {
    const commitResult=gitValue(["rev-parse","HEAD"]);
    const statusResult=gitValue(["status","--porcelain"]);
    return {
        commit:commitResult.available && commitResult.value ? commitResult.value : "unavailable",
        workingTree:statusResult.available ? (statusResult.value === "" ? "clean" : "dirty") : "unavailable"
    };
}

function markdownCell(value) {
    return String(value).replace(/\|/g,"\\|").replace(/\r?\n/g," ");
}

function formatDuration(milliseconds) {
    return (milliseconds/1000).toFixed(3)+" s";
}

function buildReport(metadata,results) {
    const passed=results.filter(result => result.passed).length;
    const failed=results.length-passed;
    const declaredSkips=results.flatMap(result => result.declaredSkips || []);
    const lines=[
        "# Achieve "+metadata.version+" Release Validation",
        "",
        "- Git commit: `"+metadata.commit+"`",
        "- Working tree: "+metadata.workingTree,
        "- Node.js: `"+process.version+"`",
        "- Operating system: `"+os.platform()+" "+os.release()+"`",
        "- Architecture: `"+os.arch()+"`",
        "- Started: `"+metadata.started.toISOString()+"`",
        "- Duration: "+formatDuration(metadata.durationMs),
        "- Suites: "+results.length+" executed, "+passed+" passed, "+failed+" failed",
        "- Declared environmental skips: "+declaredSkips.length,
        "- Overall result: **"+(failed === 0 ? "PASS" : "FAIL")+"**",
        "",
        "## Suite results",
        "",
        "| Suite | Result | Exit code | Signal | Duration | Declared skips |",
        "|---|---:|---:|---:|---:|---:|"
    ];
    for (const result of results) {
        lines.push("| `"+markdownCell(result.name)+"` | "+(result.passed ? "PASS" : "FAIL")+
            " | "+(result.exitCode === null || result.exitCode === undefined ? "—" : result.exitCode)+
            " | "+(result.signal || "—")+" | "+formatDuration(result.durationMs)+
            " | "+(result.declaredSkips === null ? "not declared" : result.declaredSkips.length)+" |");
    }
    lines.push("","## Environmental skips","");
    if (declaredSkips.length === 0) {
        lines.push("None declared.");
    } else {
        for (const skip of declaredSkips) {
            lines.push("- **"+markdownCell(skip.name)+"** (`"+markdownCell(skip.code)+"`): "+markdownCell(skip.reason));
        }
    }
    const runnerFailures=results.filter(result => result.error || result.reportingError);
    if (runnerFailures.length) {
        lines.push("","## Runner/reporting failures","");
        for (const result of runnerFailures) {
            lines.push("- `"+result.name+"`: "+markdownCell(result.error ? result.error.message : result.reportingError));
        }
    }
    return lines.join("\n")+"\n";
}

function printSummary(results,totalDurationMs) {
    const passed=results.filter(result => result.passed).length;
    const failed=results.length-passed;
    const declaredSkips=results.reduce((total,result) => total+(result.declaredSkips ? result.declaredSkips.length : 0),0);
    console.log("\n=== Aggregate verifier summary ===");
    for (const result of results) {
        let detail="exit="+(result.exitCode === null || result.exitCode === undefined ? "none" : result.exitCode)+
            " duration="+formatDuration(result.durationMs);
        if (result.signal) detail+=" signal="+result.signal;
        if (result.declaredSkips !== null) detail+=" skips="+result.declaredSkips.length;
        if (result.error) detail+=" error="+result.error.message;
        if (result.reportingError) detail+=" reporting-error="+result.reportingError;
        console.log((result.passed ? "PASS" : "FAIL")+" "+result.name+" "+detail);
    }
    console.log("Discovered: "+results.length+"; passed: "+passed+"; failed: "+failed+
        "; declared case skips: "+declaredSkips+"; duration: "+formatDuration(totalDurationMs));
    return failed;
}

(async function () {
    const options=parseArguments(process.argv.slice(2));
    const packageMetadata=JSON.parse(fs.readFileSync(path.join(repositoryPath,"package.json"),"utf8"));
    const suites=discoverSuites();
    const started=new Date();
    const startTime=process.hrtime.bigint();
    console.log("Discovered "+suites.length+" verifier suite(s). Running sequentially.");
    const results=[];
    for (const suite of suites) results.push(await runSuite(suite));
    const durationMs=Number(process.hrtime.bigint()-startTime)/1e6;
    let failed=printSummary(results,durationMs);
    if (options.reportPath) {
        const git=gitMetadata();
        const metadata={
            version:packageMetadata.version,
            commit:git.commit,
            workingTree:git.workingTree,
            started,
            durationMs
        };
        if (git.commit === "unavailable" || git.workingTree !== "clean") {
            failed++;
            console.error("Cannot write historical Markdown report: commit="+git.commit+
                ", working-tree="+git.workingTree+". A known commit and clean working tree are required.");
        } else {
            try {
                fs.mkdirSync(path.dirname(options.reportPath),{recursive:true});
                fs.writeFileSync(options.reportPath,buildReport(metadata,results),"utf8");
                console.log("Markdown report written to "+options.reportPath);
            } catch (error) {
                failed++;
                console.error("Failed to write Markdown report: "+error.message);
            }
        }
    }
    process.exitCode=failed ? 1 : 0;
})().catch(error => {
    console.error(error.stack || error);
    process.exitCode=1;
});
