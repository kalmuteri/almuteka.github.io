import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {marked}=await import(process.env.MARKED_MODULE || 'marked');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Usage: node scripts/render-article.mjs writing/article/article.md');
const raw=fs.readFileSync(input,'utf8'),front=raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
if(!front)throw Error('Missing metadata block');
const meta={};
for(const line of front[1].split(/\r?\n/)){
 if(!line.trim()||line.trim().startsWith('#'))continue;
 const match=line.match(/^([a-z_]+):\s*(.*)$/);if(!match)throw Error('Use one key: value per metadata line');
 meta[match[1]]=match[2].startsWith('"')?JSON.parse(match[2]):match[2];
}
const esc=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const plain=s=>s.replace(/\*([^*]+)\*/g,'$1').replaceAll('|',' ').replace(/\s+/g,' ').trim();
const title=s=>s.split('|').map(part=>esc(part.trim()).replace(/\*([^*]+)\*/g,'<em>$1</em>')).join('<br>');
const slug=path.basename(path.dirname(input));
if(meta.slug!==slug)throw Error('slug must match its containing directory');
if(!meta.title||!meta.summary)throw Error('Title and summary are required');
if(!['draft','published'].includes(meta.status))throw Error('status must be draft or published');
const published=meta.status==='published';
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!Number.isNaN(Date.parse(s));
if(published&&!date(meta.publication_date))throw Error('Published articles require an ISO publication_date');
if(meta.updated_date&&!date(meta.updated_date))throw Error('Invalid updated_date');
const stamp=s=>`<time datetime="${s}">${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s))}</time>`;
function url(s){if(!s||/^(?:[a-z]+:|\/\/)/i.test(s)&&!/^https?:\/\//i.test(s))throw Error('Use a relative or HTTPS link');return esc(s);}
let body=raw.slice(front[0].length).replace(/<!--[\s\S]*?-->/g,'');
const math=[];
body=body.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+)\$/g,(_,block,inline)=>{const n=math.length;math.push(block?`<div class="formula">\\[${esc(block.trim())}\\]</div>`:`\\(${esc(inline)}\\)`);return `MATHPLACEHOLDER${n}END`;});
// Author content supports Markdown rather than executable raw HTML.
function md(s){return marked.parse(s.replace(/<[^>]*>/g,m=>esc(m))).replace(/<p>(MATHPLACEHOLDER\d+END)<\/p>/g,'$1');}
const blocks=[];
body=body.replace(/^:::(idea|takeaway|note|figure)(?:[ \t]+([^\n]+))?\n([\s\S]*?)\n:::\s*$/gm,(_,kind,label,contents)=>{
 const n=blocks.length;
 if(kind==='figure'){
  const lines=contents.trim().split('\n'),image=lines.shift().match(/^!\[([^\]]+)\]\(([^)]+)\)$/);
  if(!image)throw Error('A figure begins with ![descriptive alt text](image-path)');
  const src=image[2];if(!/^https?:\/\//.test(src)&&!fs.existsSync(path.resolve(path.dirname(input),src)))throw Error(`Missing image: ${src}`);
  blocks.push(`<figure class="article-figure"><img src="${url(src)}" alt="${esc(image[1])}" loading="lazy"><figcaption>${md(lines.join('\n'))}</figcaption></figure>`);
 }else blocks.push(`<aside class="essay-callout${kind==='takeaway'?' end-thought':''}"><span>${esc(label||{idea:'The central idea',takeaway:'Takeaway',note:'Note'}[kind])}</span>${md(contents)}</aside>`);
 return `\nARTICLEBLOCK${n}END\n`;
});
let html=md(body).replace(/<p>ARTICLEBLOCK(\d+)END<\/p>/g,(_,n)=>blocks[n]).replace(/MATHPLACEHOLDER(\d+)END/g,(_,n)=>math[n]);
html=html.replace(/<table>/g,'<div class="table-wrap"><table class="data-table">').replace(/<\/table>/g,'</table></div>');
const headings=[];
html=html.replace(/<h2>(.*?)<\/h2>/g,(_,text)=>{const id=`section-${headings.length+1}`;headings.push({id,text});return `<h2 id="${id}">${text}</h2>`;});
const toc=headings.length?`<details class="article-contents"><summary>In this article</summary><nav aria-label="Article contents"><ol>${headings.map(h=>`<li><a href="#${h.id}">${h.text}</a></li>`).join('')}</ol></nav></details>`:'';
const related=meta.related_url?`<aside class="related-demo"><strong>${esc(meta.related_title||'Explore this idea')}</strong>${meta.related_description?`<p>${esc(meta.related_description)}</p>`:''}<a href="${url(meta.related_url)}">${esc(meta.related_label||'Open related content')} →</a></aside>`:'';
const next=meta.next_url?`<div class="essay-next"><span>Continue reading</span><a href="${url(meta.next_url)}">${esc(meta.next_title||'Next article')} ↗</a></div>`:'';
const words=html.replace(/<[^>]+>/g,' ').split(/\s+/).length,minutes=Math.max(1,Math.ceil(words/220));
let shell=fs.readFileSync(path.join(root,'templates/article.html'),'utf8');
const vars={TITLE:esc(plain(meta.title)),SLUG:slug,SUMMARY:esc(meta.summary),ROBOTS:published?'index,follow':'noindex,nofollow',CONTENT:`<article class="essay"><header class="essay-head"><p class="eyebrow">${esc(meta.topic)} · ${esc(meta.type||'Essay')}${published?'':' · Draft preview'}</p><h1>${title(meta.title)}</h1><p class="content-date">${published?'Published '+stamp(meta.publication_date):'Draft · Not published'}${meta.updated_date?' · Updated '+stamp(meta.updated_date):''}</p><p class="lead">${esc(meta.subtitle||meta.summary)}</p><div class="essay-meta"><span>${esc(meta.type||'Essay')}${meta.article_number?' / '+esc(meta.article_number):''}</span><span>~${minutes} MIN READ</span><span>${esc(meta.topic)}</span></div></header><div class="essay-body">${toc}${related}${html}${next}</div></article>`};
shell=shell.replace(/\{\{([A-Z]+)\}\}/g,(_,key)=>vars[key]??'');
const out=path.join(path.dirname(input),'index.html');fs.writeFileSync(out,shell);console.log(`Rendered ${out} (${meta.status}, ${minutes} min)`);
