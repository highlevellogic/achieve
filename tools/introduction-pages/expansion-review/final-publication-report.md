# Achieve 3 international introductions — final publication proposal

23 October 2026 · branch **codex-work** · **Prepared for review; nothing staged, committed, pushed, merged or published.**

## Approved corrections applied

All five replacements were extracted from `translation-quality-report.md` and checked against the resulting files. No additional editorial changes were made.

| ID | Source/configuration | Exact replacement | Generated output |
|---|---|---|---|
| M1 | `tools/introduction-pages/mr.html` | `कॉन्फिगर करता येणारे URL रूटिंग` | `docs/mr/index.htm` |
| M2 | `tools/introduction-pages/mr.html` | `कॉन्फिगरेशनविषयी माहिती` | `docs/mr/index.htm` |
| I1 | `tools/introduction-pages/id.html` | `Untuk aplikasi yang lebih kompleks, servlet dapat mengakses objek permintaan dan respons Node.js yang mendasarinya serta mengelola respons secara langsung.` | `docs/id/index.htm` |
| I2 | `tools/introduction-pages/languages.json`, Indonesian description | `Achieve adalah server web dan server aplikasi HTTP untuk Node.js.` | `docs/id/index.htm` description; its second sentence is unchanged |
| T1 | `tools/introduction-pages/tr.html` | `Hafif bir Node.js web sunucusu, daha basit bir arka uç geliştirme ortamı veya Express'e alternatif arıyorsanız Achieve incelenmeye değer.` | `docs/tr/index.htm` |

The existing builder regenerated the collection. Exact before/after comparison across **46 files** found only **seven changed files**: the three fragments above, `languages.json`, and `docs/{mr,id,tr}/index.htm`. The other 39 files are byte-identical. [Verification evidence](approved-corrections-verification.json) records the result and all nineteen page hashes/statuses.

The **complete generated English and German files**, their approved source fragments, the corrected German heading, shared CSS, template, banner reference and JavaScript example are unchanged. No other translation was rewritten. The standard English slogan, article links and three repeated footer links remain intact.

## Validation results

Commands completed successfully:

```text
node tools/introduction-pages/build.mjs
python tools/introduction-pages/validate.py
node --check tools/introduction-pages/build.mjs
node --check tools/introduction-pages/layout-audit.mjs
```

[Complete validation output](final-validation.txt) shows a pass for **all nineteen languages**, including checks of the actual generated HTML:

- Generated article equals its correct source with the identical shared JavaScript example inserted.
- Localized title, description, H1, UTF-8, HTML structure and correct `lang` value.
- Nineteen language alternates plus English `x-default` on every introduction: **twenty `hreflang` links per page**, with correct project URLs and self-canonical.
- Standard banner, English slogan and dividing-line structure; no introduction-page language selectors.
- Correct documentation/npm/GitHub links in both article and footer; local links, CSS and banner paths resolve.
- English/German approved sources, CSS and example match the existing approved hash baseline.
- Documentation TOC has **nineteen manifest-derived language links**. Sitemap has **thirty unique URLs: eleven original documentation URLs plus nineteen introductions**. TOC and sitemap are byte-identical to their pre-correction state.
- No project-level `robots.txt` was created.

These are structural/content checks, not a new live HTTP-availability or native-language certification. Earlier layout previews remain representative: the changes affect only a few phrases/one metadata sentence, not CSS or template design. New screenshots were not required or generated for this correction pass. The limitations of the earlier language-quality review remain documented; no further wording changes are proposed here.

## All nineteen generated pages in the publication set

**Every page below exists, is not Git-ignored, and is explicitly included in [publication-files.json](publication-files.json).** All nineteen currently have Git status `??` (untracked). They must be included by exact path when staging is later authorized; ordinary tracked-diff summaries are insufficient. No staging was performed to establish this list.

| Language | File to include |
|---|---|
| English | `docs/en/index.htm` |
| German | `docs/de/index.htm` |
| French | `docs/fr/index.htm` |
| Spanish | `docs/es/index.htm` |
| Portuguese | `docs/pt/index.htm` |
| Polish | `docs/pl/index.htm` |
| Ukrainian | `docs/uk/index.htm` |
| Romanian | `docs/ro/index.htm` |
| Czech | `docs/cs/index.htm` |
| Swedish | `docs/sv/index.htm` |
| Hindi | `docs/hi/index.htm` |
| Bengali | `docs/bn/index.htm` |
| Tamil | `docs/ta/index.htm` |
| Telugu | `docs/te/index.htm` |
| Marathi | `docs/mr/index.htm` |
| Japanese | `docs/ja/index.htm` |
| Korean | `docs/ko/index.htm` |
| Indonesian | `docs/id/index.htm` |
| Turkish | `docs/tr/index.htm` |

Their public URLs are `https://highlevellogic.github.io/achieve/<code>/index.htm`; no URL contains `/docs/`.

## Files proposed for the eventual commit

The authoritative exhaustive list is [publication-files.json](publication-files.json), including role, existing Git status, size and SHA-256 for each file. It distinguishes published documentation from maintenance tools and review evidence. Nothing outside that list is implicitly approved for inclusion.

1. **Published documentation:** the nineteen pages listed above, `docs/index.htm`, `docs/sitemap.xml` and `docs/introduction.css` — **22 files**. The existing banner is already tracked and unchanged; no replacement banner file is needed.
2. **Reproducible sources and tooling:** all nineteen language fragments (`tools/introduction-pages/<code>.html`), plus `languages.json`, `template.html`, `build.mjs`, `validate.py`, `servlet-example.txt`, `sitemap-baseline.xml` and `README.md`. The approved English/German fragments and unchanged dependencies are included because they are part of the still-untracked introduction proposal. Optional local review tools `preview.ps1` and `layout-audit.mjs` are included for reproducibility. These files are outside `docs` and are not GitHub Pages content.
3. **Review evidence:** the expansion and translation-quality reports and their linked validation/preservation/layout evidence, representative screenshots, this final report, the exact-correction verification, final validation log and the publication file list. Exact paths are enumerated in the JSON rather than using a directory-wide Git add.

**Explicitly exclude** unrelated working-tree changes (including existing `start.js` changes), `docs/en/index.odt` and any editor lock files, the user's `docs/de/ss.jpg`, site-verification HTML, earlier screenshot batches outside `expansion-review/screenshots`, raw browser/server diagnostic dumps, temporary browser profiles and the raw before-text snapshot `approved-corrections-before.json`. Those files are preserved locally; none was deleted or staged. Historical review manifests are snapshots of earlier states, not substitutes for the new publication list.

No server implementation, package metadata, existing tutorial or reference page was changed by this work. The final proposal is ready for review. **Wait for explicit approval before any commit, push, merge into master, publication or GitHub Pages setting change.**
