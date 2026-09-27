# 使用ライブラリ・フォント・データの権利表記

公開サイトの [ライセンス・クレジット](https://celestial.shirosaki.net/credits.html) に、著作権表示とライセンス全文を掲載しています。ビルド時にインストール済みパッケージと同梱フォントの原文から生成します。アプリケーションのMITライセンスとは別に、各構成要素の利用条件が適用されます。

## ライブラリ

各ライブラリの著作権表示とライセンス全文は、同梱パッケージの原文を参照してください。

| ライブラリ | バージョン | ライセンス |
| --- | --- | --- |
| react | 19.2.8 | MIT |
| react-dom | 19.2.8 | MIT |
| react-server-dom-webpack | 19.2.8 | MIT |
| three | 0.185.0 | MIT |
| astronomy-engine | 2.1.19 | MIT |
| @base-ui/react | 1.7.0 | MIT |
| @base-ui/utils | 0.3.2 | MIT |
| @babel/runtime | 7.29.7 | MIT |
| lucide-react | 1.31.0 | ISC |
| clsx | 2.1.1 | MIT |
| tailwind-merge | 3.6.0 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| @floating-ui/dom | 1.8.0 | MIT |
| @floating-ui/core | 1.8.0 | MIT |
| @floating-ui/utils | 0.2.12 | MIT |
| @floating-ui/react-dom | 2.1.9 | MIT |
| use-sync-external-store | 1.7.0 | MIT |

Astronomy Engineのnpmパッケージでは、ライセンス全文をソースコードの先頭に収録しています。クレジットページには、その原文も掲載します。

## フォント

| フォント | ライセンス | 原文の参照先 |
| --- | --- | --- |
| BIZ UDPGothic | SIL Open Font License 1.1 | [ライセンス原文](public/fonts/OFL.txt) |
| Source Code Pro | SIL Open Font License 1.1 | [ライセンス原文](public/fonts/SourceCodePro-OFL.txt) |
| Noto Sans Symbols | SIL Open Font License 1.1 | [ライセンス原文](public/fonts/ZodiacSymbols-OFL.txt) |

Noto Sans Symbolsは12星座記号のサブセットとして使用します。フォントは同じサイトから配信し、閲覧時に外部フォントサービスへ接続しません。

## 天体・地理データ

| データ | 用途・加工内容 | 出典と利用条件 |
| --- | --- | --- |
| GeoNames cities15000 | 地名・別名・座標・タイムゾーン・地域・人口を抽出し、人口順に並べ替え | [GeoNames](https://www.geonames.org/)、[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)、[加工と取得の記録](public/data/NOTICE.txt) |
| Natural Earth | 1:110m陸地ポリゴンを256 × 128の陸地マスクに変換 | [Natural Earth](https://www.naturalearthdata.com/)、Public domain |
| NASA/JPL Horizons | 追加8天体の地心ベクトルを8日間隔で取得し、Float32形式で保存 | [Horizons](https://ssd.jpl.nasa.gov/horizons/)、[取得メタデータ](public/ephemeris/manifest.json) |
| Hipparcos / ESA / CDS | I/239/hip_mainから22星のICRS座標と固有運動を抽出 | ESA (1997), The Hipparcos and Tycho Catalogues, ESA SP-1200、[VizieR I/239](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239)、DOI: 10.26093/cds/vizier |

地球以外の惑星表面と雲模様は手続き的に生成したイラストです。観測画像は使用していません。
