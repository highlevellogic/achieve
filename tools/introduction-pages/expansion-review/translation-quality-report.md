# International translation quality review

23 October 2026 · `codex-work` · **Recommendations only; no translation changes applied.**

Reviewed all seventeen new source fragments individually against the approved [English master](../en.html), including headings, paragraphs and resource labels. Also inspected localized title/description/footer configuration in [languages.json](../languages.json). The existing validator confirms that each **generated article** matches its source fragment, so these findings concern the actual prepared pages, not an unused translation draft. The approved German version was not reopened for editorial changes.

**Outcome: 14 Acceptable, 3 Minor correction, 0 Important correction.** Five specific changes are proposed below. “Acceptable” means no correction identified in this review; it does **not** mean verified by a proficient native speaker or approved for publication.

## Individual outcomes

Source paths are relative to `tools/introduction-pages/`; generated counterparts are `docs/<code>/index.htm`.

| Language | Source | Outcome | Findings and outstanding concerns |
|---|---|---|---|
| French | [fr.html](../fr.html) | **Acceptable** | Request-handler definition, native objects and reload qualification preserved. Framework/middleware loanwords are intelligible; no justified correction. |
| Spanish | [es.html](../es.html) | **Acceptable** | Meaning retained throughout; informal reader address is consistent. No new feature or Express dependency implied. |
| Portuguese | [pt.html](../pt.html) | **Acceptable** | Accurate Brazilian Portuguese technical vocabulary. Confirm that this regional usage suits the intended generic `pt` audience; it is not itself an error. |
| Polish | [pl.html](../pl.html) | **Acceptable** | Ordinary modules, request/response access, static resources and development mode retained. No necessary terminology change identified. |
| Ukrainian | [uk.html](../uk.html) | **Acceptable** | Core claims and qualifiers preserved. “Проміжне ПЗ” conveys middleware; replacing it with an English loanword is unnecessary. |
| Romanian | [ro.html](../ro.html) | **Acceptable** | Complete explanation with appropriate request/response, routing and configuration terminology. No justified correction. |
| Czech | [cs.html](../cs.html) | **Acceptable** | Direct Node.js access and response ownership retained; reload explicitly qualified. No necessary wording change identified. |
| Swedish | [sv.html](../sv.html) | **Acceptable** | Coherent developer terminology and faithful scope. “Rutter,” “omladdning” and Node.js modules remain understandable in context. |
| Hindi | [hi.html](../hi.html) | **Acceptable** | Server roles, module/function contract and development-mode reload are intact. Native technical review should confirm the mix of Hindi terms and familiar transliterations; no concrete semantic error identified. |
| Bengali | [bn.html](../bn.html) | **Acceptable** | Complete technical explanation; direct Node.js access and static serving retained. Native review should check request/response vocabulary and loanword spelling, rather than presume these choices wrong. |
| Tamil | [ta.html](../ta.html) | **Acceptable** | No confidently established technical mistranslation. Native technical review should check “செயல்பாடு” for function and “கட்டமைப்பு விவரங்கள்” for configuration information; see limitations below. |
| Telugu | [te.html](../te.html) | **Acceptable** | Handler definition, underlying objects and development-only reloading preserved. Native review should confirm transliterated servlet/framework terminology and inflected technical names. |
| Marathi | [mr.html](../mr.html) | **Minor correction** | M1–M2: configuration is expressed as structure/structuring. Core server and handler claims remain clear. Native review should confirm final Marathi wording and agreement. |
| Japanese | [ja.html](../ja.html) | **Acceptable** | Accurate module/export, request/response and reload terminology. No claim of an Express-based implementation or restricted Node.js access. |
| Korean | [ko.html](../ko.html) | **Acceptable** | Core explanation is faithful and comprehensible. Automatic-reload phrasing is understandable; no purely stylistic replacement is proposed. |
| Indonesian | [id.html](../id.html) | **Minor correction** | I1: “advanced applications” is awkwardly rendered as further applications. I2: metadata abbreviates application **server** ambiguously. |
| Turkish | [tr.html](../tr.html) | **Minor correction** | T1: grammatical construction around “worth exploring” is incomplete/unnatural. Technical claims otherwise preserved. |

