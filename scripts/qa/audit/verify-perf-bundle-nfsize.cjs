const fs=require("fs"); const zlib=require("zlib");
for (const n of ["landing","home","korpa","product"]) {
const s=fs.readFileSync(`docs/qa/audit/verify/perf-bundle/${n}.rsc.txt`,"utf8");
const rows=s.split("\n"); const byId=new Map();
for (const r of rows){const i=r.indexOf(":"); if(i>0) byId.set(r.slice(0,i), r);}
// find all notFound values (balanced bracket extraction)
let total=0, parts=[]; let idx=0;
while((idx=s.indexOf('"notFound":[',idx))>=0){ let j=idx+11, depth=0, inStr=false;
  for(;j<s.length;j++){const c=s[j]; if(inStr){ if(c==="\\"){j++;continue;} if(c==='"') inStr=false; continue;} if(c==='"'){inStr=true;continue;} if(c==='['||c==='{')depth++; else if(c===']'||c==='}'){depth--; if(depth===0){j++;break;}}}
  parts.push(s.slice(idx+11,j)); idx=j; }
// referenced rows (transitively) from not-found values
const seen=new Set(); const q=[...parts.join("").matchAll(/"\$L?([0-9a-f]+)"/g)].map(m=>m[1]);
let refBytes=0; const refText=[];
while(q.length){const id=q.pop(); if(seen.has(id)) continue; seen.add(id); const r=byId.get(id); if(!r) continue; if(/^[0-9a-f]+:I\[/.test(r)) continue; refBytes+=r.length; refText.push(r); for(const m of r.matchAll(/"\$L?([0-9a-f]+)"/g)) q.push(m[1]);}
const inline=parts.reduce((a,p)=>a+p.length,0);
const txt=parts.join("")+refText.join("\n");
console.log(n, "notFound values:", parts.length, "sizes", parts.map(p=>p.length).join(","), "| inline", inline, "B + referenced non-import rows", refBytes, "B =", inline+refBytes, "B decoded; gz alone", zlib.gzipSync(txt).length, "B; total rsc", s.length);
}
