"""Offline HTML structure, local links, language, shared code and sitemap checks."""
from html.parser import HTMLParser
from html import escape
from pathlib import Path
import re
import json
import hashlib
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
BASE = 'https://highlevellogic.github.io/achieve/'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class Page(HTMLParser):
    def __init__(self, file):
        super().__init__(convert_charrefs=True)
        self.file, self.stack, self.nodes, self.code = file, [], [], ''
        self.blocks, self.block_text, self.block_tag = [], [], None
        self.doctype = False
    def handle_decl(self, decl):
        assert decl.lower() == 'doctype html', decl
        self.doctype = True
    def handle_starttag(self, tag, attrs):
        assert len(attrs) == len(dict(attrs)), f'Duplicate attributes: {tag}'
        attrs = dict(attrs)
        self.nodes.append((tag, attrs))
        if tag in {'h1', 'h2', 'p', 'li'}:
            self.block_tag, self.block_text = tag, []
        if tag not in VOID:
            self.stack.append(tag)
        for key in ('href', 'src'):
            url = attrs.get(key, '')
            if url and not re.match(r'^(https?:|#)', url):
                assert (self.file.parent / url.split('#')[0]).exists(), f'Missing local resource: {url}'
    def handle_endtag(self, tag):
        assert self.stack and self.stack.pop() == tag, f'Unbalanced {tag}'
        if tag == self.block_tag:
            self.blocks.append((tag, ' '.join(''.join(self.block_text).split())))
            self.block_tag, self.block_text = None, []
    def handle_data(self, data):
        if self.block_tag:
            self.block_text.append(data)
        if 'code' in self.stack:
            self.code += data

manifest = json.loads((ROOT / 'tools/introduction-pages/languages.json').read_text(encoding='utf-8'))
codes = [l['code'] for l in manifest]
assert len(codes) == len(set(codes)) and codes[:2] == ['en', 'de']
assert all(re.fullmatch(r'[a-z]{2}', code) for code in codes)
expected_alternates = {l['code']: l['url'] for l in manifest}
expected_alternates['x-default'] = BASE + 'en/index.htm'
expected_code = (ROOT / 'tools/introduction-pages/servlet-example.txt').read_text(encoding='utf-8').rstrip()
pages = {}
for language in manifest:
    lang = language['code']
    assert language['source'] == f'{lang}.html' and language['url'] == BASE + f'{lang}/index.htm'
    file = ROOT / f'docs/{lang}/index.htm'
    text = file.read_text(encoding='utf-8', errors='strict')
    assert '\ufffd' not in text and not text.startswith('\ufeff'), 'Invalid/replaced Unicode text'
    page = Page(file)
    page.feed(text)
    page.close()
    pages[lang] = page
    source = (ROOT / 'tools/introduction-pages' / language['source']).read_text(encoding='utf-8')
    assert source.count('{{SERVLET_EXAMPLE}}') == 1
    source = source.rstrip().replace('{{SERVLET_EXAMPLE}}', escape(expected_code, quote=False).replace('"', '&quot;'))
    generated_main = re.search(r'<main>\s*([\s\S]*?)\s*</main>', text).group(1)
    assert generated_main == source, f'{lang}: generated article differs from its source'
    assert 'ExpressRoute' not in text and '{{' not in text
    assert page.doctype and not page.stack and text.count('<h1>') == 1
    assert re.search(r'<title>(.*?)</title>', text).group(1) == escape(language['title'], quote=False)
    assert ('h1', language['title']) in page.blocks, f'{lang}: localized article title missing'
    assert ('html', {'lang': lang}) in page.nodes
    assert ('meta', {'charset': 'utf-8'}) in page.nodes
    assert any(t == 'meta' and a.get('name') == 'description' and a.get('content') == language['description'] for t, a in page.nodes)
    alternate_nodes = [a for t, a in page.nodes if t == 'link' and a.get('rel') == 'alternate']
    assert len(alternate_nodes) == len(manifest) + 1
    assert {a['hreflang']: a['href'] for a in alternate_nodes} == expected_alternates
    assert any(t == 'link' and a.get('rel') == 'canonical' and a.get('href') == language['url'] for t, a in page.nodes)
    assert not any(t == 'nav' for t, a in page.nodes)
    assert not any(t == 'a' and a.get('href') in {f"../{l['code']}/index.htm" for l in manifest} for t, a in page.nodes)
    assert re.search(r'<header>\s*<img src="\.\./images/skyhigh1\.jpg" alt="">\s*<h3 id="friend">Friendly in development\. Fast in production\.</h3>\s*</header>\s*<main>\s*<h1>', text)
    assert text.count('id="friend"') == 1
    assert page.code == expected_code, f'{lang}: servlet example changed'
    footer = re.search(r'<footer>([\s\S]*?)</footer>', text).group(1)
    footer_page = Page(file)
    footer_page.feed('<footer>' + footer + '</footer>')
    footer_page.close()
    footer_links = [a for t,a in footer_page.nodes if t == 'a']
    assert [a['href'] for a in footer_links] == ['../index.htm', 'https://www.npmjs.com/package/achieve', 'https://github.com/highlevellogic/achieve']
    for label in language['footer'].values():
        assert escape(label, quote=False) in footer
    for url in (BASE, 'https://www.npmjs.com/package/achieve', 'https://github.com/highlevellogic/achieve'):
        assert any(t == 'a' and a.get('href') == url for t,a in page.nodes)
        assert url in generated_main, f'{lang}: article link missing'
    assert len(page.blocks) == len(pages['en'].blocks), f'{lang}: omitted or extra article blocks'
    assert [tag for tag,_ in page.blocks] == [tag for tag,_ in pages['en'].blocks]
    if lang != 'en':
        english_prose = {s for tag,s in pages['en'].blocks if tag == 'p'}
        assert not english_prose.intersection(s for tag,s in page.blocks if tag == 'p'), f'{lang}: English paragraph substituted'
        assert language['description'] != manifest[0]['description']
        assert language['title'] != manifest[0]['title']
    print(f'PASS {lang}: generated content, localized metadata, UTF-8/structure, links, {len(manifest)+1} alternates, standard header, identical code')
