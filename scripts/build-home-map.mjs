import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const base=new URL('../',import.meta.url),net=JSON.parse(readFileSync(new URL('public/data/tepic-walk-network.json',base),'utf8'));
const routes=JSON.parse(readFileSync(new URL('public/data/tepic-routes.json',base),'utf8')).routes;
const rad=Math.PI/180,c=[-104.893,21.508],scale=1150000;
const project=(lat,lng)=>[(lng-c[0])*rad*scale+180,(Math.log(Math.tan(Math.PI/4+c[1]*rad/2))-Math.log(Math.tan(Math.PI/4+lat*rad/2)))*scale+80];
const format=([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`;
let streets='',avenues='';const seen=new Set();
for(const [a,b,n] of net.edges){const key=[Math.min(a,b),Math.max(a,b)].join(':');if(seen.has(key))continue;seen.add(key);
 const p=project(...net.nodes[a]),q=project(...net.nodes[b]);if(![p,q].some(([x,y])=>x>-30&&x<390&&y>-30&&y<190))continue;
 const segment=`M${format(p)}L${format(q)}`;streets+=segment;if(/Avenida México|Insurgentes|Boulevard/.test(net.names[n]))avenues+=segment;
}
const routePaths=routes.filter(r=>['m-xico','r-rio-suchiate'].includes(r.id)).map(r=>`<path d="${r.coordinates.map((p,i)=>`${i?'L':'M'}${format(project(p.lat,p.lng))}`).join('')}" stroke="${r.color}" stroke-width="4"/>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 160"><title>Calles de Tepic y trazos de México y Río Suchiate</title><desc>Vista ilustrativa sin ubicación personal. Calles © OpenStreetMap contributors, ODbL 1.0.</desc><style>svg{background:#e9ece5}.edge{stroke:#d4dcd4}.street{stroke:#fff}.avenue{stroke:#fffdf3}@media(prefers-color-scheme:dark){svg{background:#14232c}.edge{stroke:#1e323d}.street{stroke:#344954}.avenue{stroke:#4c626b}}</style><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path class="edge" stroke-width="4.5" d="${streets}"/><path class="street" stroke-width="3" d="${streets}"/><path class="avenue" stroke-width="5" d="${avenues}"/>${routePaths}</g></svg>`;
mkdirSync(new URL('public/media/',base),{recursive:true});const out=new URL('public/media/tepic-preview.svg',base);writeFileSync(out,svg);console.log(`${fileURLToPath(out)} (${Buffer.byteLength(svg)} bytes)`);
