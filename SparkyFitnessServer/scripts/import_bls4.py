#!/usr/bin/env python3
"""Validate and transactionally import the pinned official BLS 4.0 workbook.

Download BLS_4_0_2025_DE.zip from https://www.blsdb.de/download.
Run --check first, then --apply with libpq PG* environment variables set.
The archive is source data and is intentionally not committed to this repo.
"""

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

EXPECTED_SHA256 = "12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91"
EXPECTED_ROWS = 7140
CORE = ("ENERCC", "PROT625", "CHO", "FAT")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
VALUE = f"{NS}v"
INLINE = f"{NS}is"
TEXT = f"{NS}t"


def cell_column(reference: str) -> int:
    result = 0
    for letter in re.match(r"[A-Z]+", reference).group():
        result = result * 26 + ord(letter) - ord("A") + 1
    return result - 1


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.itertext()) for node in root]


def row_values(row: ET.Element, strings: list[str]) -> dict[int, str]:
    values = {}
    for cell in row:
        index = cell_column(cell.attrib["r"])
        value = cell.find(VALUE)
        if value is not None and value.text is not None:
            raw = value.text
            values[index] = strings[int(raw)] if cell.get("t") == "s" else raw
        elif cell.get("t") == "inlineStr":
            inline = cell.find(INLINE)
            values[index] = "" if inline is None else "".join(inline.itertext())
    return values


def workbook_rows(archive: zipfile.ZipFile):
    workbook_name = next(
        (name for name in archive.namelist() if name.endswith("BLS_4_0_Daten_2025_DE.xlsx")),
        None,
    )
    if workbook_name is None:
        raise ValueError("The expected BLS 4.0 data workbook is absent")
    with zipfile.ZipFile(io.BytesIO(archive.read(workbook_name))) as workbook:
        strings = shared_strings(workbook)
        with workbook.open("xl/worksheets/sheet1.xml") as sheet:
            for _, element in ET.iterparse(sheet, events=("end",)):
                if element.tag == f"{NS}row":
                    yield row_values(element, strings)
                    element.clear()


def parse_archive(path: Path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError(f"BLS archive SHA-256 mismatch: {digest}")
    with zipfile.ZipFile(path) as archive:
        rows = workbook_rows(archive)
        header = next(rows)
        if header.get(0) != "BLS Code" or header.get(1) != "Lebensmittelbezeichnung":
            raise ValueError("Unexpected BLS workbook header")
        components = {}
        for offset in range(3, 417, 3):
            label = header.get(offset, "")
            if not re.match(r"^\S+ .*\[[^]]+/100g\]$", label):
                raise ValueError(f"Unexpected nutrient header at column {offset + 1}: {label}")
            code = label.split(" ", 1)[0]
            if code in components:
                raise ValueError(f"Duplicate component code {code}")
            components[code] = offset
        if len(components) != 138 or not set(CORE).issubset(components):
            raise ValueError("BLS nutrient columns changed")
        seen = set()
        parsed = []
        complete = 0
        for row in rows:
            code = row.get(0, "").strip()
            if not code or code in seen:
                raise ValueError(f"Blank or duplicate BLS food code: {code!r}")
            seen.add(code)
            name_de = row.get(1, "").strip()
            name_en = row.get(2, "").strip()
            if not name_de or not name_en:
                raise ValueError(f"Missing food name for {code}")
            nutrients, qualifiers, origins, references = {}, {}, {}, {}
            for nutrient_code, offset in components.items():
                raw = row.get(offset, "").strip()
                if raw and raw != "-":
                    try:
                        number = float(raw)
                    except ValueError:
                        if raw not in {"TR", "<LOD", "<LOQ", "<LOD or <LOQ"}:
                            raise ValueError(f"Unexpected {nutrient_code} value for {code}: {raw}")
                        qualifiers[nutrient_code] = raw
                    else:
                        if not 0 <= number < float("inf"):
                            raise ValueError(f"Invalid {nutrient_code} number for {code}")
                        nutrients[nutrient_code] = number
                origin = row.get(offset + 1, "").strip()
                reference = row.get(offset + 2, "").strip()
                if origin and origin != "-":
                    origins[nutrient_code] = origin
                if reference and reference != "-":
                    references[nutrient_code] = reference
            if all(nutrient in nutrients for nutrient in CORE):
                complete += 1
            parsed.append((code, name_de, name_en, nutrients, qualifiers, origins, references, digest))
        if len(parsed) != EXPECTED_ROWS:
            raise ValueError(f"Expected {EXPECTED_ROWS} BLS foods, found {len(parsed)}")
        return parsed, complete


def apply(rows):
    # psql reads credentials only from libpq environment / .pgpass. No secret
    # is placed on its command line or echoed by this importer.
    process = subprocess.Popen(
        ["psql", "-X", "--no-psqlrc", "-q", "-v", "ON_ERROR_STOP=1"],
        stdin=subprocess.PIPE,
        text=True,
    )
    assert process.stdin is not None
    try:
        process.stdin.write(
            "BEGIN;\n"
            "CREATE TEMP TABLE bls4_stage (LIKE public.bls4_foods INCLUDING DEFAULTS) ON COMMIT DROP;\n"
            "COPY bls4_stage (code,name_de,name_en,nutrients,qualifiers,origins,nutrient_references,dataset_sha256) "
            "FROM STDIN WITH (FORMAT csv);\n"
        )
        writer = csv.writer(process.stdin, lineterminator="\n")
        for row in rows:
            writer.writerow(
                [json.dumps(value, ensure_ascii=False) if isinstance(value, dict) else value for value in row]
            )
        process.stdin.write(
            "\\.\n"
            "DO $$ BEGIN IF (SELECT count(*) FROM bls4_stage) <> 7140 "
            "THEN RAISE EXCEPTION 'BLS staging row count mismatch'; END IF; END $$;\n"
            "DELETE FROM public.bls4_foods;\n"
            "INSERT INTO public.bls4_foods "
            "(code,name_de,name_en,nutrients,qualifiers,origins,nutrient_references,dataset_sha256) "
            "SELECT code,name_de,name_en,nutrients,qualifiers,origins,nutrient_references,dataset_sha256 FROM bls4_stage;\n"
            "COMMIT;\n"
        )
        process.stdin.close()
        if process.wait() != 0:
            raise RuntimeError("BLS import failed; transaction rolled back")
    except BaseException:
        process.kill()
        process.wait()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    rows, complete = parse_archive(args.archive)
    print(f"Validated {len(rows)} BLS 4.0 foods; {complete} have numeric energy and all three macros.")
    if args.apply:
        apply(rows)
        print("BLS 4.0 catalogue imported atomically.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as error:
        print(f"BLS import failed: {error}", file=sys.stderr)
        raise SystemExit(1)
