# Static-file physical-path containment limitation

**Recorded:** 2026-11-08
**Status:** Internal engineering note

Achieve validates a static resource's resolved physical path against the configured application space before opening the resource. The descriptor-first static-file path opens that validated resolved path, which prevents a demonstrated final junction retarget from redirecting the open to a different file.

A pre-existing time-of-check/time-of-use limitation remains for ancestor path components. If an actor can rename or replace an ancestor directory after physical-path resolution but before the validated path is opened, pathname-based opening cannot guarantee that every component still identifies the hierarchy that was validated. A deterministic engineering probe demonstrated this condition in both the released pathname flow and the descriptor-first prototype.

This condition is not independently exploitable by an ordinary remote HTTP client. Triggering it requires filesystem privileges, or an application facility that effectively grants an attacker the ability to rename or replace application-space directories during request processing. Application code, deployment tooling, and upload handling therefore must not allow untrusted users to modify application-directory structure.

Node.js does not expose a practical cross-platform API that pins and traverses every path component relative to opened directory descriptors. POSIX final-component options such as `O_NOFOLLOW` do not provide a portable Windows solution and do not, by themselves, prevent replacement of ancestor components. A complete code-level mitigation would require separately approved platform-specific handling or a different filesystem architecture.

Deployment safeguards remain important:

- Run Achieve with the minimum filesystem permissions required.
- Prevent untrusted processes and application users from renaming or replacing application-space directories.
- Store user-controlled uploads outside the executable and static application tree unless their directory structure is trusted and immutable to requesters.
- Treat application-space write access as security-sensitive administrative access.

The descriptor-first optimization introduces no new containment race. It improves the final-component junction case while leaving this ancestor-component limitation unchanged.
