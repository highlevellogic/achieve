# Achieve 3 international introductions — expansion review

23 October 2026. Prepared on **codex-work** only. **No staging, commits, pushes, merges, publication or GitHub Pages setting changes were performed.**

## Outcome and approval boundary

Nineteen static introduction pages are prepared: the two approved articles and seventeen new translation drafts. Existing HTML design, banner, English header slogan, improved contrast and JavaScript example are retained. Article links and the three footer links are intentionally duplicated. Individual introductions have no visible language selector. The shared English/German article sources, CSS and example pass SHA-256 preservation checks against [the captured approved baseline](approved-baseline.json).

All new translations require editorial review before publication. No external translation provider, paid API, dependency or translation framework was used. Structural validation and local screenshots do not establish search improvement, flawless translation or native-speaker approval.

## All generated languages and files

Each public URL is `https://highlevellogic.github.io/achieve/<code>/index.htm`, **without `/docs/`**. Each source path below is relative to `tools/introduction-pages/`.

| Language | Code | Source fragment | Generated page |
|---|---|---|---|
| English | en | `en.html` | `docs/en/index.htm` |
| Deutsch | de | `de.html` | `docs/de/index.htm` |
| Français | fr | `fr.html` | `docs/fr/index.htm` |
| Español | es | `es.html` | `docs/es/index.htm` |
| Português | pt | `pt.html` | `docs/pt/index.htm` |
| Polski | pl | `pl.html` | `docs/pl/index.htm` |
| Українська | uk | `uk.html` | `docs/uk/index.htm` |
| Română | ro | `ro.html` | `docs/ro/index.htm` |
| Čeština | cs | `cs.html` | `docs/cs/index.htm` |
| Svenska | sv | `sv.html` | `docs/sv/index.htm` |
| हिन्दी | hi | `hi.html` | `docs/hi/index.htm` |
| বাংলা | bn | `bn.html` | `docs/bn/index.htm` |
| தமிழ் | ta | `ta.html` | `docs/ta/index.htm` |
| తెలుగు | te | `te.html` | `docs/te/index.htm` |
| मराठी | mr | `mr.html` | `docs/mr/index.htm` |
| 日本語 | ja | `ja.html` | `docs/ja/index.htm` |
| 한국어 | ko | `ko.html` | `docs/ko/index.htm` |
| Bahasa Indonesia | id | `id.html` | `docs/id/index.htm` |
| Türkçe | tr | `tr.html` | `docs/tr/index.htm` |

English/German articles and localized metadata retain their approved wording. German's heading remains **Mehr als nur die Ausführung von Servlets**. Their generated HTML changes only to include all search alternates. All new article fragments follow the English block structure and retain the complete introduction rather than substituting a summary.

## Manifest, builder and navigation

[languages.json](../languages.json) is the single ordered configuration. Each record has `code`, native language `name`, relative fragment `source`, public `url`, localized `title`/`description`, and localized `footer` labels. Native names are used in the English documentation TOC; the exact requested language codes are used consistently, including `uk`, `cs`, `bn` and `id`.

The built-in Node.js builder validates manifest paths/codes/duplicates and prepares every page before writing. It substitutes the same example into each fragment and the same shared shell into each page. It regenerates only the existing language section of `docs/index.htm`, using its established `docList`/`docLink` classes. Other TOC sections, tutorials and reference content are not rewritten.

The sitemap retains the **eleven original URLs, in order**, then lists **nineteen introduction URLs**: thirty unique entries total. Each introduction has a self-canonical and **twenty alternate links**: nineteen languages plus `x-default` to English. These are search metadata, not visible language choices. No `robots.txt` was created.

## Validation results

[Validation output](validation.txt): all nineteen generated files pass. Checks cover:

- Valid UTF-8 without replacement characters, HTML doctype, balanced elements and attributes, language identifier, localized title/description and article H1.
- Complete generated main content equals its corresponding source with the shared example inserted. Article block count and tag order match the English master.
- No copied English article paragraphs in translated pages. English technical names, code, URLs and the standard brand slogan are intentionally retained.
- Identical decoded JavaScript code across all nineteen pages; one unchanged English slogan immediately below the banner; no language selector.
- Required links in **both** article and footer; all relative resources exist. Destination URLs remain the approved documentation, npm and GitHub URLs. This is not a new live availability audit of those external services.
- Exact manifest/TOC/sitemap/alternate consistency, no duplicate sitemap entries, and existence of every sitemap target.
- Approved source/CSS/example preservation, including the German editorial correction.

[Negative controls](negative-controls.txt) were run in memory without changing files. The validator rejected (1) an English body substituted into generated German output, (2) an English paragraph substituted into **both** Japanese source and generated output, and (3) a missing alternate. The second control demonstrates that agreement with a fragment alone is insufficient to pass.

Node syntax checks passed for the builder and optional layout-audit server. A repeated build produced byte-identical pages, TOC and sitemap. Language counts and alternate expectations are derived from the manifest, so a future approved language needs no separate validator list. The validator is intentionally small, using Python built-ins; it is not a W3C conformance certification, general language detector or semantic translation validator. It does not prove every sentence is idiomatic or every browser renders identically.

## Visual evidence

Installed headless Chrome generated twelve original PNGs: the six required representative languages at **1280px desktop** and **480px narrow** widths. Each language also has a separate top-section review sheet assembled from the two captures; original PNGs are retained unchanged.

