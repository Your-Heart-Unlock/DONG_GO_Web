// Local corpus evidence only; numeric IDs are opaque, never interpreted as names.
const fs = require('node:fs');
require('./register-local-ts.cjs');
const { classifyFoodKeywords } = require('../lib/admin/categoryKeywords.ts');
const folders = { '고기집':'Meat', '해산물':'Sea', '한식':'Korea', '일식':'Japan', '오마카세':'Japan', '중식':'China', '양식':'West', '해외음식':'Asian', '분식':'Snack', '베이커리':'Cafe', '카페':'Cafe', '술집':'Beer' };
const paths = new Map();
for (const [folder, folderKey] of [...Object.entries(folders), ['피햄치', null]]) {
  const rows = JSON.parse(fs.readFileSync(`initial_data/${folder}.json`, 'utf8')).bookmarkList;
  for (const row of rows) {
    // The mixed pizza/burger/chicken folder cannot have one category. Only use
    // explicit dish words from individual entries; opaque brand names add no vote.
    const keyword = folderKey ? undefined : classifyFoodKeywords(row.name);
    const key = folderKey || (['West', 'Snack'].includes(keyword?.key) ? keyword.key : null);
    if (!key) continue;
    const path = (Array.isArray(row.cidPath) ? row.cidPath : String(row.cidPath || '').split(',')).map(String);
    for (let n = 2; n <= path.length; n++) {
      const prefix = path.slice(0, n).join('/');
      if (!paths.has(prefix)) paths.set(prefix, { votes: {}, files: new Set() });
      const entry = paths.get(prefix);
      if (!entry.votes[key]) entry.votes[key] = new Set();
      entry.votes[key].add(row.sid);
      entry.files.add(`${folder}.json`);
    }
  }
}
const evidence = {};
for (const [path, entry] of [...paths].sort()) {
  const counts = Object.fromEntries(Object.entries(entry.votes).map(([key, ids]) => [key, ids.size]));
  const keys = Object.keys(counts);
  const ids = new Set(Object.values(entry.votes).flatMap(s => [...s]));
  if (ids.size < 2) continue;
  const adjusted = { ...counts };
  // Korean is an umbrella folder, so it must not outvote a supported ingredient
  // specialization. Retain other cuisine votes as genuine competing evidence.
  if (counts.Meat >= 3 || counts.Sea >= 3) delete adjusted.Korea;
  const ranked = Object.entries(adjusted).sort((a,b) => b[1] - a[1]);
  const [winner, support] = ranked[0] || [null, 0];
  const total = Object.values(adjusted).reduce((a,b) => a+b, 0);
  const share = total ? support / total : 0;
  const depth = path.split('/').length;
  const key = depth >= 3 && ((keys.length === 1 && support >= 2) || (support >= 3 && share >= 0.8)) ? winner : null;
  // Broad cuisine fallback is evaluated only AFTER all specific paths/keywords.
  const cuisines = Object.entries(counts).filter(([k]) => ['Korea','China','Japan','West','Asian'].includes(k)).sort((a,b) => b[1] - a[1]);
  const cuisineTotal = cuisines.reduce((n, [,v]) => n+v, 0);
  const fallbackKey = depth === 2 && cuisines[0]?.[1] >= 5 && cuisines[0][1] / cuisineTotal >= 0.8 ? cuisines[0][0] : null;
  evidence[path] = { key, fallbackKey, counts, share: Number(share.toFixed(4)), decision: key ? 'unanimous-or-80-percent; Korean umbrella excluded when Meat/Sea supported' : 'insufficient-or-conflicting', files: [...entry.files].sort() };
}
fs.writeFileSync('lib/admin/categoryEvidence.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(`Generated ${Object.keys(evidence).length} supported or conflicting paths.`);
