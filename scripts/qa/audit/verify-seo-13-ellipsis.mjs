const BASE="http://localhost:3100";
const xml=await (await fetch(BASE+"/sitemaps/proizvodi-1.xml")).text();
const urls=[...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m=>m[1].replace(/^https?:\/\/[^/]+/,"")).filter(p=>p.startsWith("/deo/"));
let i=0;const res=[];
await Promise.all(Array.from({length:4},async()=>{while(i<urls.length){const u=urls[i++];const h=await (await fetch(BASE+u)).text();const d=(h.match(/<meta name="description" content="([^"]*)"/)||[])[1]||"";res.push({u,d});}}));
const has=(re)=>res.filter(r=>re.test(r.d)).length;
console.log("total",res.length,"any ellipsis",has(/…/),"'i još…'",has(/i još…/),"'i …'",has(/ i …/),"cut mid-word (letter…)",has(/[A-Za-zčćžšđ]…/),"space…",has(/ …/),"no 'za' vehicle list",res.filter(r=>!/ za /.test(r.d)).length);
console.log("lengths >155:",res.filter(r=>r.d.length>155).length);
console.log(res.filter(r=>/…/.test(r.d)).slice(0,50).map(r=>r.d.match(/za (.{0,60}…)/)?.[1]).filter(Boolean).slice(0,40).join("\n"));
