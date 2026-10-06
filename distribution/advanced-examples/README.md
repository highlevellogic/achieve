# Achieve v3 Advanced Examples

This development distribution contains six complete applications that show
Achieve working with the wider Node.js ecosystem:

- MySQL
- WebSockets and Rooms
- Cluster
- XML/SAX streaming
- Distributed computing
- SOAP

For introductory tutorials and API details, see the
[Achieve v3 documentation](https://highlevellogic.github.io/achieve/).

## Requirements

- Node.js 22 or later
- npm
- A MySQL-compatible server only if you want to run the MySQL application

Achieve v3 is bundled as a development dependency inside this ZIP. The
distribution does not require an adjacent Achieve checkout or a published
Achieve v3 npm package.

## Install

Extract the ZIP, open a command prompt in the extracted
`achieve3-examples` directory, and run:

```bash
npm ci
```

## Start the examples

The default launcher serves the landing page, MySQL application, and XML/SAX
application on port 8989:

```bash
npm start
```

Open <http://localhost:8989/>.

The remaining applications need specialized launchers. Stop the current
launcher with Ctrl-C before starting another one.

| Application | Command | Ports | Extra requirement |
| --- | --- | --- | --- |
| MySQL | `npm start` | 8989 | MySQL-compatible server and local credentials |
| XML/SAX streaming | `npm start` | 8989 | None |
| WebSockets and Rooms | `npm run start:websockets` | 8989 | None |
| Cluster | `npm run start:cluster` | 8989 and 8990 | None |
| Distributed computing | `npm run start:distributed` | 8989 and 8990 | None |
| SOAP | `npm run start:soap` | 8989 and 8990 | None |

After starting an application, use the landing page at
<http://localhost:8989/> to open it.

## MySQL setup

Run `application/advanced/mysql/setup.sql` on a MySQL-compatible server. Then
replace the placeholder user name and password in both servlets under
`application/advanced/mysql/servlets/`.

The credentials and login logic are deliberately simple demonstration code;
they are not production authentication guidance.

## Troubleshooting

- **Achieve requires an application space:** use the supplied npm commands.
  Each launcher configures the bundled `application` directory.
- **Port already in use:** stop another example or development server using
  port 8989 or 8990, then retry. For local testing, the launchers also accept
  `ACHIEVE_EXAMPLES_PORT` and `ACHIEVE_EXAMPLES_SECONDARY_PORT` environment
  overrides. Some demonstration pages and service descriptions use the default
  ports, so the defaults are recommended for normal use.
- **MySQL connection failure:** confirm that the database server is running,
  `setup.sql` has been applied, and both servlet credential blocks are correct.
- **Wrong page or unavailable feature:** use the specialized launcher listed
  above for WebSockets, Cluster, Distributed computing, or SOAP.
- **Unsupported Node version:** confirm `node --version` reports version 22 or
  later.

Stop an example with Ctrl-C. Cluster and distributed launchers create child
processes; allow the command to finish shutting them down before starting the
next example.
