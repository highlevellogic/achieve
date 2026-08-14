# ACHIEVE TESTS

The tests directory contains engineering verification, protocol assertions,
edge cases, intentionally broken servlets, and support fixtures used during
Achieve development.

Executable documentation for developers and students is under examples/.
Start the ordinary examples with `node start.js`, then open:

    http://localhost:8989/

LOGGING AND CONTROLLED SHUTDOWN

Run the focused server/access logging regressions with:

    node tests/logging/verify.js

Run the controlled-shutdown regressions with:

    node tests/logging/verify-shutdown.js

The shutdown verifier covers HTTP, HTTPS, HTTP/2, multiple listeners,
in-flight access records, repeated shutdown callbacks, SIGINT/SIGTERM launcher
behavior, log draining, and independent logging-sink failures.

# RUNNING THE TESTS

1. Install Node.js if it is not already installed.

2. Run the focused verifier for the behavior under review.

3. Treat deliberately invalid fixtures as test inputs, not files to repair.

# DEVELOPMENT TESTS

## tests

The /tests/ area contains focused development and regression tests.

Individual tests are kept in separate subdirectories. This makes each test
independently readable and makes it easier to determine which server feature
has failed.

For retained browser-oriented engineering fixtures, run:

node tests/server.js

and open the desired fixture beneath http://localhost:8988/. Focused automated
verifiers start and stop their own configured servers instead.

The principal areas are:

* cache: ETag and cache validation;
* conditional: exact conditional-request and representation validation;
* redirect: directory redirects;
* media: engineering-only and local large-media regression material;
* helper: helper-module loading, reload, and error propagation;
* jss: .jss routing, defaults, precedence, live reload, legacy compatibility,
  and source protection;
* request_path: one-application routing, containment, and raw-backslash
  rejection;
* root_mode: default and configured application-directory verification.

Run the focused request-path verifier with:

    node tests/request_path/verify.js

# APPLICATION-DIRECTORY FIXTURES

Achieve uses the server project's root directory as its default application
directory. Use setAppPath() to select a different application directory. URL
directories never select another application or containment boundary.

Start the focused browser demonstration with:

node examples/root_mode/server.js

Then open:

http://localhost:8990/

Run the focused automated verification with:

node tests/root_mode/verify.js

The browser demonstration shows ordinary directories inside one configured
application. The verifier proves the default directory, setAppPath() override,
and the inert diagnostic behavior of obsolete setRootDir().

# CONDITIONAL-REQUEST TESTS

The conditional browser example provides a friendly introduction to ETags and
preconditions. The verifier under tests/ provides exact request-header and
status verification.

Start its focused browser server with:

node examples/conditional/server.js

Then open:

http://localhost:8991/

The page displays status, ETag, Content-Encoding, Vary, and PASS/FAIL results
for static If-None-Match and If-Match requests, their precedence, servlet
wildcards, and failed-POST side-effect prevention.

Run the complete native HTTP verification with:

node tests/conditional/verify.js

The verifier covers identity/gzip/deflate representation ETags, Vary,
same- and cross-representation validation, lists, whitespace, wildcards, weak
and strong comparisons, GET/HEAD/POST results, 304 metadata, servlet behavior
without automatic response ETags, media ETags and If-Range, caching-disabled
explicit preconditions, and temporary-copy source modification. It reuses the
small tracked media fixture and removes all temporary application data.

Achieve does not currently implement Last-Modified, If-Modified-Since,
If-Unmodified-Since, or successful date-form If-Range validation. Date-form
If-Range is tested only for the implemented behavior of ignoring Range and
returning the full current representation.

# HEAD REGRESSION EXPECTATIONS

The public example under examples/head/ introduces HEAD with a simple servlet
request. Engineering HEAD verification should cover the broader server-managed
resource paths:

* ordinary static resources and servlet responses return the corresponding
  GET status and relevant headers without a response body;
* directory redirects and error responses preserve their status and headers
  while suppressing server-generated explanatory bodies;
* media HEAD describes the complete resource without opening a media stream;
* a Range header on HEAD is ignored, so media metadata remains a full 200
  response rather than a partial 206 response;
* asynchronous servlets retain application ownership after enabling
  allowAsync, with Node responsible for suppressing HEAD body bytes.

# SERVLET FIXTURES

.jss is the preferred protected servlet suffix. Extensionless requests remain
compatible with legacy .js servlets; explicit .js requests remain static.

Several files under jss/source_protection and jss/lifecycle are deliberately
invalid, throw errors, or omit the servlet export. They verify safe diagnostics,
failed-load recovery, cache behavior, and the rule that .jss source never falls
back to static delivery. Do not repair them merely because a standalone syntax
check fails.

# MEDIA AND COMPRESSION FIXTURES

The tracked fixture is examples/media/media/mov_bbb.mp4. It is the short Big
Buck Bunny MP4 used by W3Schools HTML video examples. This copy was downloaded
from W3Schools. Original film credit:
Big Buck Bunny / Blender Foundation / Peach Open Movie. Achieve uses it only
as a small media/Range regression fixture.

The prior large media fixture is intentionally local-only and ignored at:

tests/media/media/bbb_sunflower_1080p_30fps_normal.mp4

Place a local media file there only when the large-file/open-ended Range
regression is needed. Without it, that filename exercises missing-resource
behavior. The confirmed regression used a 276,134,947-byte file with
Range: bytes=276103168-.

The .gz files under examples/confirm and tests/helper are intentional compression fixtures.
They expand exactly to their neighboring source files and are not globally
ignored.

Containment, malformed request-target, Host-field, CONNECT, and HTTP/2 checks
require a native HTTP client or small ad hoc harness rather than a browser
page. They are not yet collected into a complete automated suite.

The test pages are based on a common simple HTML structure. Test-specific
request and result handling is kept in the individual index.htm file whenever
practical.

## tests/template

Purpose:

Provides a starting point for creating new browser-based Achieve tests.

To create a new test:

1. Copy the template directory.

2. Give the copied directory a name describing the feature being tested.

3. Modify index.htm at the section marked:

   // START TEST HERE

4. Add any resources or servlets required by that test.

5. Add the new test and its expected result to this README_TESTS.txt file.

# ADDING TESTS

Tests should normally be focused on one Achieve feature or closely related
group of behaviors.

Prefer a clearly named focused directory rather than placing unrelated checks
into one large application.

A test directory may contain several checks when they all exercise the same
feature. For example, the HEAD test may check static files, servlets,
redirects, errors, and media because they are all testing HEAD semantics.

Keep verification simple enough that a developer can quickly understand:

* what request is being made;
* what result is expected;
* how PASS or FAIL is determined.

Avoid adding unnecessary test-framework complexity. Friendly teaching and
browser exploration belong under examples/; exact verification and failure
fixtures belong here.
