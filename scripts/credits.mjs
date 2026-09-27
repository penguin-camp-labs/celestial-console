import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const packages = [
  'react',
  'react-dom',
  'react-server-dom-webpack',
  'three',
  'astronomy-engine',
  '@base-ui/react',
  '@base-ui/utils',
  '@babel/runtime',
  'lucide-react',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  '@floating-ui/dom',
  '@floating-ui/core',
  '@floating-ui/utils',
  '@floating-ui/react-dom',
  'use-sync-external-store',
];

export async function collectCredits() {
  const libraries = [];
  for (const name of packages) {
    const path = join('node_modules', name);
    const files = await readdir(path);
    const file = files.find((f) => /^licen[cs]e(\.|$)/i.test(f));
    let text;
    if (file) {
      text = await readFile(join(path, file), 'utf8');
    } else if (name === 'astronomy-engine') {
      // The npm package embeds its full notice in the source header.
      const source = await readFile(join(path, 'astronomy.js'), 'utf8');
      text = source
        .match(/\/\*\*[\s\S]*?(MIT License[\s\S]*?)\*\//)?.[1]
        .replace(/^ {4}/gm, '')
        .trim();
    }
    if (!text) throw new Error(`Missing license for ${name}`);
    const metadata = JSON.parse(
      await readFile(join(path, 'package.json'), 'utf8'),
    );
    libraries.push({
      name,
      version: metadata.version,
      license: metadata.license ?? 'See license',
      text,
    });
  }
  const fonts = await Promise.all(
    [
      [
        'BIZ UDPGothic',
        'OFL.txt',
        '日本語の表示',
        'https://github.com/googlefonts/morisawa-biz-ud-gothic',
      ],
      [
        'Source Code Pro',
        'SourceCodePro-OFL.txt',
        '英数字の表示',
        'https://github.com/adobe-fonts/source-code-pro',
      ],
      [
        'Noto Sans Symbols',
        'ZodiacSymbols-OFL.txt',
        '12星座記号のサブセット',
        'https://fonts.google.com/noto/specimen/Noto+Sans+Symbols',
      ],
    ].map(async ([name, file, description, url]) => ({
      name,
      description,
      url,
      license: 'SIL Open Font License 1.1',
      text: await readFile(`public/fonts/${file}`, 'utf8'),
    })),
  );
  const data = [
    {
      name: 'GeoNames cities15000',
      license: 'CC BY 4.0',
      description:
        '都市検索用の地名・別名・緯度経度・タイムゾーン・地域・人口を抽出し、人口順に並べ替えています。',
      url: 'https://www.geonames.org/',
      links: [
        ['利用条件', 'https://creativecommons.org/licenses/by/4.0/'],
        [
          '元データ',
          'https://download.geonames.org/export/dump/cities15000.zip',
        ],
      ],
      text: await readFile('public/data/NOTICE.txt', 'utf8'),
    },
    {
      name: 'Natural Earth',
      license: 'Public domain',
      description:
        '1:110mの陸地ポリゴンを256 × 128の陸地マスクに加工し、地球表面の模式表示に使用しています。他の惑星表面と雲模様は手続き的なイラストです。',
      url: 'https://www.naturalearthdata.com/',
      links: [
        [
          '元データ',
          'https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson',
        ],
      ],
      text: 'https://www.naturalearthdata.com/\nPublic domain. 1:110m land polygons rasterized to a 256 x 128 land mask for the stylized Earth surface. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson\nOther planet surfaces and cloud patterns are procedural illustrations, not observation imagery.\n',
    },
    {
      name: 'NASA/JPL Horizons',
      license: '天体暦データ',
      description:
        '8日間隔の地心ICRFベクトル（LT+S、UT）をFloat32形式で保存しています。追加天体の位置は3次Hermite補間で求め、指定日時の黄道座標に変換します。',
      url: 'https://ssd.jpl.nasa.gov/horizons/',
      links: [['取得メタデータ', '/ephemeris/manifest.json']],
      text: 'https://ssd.jpl.nasa.gov/horizons/\nApparent geocentric ICRF vectors (LT+S, UT), sampled every 8 days, adapted to Float32 and cubic Hermite interpolation. Retrieval metadata: /ephemeris/manifest.json.\n',
    },
    {
      name: 'Hipparcos / ESA / CDS',
      license: '恒星カタログ I/239',
      description:
        'ESA (1997), The Hipparcos and Tycho Catalogues, ESA SP-1200。CDS/VizieRのI/239/hip_mainからV等級1.5以下の22星を抽出（分離表示できないケンタウルス座アルファ星B、HIP 71681は除外）。元期J1991.25のICRS座標と固有運動を表示用に加工しています。',
      url: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239',
      links: [['VizieR DOI', 'https://doi.org/10.26093/cds/vizier']],
      text: 'ESA 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200. Catalogue I/239/hip_main via CDS/VizieR (DOI: 10.26093/cds/vizier).\nhttps://cdsarc.cds.unistra.fr/viz-bin/cat/I/239\n22 entries with Vmag <= 1.5, excluding unresolved Alpha Centauri B (HIP 71681). ICRS coordinates at J1991.25 and proper motions, adapted for this display.\n',
    },
  ];
  return { license: await readFile('LICENSE', 'utf8'), libraries, fonts, data };
}

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
const fullText = (text, label = '権利表記の原文') =>
  `<details><summary>${label}</summary><pre lang="en">${escape(text)}</pre></details>`;
const card = (item) => `<article class="credit-card">
  <span class="badge">${escape(item.license)}</span>
  <h3><a href="${escape(item.url)}">${escape(item.name)}</a></h3>
  <p>${escape(item.description)}</p>
  ${item.links ? `<ul class="source-links">${item.links.map(([label, url]) => `<li><a href="${escape(url)}">${escape(label)} ↗</a></li>`).join('')}</ul>` : ''}
  ${fullText(item.text, item.links ? '出典・加工内容の原文' : 'ライセンス全文')}
</article>`;

export function renderCredits({ license, libraries, fonts, data }) {
  return `<!doctype html>
<html lang="ja"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#060c12">
  <meta name="description" content="CELESTIALの制作クレジット、MITライセンス、使用ライブラリ・フォント・データの権利表記。">
  <title>ライセンス・クレジット — CELESTIAL</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/credits.css">
</head><body>
  <a class="skip-link" href="#main">本文へ移動</a>
  <header class="site-header"><a class="brand" href="/">CELESTIAL<span>天球ホロスコープ</span></a><a class="back-link" href="/">観測画面へ戻る ↗</a></header>
  <main id="main">
    <div class="intro"><p class="eyebrow" lang="en">LICENSES &amp; CREDITS</p><h1>ライセンス・<br>クレジット</h1><p>CELESTIALの制作情報と、使用するライブラリ・フォント・データの<br>著作権表示、出典、利用条件を記載します。</p></div>
    <nav class="contents" aria-label="ページ内の目次"><a href="#notice">01 制作</a><a href="#license">02 ライセンス</a><a href="#data">03 データ</a><a href="#fonts">04 フォント</a><a href="#libraries">05 ライブラリ</a></nav>
    <section id="notice" aria-labelledby="notice-title"><p class="eyebrow">01 / NOTICE</p><h2 id="notice-title">制作クレジット</h2><div class="creator"><dl><div><dt>企画・制作</dt><dd>Setsuna SHIROSAKI</dd></div><div><dt>AI開発支援</dt><dd>GPT-6 Astra</dd></div></dl><p lang="en">Copyright (c) 2026 Setsuna SHIROSAKI<br>Created with assistance from GPT-6 Astra.</p></div></section>
    <section id="license" aria-labelledby="license-title"><p class="eyebrow">02 / LICENSE</p><h2 id="license-title">CELESTIALのライセンス</h2><p>アプリケーションのコードはMIT Licenseで公開しています。使用ライブラリ・フォント・データには、それぞれの利用条件が適用されます。</p><p><a href="https://github.com/penguin-camp-labs/celestial-console">GitHubでソースコードを見る</a></p><div class="license-body" lang="en">${license
      .trim()
      .split(/\r?\n\s*\r?\n/)
      .map((paragraph, i) =>
        i === 0
          ? `<h3>${escape(paragraph)}</h3>`
          : `<p>${escape(paragraph.replace(/\r?\n/g, ' '))}</p>`,
      )
      .join('\n')}</div></section>
    <section id="data" aria-labelledby="data-title"><p class="eyebrow">03 / DATA</p><h2 id="data-title">天体・地理データ</h2><div class="card-grid">${data.map(card).join('\n')}</div></section>
    <section id="fonts" aria-labelledby="fonts-title"><p class="eyebrow">04 / TYPOGRAPHY</p><h2 id="fonts-title">フォント</h2><p>フォントはサイトに同梱し、同一オリジンから配信しています。</p><div class="card-grid">${fonts.map(card).join('\n')}</div></section>
    <section id="libraries" aria-labelledby="libraries-title"><p class="eyebrow">05 / SOFTWARE</p><h2 id="libraries-title">使用ライブラリ</h2><p>各ライブラリの著作権表示とライセンス全文を、項目ごとに確認できます。</p><div class="library-list">${libraries.map((item) => `<article><div class="library-heading"><h3>${escape(item.name)} <span>${escape(item.version)}</span></h3><span class="badge">${escape(item.license)}</span></div>${fullText(item.text, '著作権表示・ライセンス全文')}</article>`).join('\n')}</div></section>
  </main>
  <footer><span>© 2026 Setsuna SHIROSAKI</span><a href="#main">ページの先頭へ ↑</a></footer>
</body></html>\n`;
}

export function renderTextNotices({ libraries, data, fonts }) {
  return (
    'CELESTIAL — Third-party notices\n' +
    [...libraries, ...data, ...fonts]
      .map((item) => `\n\n--- ${item.name} ---\n${item.text}`)
      .join('')
  );
}
