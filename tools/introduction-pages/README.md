# International introduction pages

Review draft on `codex-work`. Nothing is committed, merged, pushed or published.
See [the expansion report](expansion-review/report.md) for the complete language/file list, validation and visual evidence, translation limitations and proposed changes.

## Source of truth

- `en.html`: approved English article, authoritative for translations.
- `de.html`: approved German article, including **Mehr als nur die Ausführung von Servlets**.
- The other seventeen language-named HTML fragments: translation drafts for review.
- `languages.json`: ordered language code/name, fragment path, public URL, localized title/description and footer labels. This one manifest supplies page metadata, TOC links, sitemap additions and search alternates.
- `template.html`: shared HTML shell, existing banner, standard **English** slogan, article and footer; no language selector.
- `servlet-example.txt`: single unchanged JavaScript example.
- `docs/introduction.css`: approved shared design, including improved slogan contrast; unchanged by this expansion.
- `sitemap-baseline.xml`: the eleven original documentation URLs, retained before all introduction URLs.

The article and footer intentionally repeat documentation/npm/GitHub links. The documentation link is identified as English in each footer. All public URLs omit `/docs/`.

## Build and validate

From the repository root, with Node.js 22+ and Python 3:

```text
node tools/introduction-pages/build.mjs
python tools/introduction-pages/validate.py
```

No npm install is needed. The builder refuses to run outside `codex-work`, prepares all fragments before writing, then regenerates nineteen `docs/<code>/index.htm` files, only the existing **Achieve in other languages** TOC section, and the sitemap (eleven original plus nineteen introduction URLs). It does not touch server code, tutorials or reference pages. Generated pages are ordinary static HTML with no runtime scripts or translation framework.

Validation reads the **generated HTML** and compares each full article with its own fragment plus shared code. It checks all requested languages, localized metadata, UTF-8 and element structure, standard header, article/footer links, search alternates, source block parity, absence of copied English paragraphs, TOC and sitemap consistency. It is a targeted validator, not a W3C conformance certification or an automatic assessment of translation quality.

`expansion-review/approved-baseline.json` pins the approved English/German fragments, CSS and example for this expansion review. A future authorized editorial change to a pinned file requires deliberately updating that review baseline. Preserve the German heading correction. Do not silently alter English to accommodate a translation.

For a future **approved** translation, add its fragment and manifest entry, then rebuild and validate. Counts, TOC links, sitemap additions and alternates follow that manifest automatically. No additional languages are authorized by this expansion.

## Optional local visual review

With installed Chrome on Windows:

```powershell
& tools/introduction-pages/preview.ps1
```

This captures German, Hindi, Tamil, Ukrainian, Japanese and Korean at desktop and narrow widths without publishing. It writes PNGs below `expansion-review/screenshots` and uses a separate temporary Chrome profile. The source pages and code are not modified. Chrome/Python font fallback can vary across systems; these previews do not replace native-language review.

The optional `layout-audit.mjs` serves only the introduction pages and their CSS/banner at `127.0.0.1:8768`, plus a same-origin audit document at `/audit`. It measures the six representative pages in 1280px and 480px iframes and reports overflow after fonts load. Start it with Node, load `/audit` in a local browser, and stop it after reviewing. Server and browser must run in the same execution context; the first isolated attempt timed out. No security restrictions were disabled.

No `docs/robots.txt` is generated: this project publishes below `/achieve/` and cannot place a host-root file. Crawlability does not guarantee indexing, search rank or demand.

Review translations, metadata, screenshots and the file manifest before authorizing any staging, commit, push, merge or publication.