## Recommended corrections, pending approval

### M1 — Marathi: configurable routing

**Source:** `tools/introduction-pages/mr.html`, HTTP feature-list paragraph.

**Original passage:** `संरचित करता येणारे URL रूटिंग`

**Proposed replacement:** `कॉन्फिगर करता येणारे URL रूटिंग`

**Reason:** The English says **configurable** URL routing. The current wording suggests routing that can be *structured*, rather than routing whose configuration can be changed. The proposed phrase makes that control explicit without adding a feature. Approximate back-translation: “URL routing that can be structured” → “URL routing that can be configured.”

**Confidence:** The distinction between structure and configuration is well motivated; confirm the preferred spelling/usage of the configuration loanword with a proficient Marathi technical reviewer.

### M2 — Marathi: configuration documentation

**Source:** `tools/introduction-pages/mr.html`, documentation-summary paragraph.

**Original passage:** `संरचनेची माहिती`

**Proposed replacement:** `कॉन्फिगरेशनविषयी माहिती`

**Reason:** The English promises **configuration information**, not information about structure or architecture. This is the same terminology problem as M1 and should be corrected consistently. Back-translation: “information about structure” → “information about configuration.” Do not change the rest of the paragraph.

**Confidence:** Meaning distinction is clear; final Marathi terminology needs proficient native confirmation alongside M1.

### I1 — Indonesian: advanced applications

**Source:** `tools/introduction-pages/id.html`, paragraph about direct request/response access.

**Original sentence:**

> Untuk aplikasi lebih lanjut, servlet dapat mengakses objek permintaan dan respons Node.js yang mendasarinya serta mengelola respons secara langsung.

**Proposed replacement:**

> Untuk aplikasi yang lebih kompleks, servlet dapat mengakses objek permintaan dan respons Node.js yang mendasarinya serta mengelola respons secara langsung.

**Reason:** “Aplikasi lebih lanjut” is an awkward rendering of **more advanced applications** and can read as *further application/use*. “Aplikasi yang lebih kompleks” clearly refers to more complex applications. It leaves object access and direct response management unchanged. This is a clarity correction, not a suggestion that the current sentence forbids advanced use.

**Confidence:** High for the meaning/clarity improvement; no change to technical terminology elsewhere is needed.

### I2 — Indonesian: application-server role in metadata

**Source:** `tools/introduction-pages/languages.json`, `id` entry, `description`. The associated article source is `tools/introduction-pages/id.html`, whose opening sentence is already correct and needs no change.

**Original passage:** `Achieve adalah server web dan aplikasi HTTP untuk Node.js.`

**Proposed replacement:** `Achieve adalah server web dan server aplikasi HTTP untuk Node.js.`

**Reason:** The original compressed metadata can read as *a web server and an HTTP application*, losing the second server role. Repeating “server” resolves the ambiguity and matches the already-correct article. Back-translation: “web server and HTTP application” → “web server and HTTP application server.” Preserve the second metadata sentence unchanged.

**Confidence:** High. Classified minor because the article itself states the correct role and the metadata can be interpreted elliptically; no broad positioning rewrite is warranted.

### T1 — Turkish: worth exploring

**Source:** `tools/introduction-pages/tr.html`, final paragraph before the “JavaScript Servlets” heading.

**Original sentence:**

> Hafif bir Node.js web sunucusu, daha basit bir arka uç geliştirme ortamı veya Express'e alternatif arıyorsanız Achieve'i incelemeye değer.

**Proposed replacement:**

> Hafif bir Node.js web sunucusu, daha basit bir arka uç geliştirme ortamı veya Express'e alternatif arıyorsanız Achieve incelenmeye değer.

