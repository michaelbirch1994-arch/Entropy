import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const urls = new Set();
async function scan(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['__tests__'].includes(entry.name)) await scan(file); continue; }
    if (!/\.(tsx?|json)$/.test(file) || file.endsWith('communityImageManifest.json')) continue;
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/https:\/\/(?:wiki\.guildwars2\.com|i\.imgur\.com)\/[^\s"'`<>]+?\.(?:png|jpg|jpeg|webp)/gi)) urls.add(match[0]);
    for (const match of text.matchAll(/\$\{GW2_WIKI_FILE\}\/([^`]+\.png)/g)) urls.add(`https://wiki.guildwars2.com/wiki/Special:Redirect/file/${match[1]}`);
    for (const match of text.matchAll(/tomeSkill\(\d+, "([^"]+)"/g)) urls.add(`https://wiki.guildwars2.com/wiki/Special:Redirect/file/${match[1].replace(':','-').replaceAll(' ','_')}.png`);
  }
}
await scan(path.join(root,'src'));
urls.add('https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png');
urls.add('https://i.imgur.com/K7taOUe.png');
const out = path.join(root,'public/images/community');
await mkdir(out,{recursive:true});
const assets = {};
const failures = [];
let previous = {};
try { previous = JSON.parse(await readFile(path.join(root,'src/data/communityImageManifest.json'),'utf8')); } catch {}
for (const url of [...urls].sort()) {
  const name = decodeURIComponent(new URL(url).pathname.split('/').pop()).replaceAll(' ', '_');
  const key = createHash('sha256').update(url).digest('hex').slice(0,12);
  const relative = `/images/community/${key}-${name.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;
  if (previous[url] && !process.argv.includes('--refresh')) {
    try {
      const cached = await readFile(path.join(root,'public',previous[url]));
      if (cached.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { assets[url] = previous[url]; continue; }
    } catch {}
  }
  let bytes;
  const candidates = [url];
  if (url.includes('wiki.guildwars2.com')) {
    const alias = { 'Poison.png':'Poisoned.png', 'Blind.png':'Blinded.png', 'Immobilized.png':'Immobile.png' }[name];
    if (alias) candidates.push(`https://wiki.guildwars2.com/wiki/Special:Redirect/file/${alias}`);
    const md5 = createHash('md5').update(name).digest('hex');
    candidates.push(`https://wiki.guildwars2.com/images/${md5[0]}/${md5.slice(0,2)}/${encodeURIComponent(name)}`);
  }
  for (const candidate of candidates) {
    try {
      const buffer = execFileSync('curl.exe',['-sSL','--fail','--max-time','12',candidate],{maxBuffer:12*1024*1024,stdio:['ignore','pipe','pipe']});
      if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (buffer[0]===255 && buffer[1]===216) || buffer.subarray(8,12).toString()==='WEBP') { bytes=buffer; break; }
    } catch {}
  }
  if (!bytes) {
    failures.push(url);
    if (previous[url]) {
      try { await readFile(path.join(root,'public',previous[url])); assets[url] = previous[url]; } catch {}
    }
    continue;
  }
  await writeFile(path.join(root,'public',relative),bytes);
  assets[url]=relative;
  console.log(`Saved ${name} (${bytes.length} bytes)`);
}
await writeFile(path.join(root,'src/data/communityImageManifest.json'),JSON.stringify(assets,null,2)+'\n');
await writeFile(path.join(root,'docs/community-image-sync.json'),JSON.stringify({sources:assets,failures},null,2)+'\n');
console.log(JSON.stringify({saved:Object.keys(assets).length,failed:failures.length,failures}));
