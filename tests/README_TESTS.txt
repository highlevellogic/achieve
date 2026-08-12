# ACHIEVE TESTS

The tests directory contains simple applications used to verify Achieve server
behavior during development.

These are primarily manual, browser-oriented regression tests rather than a
fully automated test suite. Start the repository server with `node start.js`;
it serves this directory at http://localhost:8989/.

The tests are intentionally kept small and readable. Each test focuses on a
particular feature or behavior so that the request, expected result, and test
code can be easily examined.

Most browser-based tests contain the complete client-side test code in the
test application's index.htm file.

# RUNNING THE TESTS

1. Install Node.js if it is not already installed.

2. Start Achieve from the repository directory.

   Windows:

   runw.bat

   Linux:

   sh runl.sh

3. By default, the development server runs on port 8989.

4. Open the desired test application in a browser.

   Example:

   http://localhost:8989/confirm/

   and  http://localhost:8989

   Tests may also be run using another hostname or IP address configured for
   the server.

# CONFIRMATION TEST

## confirm

Purpose:

Provides a basic confirmation that the downloaded development version of
Achieve is running and can execute an application servlet.

The browser loads an HTML page and makes a request to a servlet. The servlet
returns a confirmation response which is displayed on the page.

Run:

http://localhost:8989/confirm/

Expected result:

The page should display the confirmation message returned by the servlet.

This test is also intended as a simple first test for someone who has
downloaded the Achieve development repository.

# DEVELOPMENT TESTS

## tests

The /tests/ area contains focused development and regression tests.

Individual tests are kept in separate subdirectories. This makes each test
independently readable and makes it easier to determine which server feature
has failed.

The principal areas are:

* confirm: static delivery, compressed artifacts, and basic servlet execution;
* get, head, and post: method-specific request and servlet behavior;
* cache: ETag and cache validation;
* redirect: directory redirects;
* media: full and single-byte-range media responses;
* helper: helper-module loading, reload, and error propagation;
* jss: .jss routing, defaults, precedence, live reload, legacy compatibility,
  and source protection.

# SERVLET FIXTURES

.jss is the preferred protected servlet suffix. Extensionless requests remain
compatible with legacy .js servlets; explicit .js requests remain static.

Several files under jss/source_protection and jss/lifecycle are deliberately
invalid, throw errors, or omit the servlet export. They verify safe diagnostics,
failed-load recovery, cache behavior, and the rule that .jss source never falls
back to static delivery. Do not repair them merely because a standalone syntax
check fails.

# MEDIA AND COMPRESSION FIXTURES

mov_bbb.mp4 is the short Big Buck Bunny MP4 used by W3Schools HTML video
examples. This copy was downloaded from W3Schools. Original film credit:
Big Buck Bunny / Blender Foundation / Peach Open Movie. Achieve uses it only
as a small media/Range regression fixture.

The prior large media fixture is intentionally local-only and ignored at:

tests/media/media/bbb_sunflower_1080p_30fps_normal.mp4

Place a local media file there only when the large-file/open-ended Range
regression is needed. Without it, that filename exercises missing-resource
behavior. The confirmed regression used a 276,134,947-byte file with
Range: bytes=276103168-.

The .gz files under confirm and helper are intentional compression fixtures.
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

# HTTP METHOD TESTS

## GET

Purpose:

Verify normal GET request handling, including resource resolution and servlet
GET processing.

Expected behavior:

GET should resolve the requested resource and return its normal response body,
status, and headers.

## POST

Purpose:

Verify POST request handling and servlet POST data processing.

Expected behavior:

POST data should be received and parsed correctly and the servlet should
return its normal response.

## HEAD

Purpose:

Verify Achieve's implementation of the HTTP HEAD method.

HEAD follows the same resource-resolution path as GET but does not return a
response body.

HEAD testing should cover the important resource types and outcomes,
including:

* static files;
* servlets;
* redirects;
* missing resources and errors;
* media resources.

Expected behavior:

A HEAD request should return the appropriate status and headers without a
response body.

For static resources, Achieve should not open and stream the file body.

For media resources, HEAD should describe the complete resource and should
not stream the media file. A Range request accompanying HEAD should not cause
partial-content streaming.

For servlets, the servlet is executed with:

request.method === "HEAD"

Achieve suppresses its normal framework-generated servlet response body.

If a servlet takes control of asynchronous response handling, the application
remains responsible for its processing. Servlet developers can check
request.method when they wish to avoid unnecessary body-generation work for
HEAD.

# ADDING TESTS

Tests should normally be focused on one Achieve feature or closely related
group of behaviors.

Prefer:

tests/head/
tests/post/
tests/cache/
tests/media/

rather than placing unrelated tests into one large application.

A test directory may contain several checks when they all exercise the same
feature. For example, the HEAD test may check static files, servlets,
redirects, errors, and media because they are all testing HEAD semantics.

Keep tests simple enough that a developer can open index.htm and quickly
understand:

* what request is being made;
* what result is expected;
* how PASS or FAIL is determined.

Avoid adding unnecessary test-framework complexity. These tests are intended
both to detect regressions and to make Achieve behavior easy to inspect and
understand.

# MASTER TEST PAGE

The tests/index.html page may be used as an index to the individual focused
tests.

It can initially provide links to the tests.

As the test collection grows, it may also become a convenient way to run
multiple tests and summarize their PASS/FAIL results.

The individual test applications should remain independently runnable and
understandable even if a master test runner is added later.
