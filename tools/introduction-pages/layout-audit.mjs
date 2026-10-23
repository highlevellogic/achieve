// Optional local-only rendering audit. No external requests or page modifications.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../../docs/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('languages.json', import.meta.url), 'utf8'));
const allowed = new Set(manifest.map(l => `/${l.code}/index.htm`).concat('/introduction.css', '/images/skyhigh1.jpg'));
const audit = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Local layout audit</title>
<pre id="results">pending</pre><script>
(async()=>{
 const rows=[];
 for(const lang of ['de','hi','ta','uk','ja','ko']) for(const width of [1280,480]) {
  const frame=document.createElement('iframe');frame.style.cssText='border:0;height:1000px;width:'+width+'px';
  const loaded=new Promise(resolve=>frame.onload=resolve);frame.src='/'+lang+'/index.htm';document.body.append(frame);await loaded;
  const doc=frame.contentDocument;await doc.fonts.ready;
  rows.push({lang,width,client:doc.documentElement.clientWidth,scroll:doc.documentElement.scrollWidth,
   overflow:doc.documentElement.scrollWidth>doc.documentElement.clientWidth,
   overflowing:[...doc.querySelectorAll('main h1,main h2,main p')].filter(e=>e.scrollWidth>e.clientWidth).map(e=>e.textContent.slice(0,70)),
   headingFont:frame.contentWindow.getComputedStyle(doc.querySelector('h1')).fontFamily});frame.remove();
 }
 document.querySelector('#results').textContent=JSON.stringify(rows);document.title='Layout audit complete';
})();</script></html>`;
createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/audit') { response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(audit); return; }
    if (!allowed.has(path)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : path.endsWith('.jpg') ? 'image/jpeg' : 'text/html; charset=utf-8');
    response.end(await readFile(new URL(path.slice(1), root)));
  } catch { response.writeHead(500); response.end(); }
}).listen(8768, '127.0.0.1', () => console.log('Local audit: http://127.0.0.1:8768/audit'));