**Reason:** The accusative object “Achieve'i” with “incelemeye değer” leaves the construction awkward. The passive “Achieve incelenmeye değer” directly expresses **Achieve is worth exploring/examining**, matching the English. No claim or feature is added.

**Confidence:** High for the grammatical repair; a proficient Turkish reviewer can confirm it before publication.

## Technical and completeness assessment

Across all seventeen articles, the six required concepts remain present: Node.js web/application-server category; ordinary JavaScript modules exporting a request-processing function; an alternative to Express without needing to install it; direct Node.js/module/request-response access; source reloading in development mode; and static-resource serving alongside servlet execution. No translation was found to claim that Achieve is built on Express, requires middleware, restricts normal Node.js programming or reloads servlet code in production.

The paragraphs about supported HTTP features, forms/data/JSON, database/external-service access, useful error reporting and getting started are present. No missing substantive explanation or new performance comparison was identified through the individual reading. Matching block counts alone would not establish semantic completeness; that structural evidence was used only as a cross-check.

The preserved English slogan is intentional brand text, not an untranslated article defect. Likewise JavaScript Servlets, product names, API/code identifiers and URLs are not language-quality errors. Do not change the banner, CSS, standard header, code, article links, duplicated footer links or language annotations when applying any approved correction. If corrections are later approved, edit the source/manifest, regenerate and validate; no such regeneration was performed during this review.

## Reference checks and limitations

This is an AI-assisted linguistic and technical comparison, **not independent native-speaker verification**. The same assistant prepared the drafts earlier, so this is also a self-review rather than an independent translator's review. “Acceptable” is a bounded finding, not a language-quality certification. The highest remaining uncertainty is idiomatic developer usage in Hindi, Bengali, Tamil, Telugu and Marathi. Human reviewers should read those complete articles, not just the proposed edits.

Targeted web reference checks were used to investigate uncertainty, not to replace passages with machine translations:

- The [English–Marathi dictionary entry for “structured”](https://www.translate.com/dictionary/english-marathi/structured-28885329) gives `संरचित`, supporting the lexical concern in M1. This is a commercial dictionary page, not native technical sign-off or proof that its term has only one possible use; no translation service was invoked.
- [UBports' Tamil kernel-build documentation](https://docs.ubports.com/ta/latest/porting/build_and_boot/standalone_kernel_build.html) provides actual usage of configuration-related Tamil vocabulary, including `உள்ளமைவுகள்`. Other retrieved software material also used `கட்டமைப்பு`. This does **not** establish that Achieve's Tamil phrase is wrong. Consequently no categorical Tamil replacement is recommended; a proficient Tamil developer should resolve that question. The quality of another localized page is not itself an authority on native idiom.
- Attempts to locate localized Microsoft/MDN terminology returned Hindi or English results for some requested locales; a Marathi government vocabulary page timed out. Those were not counted as Marathi, Tamil, Indonesian or Turkish native-language verification. No specialized native-review connector or human-review service was available in the exposed tools. Web search is reference assistance, not a substitute.

No external translation engine received the full articles, no paid service was activated, and no source passage was silently replaced. Avoid a wholesale terminology cleanup: alternatives such as translated versus borrowed “framework,” “middleware” or “servlet” are not errors merely because another version sounds preferable.

## Verification and next action

Existing generated-HTML validation passes for all nineteen pages. [Preservation evidence](translation-quality-preservation.json) records hashes for the nineteen generated pages, all source HTML fragments and template, manifest, CSS, TOC, sitemap and shared example. These files were unchanged by the review. Only this report and its preservation record were added; earlier reports and file manifests remain intact as historical evidence.

**For approval:** five narrowly scoped corrections in Marathi, Indonesian and Turkish; native confirmation of the Marathi wording; no editorial changes proposed for the other fourteen languages. No Important correction was identified within this review's limits. Nothing was staged, committed, pushed, merged or published.
