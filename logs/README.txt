ACHIEVE LOGS

This is the default operational log root for this Achieve server installation.

When enabled, Achieve creates daily server logs under:

    server/
        YYYY-MM-DD.log

The access/ category is reserved for per-request access logging. Category
directories are created only when needed.

Use setLogPath(...) before listen() to relocate the complete log root. Achieve
owns the fixed server/ and access/ structure beneath that root.

Generated log files are operational data and should not be committed to the
source repository.
