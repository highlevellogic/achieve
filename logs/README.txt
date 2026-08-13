ACHIEVE LOGS

This is the default operational log root for this Achieve server installation.

When enabled, Achieve creates daily server logs under:

    server/
        YYYY-MM-DD.log

When access logging is enabled, Achieve creates daily request logs under:

    access/
        YYYY-MM-DD.log

Each access record contains the remote address, method, request target, final
status, elapsed time, and completion state. Request targets include query
strings and may therefore contain application-sensitive information.

Category directories are created only when needed.

Use setLogPath(...) before listen() to relocate the complete log root. Achieve
owns the fixed server/ and access/ structure beneath that root.

Generated log files are operational data and should not be committed to the
source repository.

The repository launcher performs controlled shutdown for Ctrl-C and SIGTERM.
Achieve stops its listeners before ending and draining healthy server and access
log streams, so access records for completed in-flight requests are retained.
On the supported Node.js 22+ baseline, normal listener shutdown closes idle HTTP
connections. Active, stalled, or upgraded connections can still delay shutdown.
Existing HTTP/2 sessions may remain active and continue opening streams until
they close; Achieve 3.0 does not track or forcibly close HTTP/2 sessions.
