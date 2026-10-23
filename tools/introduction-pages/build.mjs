import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
const local = name => new URL(name, import.meta.url);
if (execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim() !== 'codex-work') {
  throw new Error('Prepare introduction pages on codex-work only.');
}
const template = await readFile(local('template.html'), 'utf8');
const example = (await readFile(local('servlet-example.txt'), 'utf8')).trimEnd();
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const languages = JSON.parse(await readFile(local('languages.json'), 'utf8'));
const base = 'https://highlevellogic.github.io/achieve/';
const codes = new Set();
for (const language of languages) {
  if (!/^[a-z]{2}$/.test(language.code) || codes.has(language.code) ||
      language.url !== `${base}${language.code}/index.htm` || language.source !== `${language.code}.html` ||
      ![language.name, language.title, language.description, ...Object.values(language.footer)].every(v => typeof v === 'string' && v.trim())) {
    throw new Error(`Invalid/duplicate manifest entry: ${language.code}`);
  }
  codes.add(language.code);
}
const english = languages.find(l => l.code === 'en');
if (!english) throw new Error('English x-default is required');
const alternates = languages.map(l => `<link rel="alternate" hreflang="${l.code}" href="${escape(l.url)}">`);
alternates.push(`<link rel="alternate" hreflang="x-default" href="${escape(english.url)}">`);
// Prepare all pages before writing, so missing fragments cannot leave a partial build.
const pages = [];
for (const language of languages) {
  const body = (await readFile(local(language.source), 'utf8')).trimEnd();
  if (body.split('{{SERVLET_EXAMPLE}}').length !== 2) throw new Error(`Expected one example in ${language.source}`);
  const values = {
    LANG: language.code, URL: escape(language.url), TITLE: escape(language.title), DESCRIPTION: escape(language.description),
    DOCS_LABEL: escape(language.footer.docs), NPM_LABEL: escape(language.footer.npm), GITHUB_LABEL: escape(language.footer.github),
    ALTERNATES: alternates.join('\n'), CONTENT: body.replace('{{SERVLET_EXAMPLE}}', escape(example)),
  };
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Missing template value ${key}`);
    return values[key];
  });
  if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('Unresolved template placeholder');
  pages.push([`docs/${language.code}/index.htm`, html]);
}
const tocPath = new URL('docs/index.htm', root);
const toc = await readFile(tocPath, 'utf8');
const section = /<h2>Achieve in other languages<\/h2>\s*<ul class="docList">[\s\S]*?<\/ul>/g;
if ([...toc.matchAll(section)].length !== 1) throw new Error('Expected one existing language TOC section');
const links = languages.map(l => `<li><a class="docLink" href="${l.code}/index.htm" lang="${l.code}" hreflang="${l.code}">${escape(l.name)}</a></li>`);
const newToc = toc.replace(section, `<h2>Achieve in other languages</h2>\n\n<ul class="docList">\n${links.join('\n')}\n</ul>`);
const baseline = await readFile(local('sitemap-baseline.xml'), 'utf8');
if ((baseline.match(/<loc>/g) || []).length !== 11) throw new Error('Expected eleven original documentation URLs');
const sitemap = baseline.replace('</urlset>', languages.map(l => `  <url><loc>${escape(l.url)}</loc></url>`).join('\n') + '\n</urlset>');
for (const [path, html] of pages) {
  const target = new URL(path, root);
  await mkdir(new URL('./', target), { recursive: true });
  await writeFile(target, html);
  console.log(path);
}
await writeFile(tocPath, newToc);
await writeFile(new URL('docs/sitemap.xml', root), sitemap);
console.log(`Generated ${pages.length} pages, TOC links and sitemap from languages.json`);
