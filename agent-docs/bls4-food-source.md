# BLS 4.0 food source

BLS 4.0 is a public reference-food catalogue, not a user diary store or a
branded-product/barcode database. X on Track imports the official German
workbook into a read-only PostgreSQL catalogue, then exposes it through the
existing authenticated food-provider search/detail API. No request to the BLS
website is made when a user searches or logs food. Logged entries keep their
existing nutrient snapshots and BLS code as provenance.

The import is pinned to the official `BLS_4_0_2025_DE.zip` release and its
SHA-256 digest `12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91`.
The importer validates the workbook layout, 7,140 unique food codes, and
every numeric cell before replacing catalogue rows in one database
transaction. It preserves blank nutrient values as absent, qualified source
values such as `TR` and `<LOD` in a separate map, and measured or logical
zeroes as numeric zero. Search excludes the 50 foods whose energy or a core
macro is not numeric rather than inventing zeroes. Nutrients remain on the official **per 100 g
edible portion** basis. BLS beverage codes do not imply a density conversion;
the default X on Track serving is 100 g, including for beverages.

The reference catalogue is readable by authenticated app users and writable
only through the privileged import process. A provider-type migration makes it
selectable in the existing web/mobile provider settings and food search. The
server adapter maps BLS codes and supported nutrients to X on Track's food
response shape; missing nutrient fields are omitted. Additional BLS component
values, origin categories, and references are retained in the catalogue for
future mapping. Vitamin A is currently omitted from the normalized serving
pending review of the BLS 4.0 published errata.

To load a new installation after applying database migrations, download the
official ZIP from `https://www.blsdb.de/download` outside the repository.
Run:

```bash
python3 XoTServer/scripts/import_bls4.py /path/to/BLS_4_0_2025_DE.zip --check
python3 XoTServer/scripts/import_bls4.py /path/to/BLS_4_0_2025_DE.zip --apply
```

The apply command needs `psql` and standard libpq `PGHOST`, `PGPORT`,
`PGDATABASE`, `PGUSER`, and `PGPASSWORD` (or a protected `.pgpass`) set for
the database owner role. Never pass a password as a command argument or
commit the archive. Verify `SELECT count(*) FROM public.bls4_foods` returns
`7140` before exposing the provider. Reapplying the same pinned archive is
safe; the catalogue replacement commits atomically. Historical logged foods
remain their own snapshots and are not rewritten by a catalogue refresh.

OpenNutriTracker was consulted read-only: it uses an ingested multi-source
Supabase catalogue, tracks `source=bls` and a BLS source code, and stores
nutrients per 100 g. Its BLS N/P beverage shortcut defaults to millilitres;
X on Track intentionally does not use that shortcut because the official
workbook has a mass basis and gives no density for that conversion. No Dart,
Hive, Flutter, or OpenNutriTracker backend code is copied here.

Source and attribution: Max Rubner-Institut (2025), _Bundeslebensmittelschlüssel
(BLS), Version 4.0 — Deutsche Nährstoffdatenbank_, Karlsruhe,
DOI `10.25826/Data20251217-134202-0`, CC BY 4.0.
https://www.blsdb.de/download

## Display-only artwork

`shared/src/foodImages/foodArtwork.ts` resolves known BLS source identities through
the versioned `blsArtworkManifest.json`, independently of display language. BLS
4.0 codes can be alphanumeric; preserve them unchanged. The manifest covers all
7,140 pinned records, including the 50 that remain nutrient-ineligible. It never
changes the catalogue or food/diary photo snapshots. Real photos take precedence;
illustrations are not photo-viewer items.

Run `pnpm exec tsx scripts/audit_bls_artwork.ts --archive /path/to/BLS_4_0_2025_DE.zip`
from `XoTServer/` to validate the source hash, coverage, rule agreement and both
platform asset inventories. `--write` updates only the derived manifest. Reports
with public source names remain in ignored `.visual-sample/bls-artwork/`. See
`docs/src/developer/food-provider-images.md` for image precedence and offline
limitations, and `x-on-track-design/food-artwork/` for asset specifications/hashes.
