import fs from 'node:fs';
const source = fs.readFileSync('outputs/geonames/cities15000.txt', 'utf8');
const cities = source
  .trim()
  .split('\n')
  .map((line) => {
    const c = line.split('\t');
    const ja = c[3].split(',').filter((n) => /[ぁ-んァ-ヶ一-龠]/.test(n));
    return {
      id: c[0],
      name: c[1],
      ascii: c[2],
      aliases: ja.slice(0, 8),
      country: c[8],
      region: c[10],
      lat: Number(c[4]),
      lon: Number(c[5]),
      zone: c[17],
      population: Number(c[14]),
    };
  })
  .filter((c) => c.zone && Number.isFinite(c.lat) && Math.abs(c.lat) <= 89)
  .sort((a, b) => b.population - a.population);
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/cities.json', JSON.stringify(cities));
console.log(
  cities.length,
  'cities',
  fs.statSync('public/data/cities.json').size,
  'bytes',
);
fs.writeFileSync(
  'public/data/NOTICE.txt',
  'City data: GeoNames cities15000, downloaded ' +
    new Date().toISOString() +
    '\nhttps://www.geonames.org/\nhttps://download.geonames.org/export/dump/cities15000.zip\nCreative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/\nAdapted by selecting city names, Japanese/CJK aliases, coordinates, timezone, region and population; sorted by population. Provided as is.\n',
);
