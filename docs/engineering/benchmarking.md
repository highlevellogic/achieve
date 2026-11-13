# Achieve benchmarking knowledge

This document preserves engineering lessons and reference measurements from
Achieve performance investigations. It is guidance for designing and
interpreting future experiments, not a performance guarantee or a substitute
for recording the complete environment and raw results of a new run.

The repository's ordinary cluster example is
[`start-cluster.mjs`](../../start-cluster.mjs). The November 2026 investigations
used separate experimental harnesses rather than production Achieve code. This
document preserves the durable methodological and historical knowledge from
those investigations without treating temporary harnesses or raw logs as
repository interfaces.

## Benchmarking principles

### Treat the load generator as part of the measured system

A single Node.js load-generator event loop can saturate before a clustered
server. When that happens, additional server workers or connections do not
increase throughput, and the result is a client ceiling rather than a server
capacity measurement. Record client CPU and event-loop utilization as well as
server CPU. For a clustered server, measure the primary process and every
worker rather than relying only on total machine CPU.

Use multiple independent client processes when one process is saturated. On a
same-host test, remember that clients and server workers compete for the same
processors. A same-host result can establish combined capacity, but not an
isolated server maximum.

### Choose concurrency experimentally

Persistent connections reduce connection setup noise, but more connections
are not automatically better. Start with a configuration known to keep the
client and server busy, then test a small number of nearby values. A throughput
plateau accompanied by rising p95 and p99 latency usually indicates queueing,
not additional useful capacity.

Remote tests often require more concurrency than loopback tests because each
connection waits for network round trips. Low remote throughput at modest
concurrency is not by itself evidence of a network bandwidth limit. Increase
concurrency in controlled steps, while watching throughput, latency, CPU,
failures, retransmissions, and connection state.

### Interpret throughput and latency together

Always report requests per second with at least p50, p95, and p99 latency;
retain maximum latency when the harness provides it. A configuration that
adds little throughput but greatly increases tail latency is not a practical
improvement. Use a warmup interval, a common measurement interval for
simultaneous clients, and consistent rules for requests crossing measurement
boundaries.

### Verify the workload and server mode

Before timing a run, verify the listening endpoint, process count, production
or development mode, cluster scheduling policy, logging and compression
settings, and the response actually returned. A process named like a cluster
launcher is not proof that all workers are listening or receiving work.

Validate every completed application response, including status and exact
expected content. Report HTTP errors, invalid responses, timeouts, and
incomplete requests separately. High request counts are not useful when the
intended application calculation or response is not being exercised.

### Repeat measurements and retain context

Use several measured runs and disclose their variation. Alternate competing
configurations where practical to reduce time-dependent bias. Treat an
isolated first-run slowdown or latency spike as an observation until it is
reproduced or correlated with CPU, network, garbage collection, or another
measurement. Do not discard unfavorable runs merely because later runs are
faster.

Do not compare results from different bodies, application calculations,
connection counts, client-process counts, hosts, or measurement durations as
though they were controlled comparisons. Historical measurements below are
reference points for one environment, not universal Achieve results.

### Observe every cluster worker

Node cluster scheduling does not promise equal request counts per worker.
Record per-worker request counts or CPU and summarize the minimum, maximum,
average, and meaningful skew. Uneven distribution is not a defect unless it
causes a demonstrated capacity, latency, or correctness problem. The reviewed
cluster example explicitly uses `cluster.SCHED_RR` to avoid the strong
platform-dependent concentration possible with shared-handle scheduling.

## November 13, 2026 reference measurements

These measurements used Achieve 3.1.2 and Node.js 24.22.3 on an HP computer
with eight physical cores and sixteen logical processors. They are retained to
prevent later sessions from accidentally presenting unlike experiments as a
single progression.

### Six-pass sales servlet over the LAN

The application performed a deterministic sales calculation six times and
returned a validated JSON result. The HP ran sixteen Achieve workers with
`cluster.SCHED_RR`. Four independent client processes ran on the Acer.

At 640 total persistent connections, repeated measurements reached about
26,200 validated requests per second. HP total CPU was about 91--92%, and the
Achieve workers together consumed about 12.5 logical CPU cores. All responses
validated, and the monitored network bandwidth was not saturated.

This result superseded an earlier apparent remote ceiling near 2,900 requests
per second. That lower figure was produced with insufficient connection
concurrency for the LAN latency; it was not evidence that Achieve, Wi-Fi, or
the server was limited to that rate.

### Minimal Hello World servlet on loopback

The servlet was:

```javascript
exports.servlet = function () {
  return "Hello World";
};
```

