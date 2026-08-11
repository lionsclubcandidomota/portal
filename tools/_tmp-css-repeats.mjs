import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CSS_SOURCES } from './build-css.mjs';
const cssRoot=path.join(process.cwd(),'assets/css');
function stripComments(source){return source.replace(/\/\*[\s\S]*?\*\//g,'');}
function normalize(value){return value.replace(/\s+/g,' ').replace(/\s*([:;,>+~{}])\s*/g,'$1').trim();}
function findClosingBrace(source, openIndex){let depth=1,quote=''; for(let i=openIndex+1;i<source.length;i++){const c=source[i],p=source[i-1]; if(quote){if(c===quote&&p!=='\\')quote='';continue;} if(c==='"'||c==="'")quote=c; else if(c==='{')depth++; else if(c==='}'&&--depth===0)return i;} return -1;}
function extractRules(source, src, context=[], output=[]){const css=stripComments(source); let cursor=0; while(cursor<css.length){const open=css.indexOf('{',cursor); if(open===-1)break; const prelude=normalize(css.slice(cursor,open)); const close=findClosingBrace(css,open); if(close===-1)break; const body=css.slice(open+1,close); if(/^@(media|supports|container|layer)\b/i.test(prelude)) extractRules(body,src,[...context,prelude],output); else if(prelude&&!prelude.startsWith('@')&&!/^(from|to|\d+%)$/i.test(prelude)) output.push({context:context.join(' > '),selector:prelude,body:normalize(body),source:src}); cursor=close+1;} return output;}
const all=[]; for(const src of CSS_SOURCES){const text=await readFile(path.join(cssRoot,src),'utf8'); extractRules(text,src,[],all);}
const m=new Map(); for(const r of all){const k=r.context+'|'+r.selector; if(!m.has(k))m.set(k,[]);m.get(k).push(r);}
const reps=[...m.entries()].filter(([k,v])=>v.length>1).sort((a,b)=>b[1].length-a[1].length);
for(const [k,v] of reps.slice(0,220)){console.log('\n###',k,'x'+v.length); for(const r of v) console.log('-',r.source,'=>',r.body.slice(0,300));}