| Language | Desktop capture | Narrow capture | Combined top review |
|---|---|---|---|
| German | [desktop](screenshots/de-desktop.png) | [narrow](screenshots/de-narrow.png) | [review](screenshots/de-review.png) |
| Hindi | [desktop](screenshots/hi-desktop.png) | [narrow](screenshots/hi-narrow.png) | [review](screenshots/hi-review.png) |
| Tamil | [desktop](screenshots/ta-desktop.png) | [narrow](screenshots/ta-narrow.png) | [review](screenshots/ta-review.png) |
| Ukrainian | [desktop](screenshots/uk-desktop.png) | [narrow](screenshots/uk-narrow.png) | [review](screenshots/uk-review.png) |
| Japanese | [desktop](screenshots/ja-desktop.png) | [narrow](screenshots/ja-narrow.png) | [review](screenshots/ja-review.png) |
| Korean | [desktop](screenshots/ko-desktop.png) | [narrow](screenshots/ko-narrow.png) | [review](screenshots/ko-review.png) |

The inspected review sheets show intact banner/slogan, recognizable script glyphs without missing-character boxes, wrapped headings and paragraphs, readable code and consistent layout. Tamil headings occupy more lines; Japanese uses the locally available fallback glyphs; Korean can break within a word under default browser line-breaking. No CSS/font changes were made to override the approved design.

An initial visual concern about long Tamil words was checked using a separate local same-origin iframe audit after font loading. [Layout measurements](layout-metrics.json) report **no document or article-heading/paragraph horizontal overflow in any of the twelve cases**. The 480px iframe has 465px content width when its scrollbar is present, so that measurement also tests a slightly narrower text area. This is bounded to the tested browser, fonts and widths; it is not a guarantee at every mobile size.

The first loopback audit attempt timed out across isolated execution contexts. Starting the local-only server and browser in the same permitted context resolved access without disabling security controls. The server was stopped afterward. Screenshots were produced directly from local files; no site was uploaded or published. Optional contact-sheet creation used existing Windows drawing APIs because Python Pillow was unavailable; no package was installed. The maintained preview command does not depend on Pillow.

## Translation issues for review

No new feature, benchmark, superiority comparison or Express modification claim is intended. The development-mode qualifier is preserved in every translation, as are ordinary module access and direct request/response control. The English slogan remains the approved brand text on every page; it is not an independently validated performance result.

The seventeen new translations have **not** received native-speaker technical review. Review terminology for servlet, framework, middleware, request/response, configuration and reload, especially in the five Indian languages. Portuguese uses Brazilian technical vocabulary with the requested generic `pt` code; regional suitability is an editorial decision. Japanese/Korean and Indian scripts rely on available local font fallback; other operating systems may use different glyph metrics. Bengali, Telugu and Marathi pass HTML/content checks but were not included in the requested representative visual sample.

Meta descriptions are localized summaries of the approved positioning, not new claims. Human review should include these and the footer labels. No search ranking or traffic outcome has been measured for these unpublished pages.

## Complete proposed changes

[proposed-files.json](proposed-files.json) enumerates every file in this introduction proposal with SHA-256 hashes and a role. It includes previously prepared introduction infrastructure so review does not omit untracked files. It excludes unrelated pre-existing work, the user's ODT/lock files, `docs/de/ss.jpg`, site-verification HTML and prior screenshot batches. Its own path is excluded from hashing to avoid a self-reference; this report and the current expansion evidence are included.

Production/preparation files in scope:

1. `docs/index.htm`: existing language TOC section expands from two to nineteen links.
2. `docs/sitemap.xml`: eleven original entries plus nineteen introductions.
3. All nineteen `docs/<code>/index.htm` files listed above, including the two approved introductions with expanded head alternates.
4. `tools/introduction-pages/languages.json`: new shared manifest.
5. `tools/introduction-pages/build.mjs`, `template.html`, `validate.py`, `README.md`: update to the manifest-driven workflow and generated-output validation.
6. Seventeen new `tools/introduction-pages/<code>.html` fragments for fr/es/pt/pl/uk/ro/cs/sv/hi/bn/ta/te/mr/ja/ko/id/tr.
7. Existing, unchanged proposal dependencies: `en.html`, `de.html`, `servlet-example.txt`, `sitemap-baseline.xml` and `docs/introduction.css`.
8. Optional review tools `preview.ps1` and `layout-audit.mjs`; current `expansion-review/` baseline, logs, layout measurements, screenshots, this report and file manifest.

Ordinary Git diff summaries omit untracked files; the full proposal is the explicit manifest, not just the tracked diff. No server implementation, package metadata, tutorial or reference page was modified. Existing unrelated `start.js` changes were left alone.

## Repeat and next step

From the repository root:

```text
node tools/introduction-pages/build.mjs
python tools/introduction-pages/validate.py
```

Optional Windows screenshots: `& tools/introduction-pages/preview.ps1`. See [maintenance instructions](../README.md) for the optional local layout audit and temporary browser profile behavior. All production generation/validation uses built-in Node/Python APIs with no installed dependencies.

Review the translations, metadata, previews and complete file proposal. **Wait for explicit approval before staging, committing, pushing, merging to master or publishing.**