assert ('h2', 'Mehr als nur die Ausführung von Servlets') in pages['de'].blocks
baseline = json.loads((ROOT / 'tools/introduction-pages/expansion-review/approved-baseline.json').read_text(encoding='utf-8'))
for path, digest in baseline.items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, f'Approved file changed: {path}'
print('PASS approved English/German source, CSS and shared example unchanged')
toc_file = ROOT / 'docs/index.htm'
toc_text = toc_file.read_text(encoding='utf-8')
toc = Page(toc_file)
toc.feed(toc_text)
toc.close()
assert not toc.stack
section = re.search(r'<h2>Achieve in other languages</h2>\s*<ul class="docList">([\s\S]*?)</ul>', toc_text).group(1)
section_page = Page(toc_file)
section_page.feed(section)
section_page.close()
links = [a for t,a in section_page.nodes if t == 'a']
assert len(links) == len(manifest)
for language, link in zip(manifest, links):
    assert link == {'class':'docLink', 'href':f"{language['code']}/index.htm", 'lang':language['code'], 'hreflang':language['code']}
    assert escape(language['name'], quote=False) in section
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls = [e.text for e in ET.parse(ROOT / 'docs/sitemap.xml').findall('s:url/s:loc', ns)]
old = [e.text for e in ET.parse(ROOT / 'tools/introduction-pages/sitemap-baseline.xml').findall('s:url/s:loc', ns)]
assert len(old) == 11 and len(urls) == len(set(urls)) == 11 + len(manifest)
assert urls == old + [l['url'] for l in manifest]
for url in urls:
    assert (ROOT / 'docs' / (url.removeprefix(BASE) or 'index.htm')).is_file()
assert not (ROOT / 'docs/robots.txt').exists()
print(f'PASS TOC: {len(manifest)} manifest links; sitemap: 11 original + {len(manifest)} introduction URLs; no project robots.txt')