Eight independent localhost client processes maintained 48 connections each,
for 384 total connections. Repeatable 30-second measurements produced about
37,000 validated requests per second with no failures. Total HP CPU was about
99%. The clients and the sixteen Achieve workers shared the same processor
capacity.

The practical same-host sweet spot was 384 connections. Additional
connections provided little or no throughput and raised tail latency. The
result measures combined same-host client/server capacity and must not be
described as the isolated maximum of the Achieve server.

### Single-process and cluster comparison

In the controlled remote comparison at 256 persistent connections,
single-process Achieve produced about 5,914 validated requests per second and
the sixteen-worker cluster produced about 19,501. The observed improvement was
about 3.30 times, with zero validation failures.

This is a comparison for that workload, client arrangement, and machine. It
does not imply that every application or connection pattern scales by the same
factor.

## HP and Acer LAN setup

The following configuration worked during the November 13 experiments. IP
addresses and interface state are observations from that day and **must be
verified before reuse**.

| Component | Observed configuration |
| --- | --- |
| HP | Achieve server |
| HP LAN address | `192.168.50.134` |
| HP connection | Wi-Fi; Windows network profile set to Private |
| Achieve port | `8989` |
| Acer | Independent benchmark load generator |
| Acer LAN address | `192.168.50.201` |
| Acer connection | Ethernet |
| LAN | `192.168.50.0/24` through an ASUS router |
| Client runtime | Node.js 24.x |

Achieve listened on all HP interfaces. Windows Firewall remained enabled. An
existing inbound rule named `dev_ports_tcp` allowed TCP ports 8989 and 8999.
No router port forwarding was needed because both machines communicated on the
same LAN. Correct HTTP responses were verified before benchmark traffic was
started.

### Initial verification

On each computer, first establish the current addresses rather than assuming
the historical values:

```text
ipconfig
```

On the HP, verify the expected listener and owning process:

```text
netstat -ano | findstr :8989
```

Then make one request from the Acer and verify its status and exact expected
body before starting concurrent traffic. For example, when the historical
addresses and endpoint are still applicable:

```text
node -e "fetch('http://192.168.50.134:8989/servlets/hello.jss.cjs').then(async r => console.log(r.status, JSON.stringify(await r.text()))).catch(console.error)"
```

Use the actual benchmark endpoint and expected response for the experiment;
the example above is only a connectivity smoke test.

### Intermittent-connectivity lesson

Communication became intermittent during part of the investigation. Requests
from the Acer timed out after earlier success, and later tests succeeded again
without a deliberate Achieve or network configuration change. The cause was
not established. The evidence does not justify attributing it specifically to
Windows Firewall, Wi-Fi, ARP, the router, or Achieve.

Useful checks were bounded and observational:

1. Re-run `ipconfig` on both computers and confirm the active interfaces and
   current subnet.
2. Confirm the HP listener and PID with `netstat -ano`.
3. Confirm that the HP network profile and the existing firewall rule still
   have the expected state; do not disable the firewall as a diagnostic
   shortcut.
4. Try one short HTTP request and record whether failure is DNS, connection
   timeout, connection refusal, HTTP status, or response validation.
5. If it fails, compare reachability in both directions and inspect current
   ARP and TCP state before changing anything.
6. After connectivity returns, repeat the exact smoke request and response
   validation before resuming a long benchmark.

Do not turn an intermittent recovery into a claimed root cause. Preserve the
observed command output and timestamps if the condition recurs.

## Interpreting monitored evidence

During synchronized LAN runs, correlate the client measurement window with
server CPU, worker CPU, network bytes and packets, TCP retransmissions and
resets, and active connection counts. Computer clocks need not be identical if
load transitions make alignment clear, but record both timelines.

The November measurements demonstrated that all workers were active, response
validation remained exact, and network bandwidth and retransmissions did not
explain the lower low-concurrency result. Increasing concurrency exposed much
more server capacity. That is measured evidence. Claims about the ultimate
capacity of the Wi-Fi link, router, or Achieve remain outside what those runs
established.

## Boundaries and unresolved questions

- Historical results are not release guarantees and should not be used as
  current numbers without reproducing the environment.
- Same-host tests cannot independently saturate clients and servers when both
  compete for all available processors.
- The intermittent HP/Acer connectivity event has no confirmed root cause.
- A successful normal cluster run does not prove that buffered log records
  survive abrupt worker termination.
- Worker distribution and throughput can change with operating system, Node
  version, scheduling policy, connection reuse, and application workload.
- Native server capacity beyond the combined 37,000-request-per-second
  localhost result would require an independently capable load generator.

Future work should begin from a specific unanswered question, reuse an
existing harness when it matches the workload, and stop when measurements
distinguish the competing explanations. Do not repeat broad connection sweeps
or rediscover the client-saturation lessons without contrary evidence.
