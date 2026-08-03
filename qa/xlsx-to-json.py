"""
Dumps every sheet of every .xlsx under <dir> to one JSON file of raw cell rows.

    python qa/xlsx-to-json.py "<dir>" out.json

Kept separate from the importer so no Excel-parsing dependency has to be added
to the app. Dates are emitted as ISO strings; everything else as text.
"""
import sys, os, json, datetime
import openpyxl


def cell(v):
    if v is None:
        return ""
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def main(src, dest):
    files = []
    for root, _dirs, names in os.walk(src):
        for n in sorted(names):
            if n.endswith(".xlsx") and not n.startswith("~$"):
                files.append(os.path.join(root, n))

    out = []
    for f in files:
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        ws = wb.worksheets[0]
        rows = [[cell(c) for c in r] for r in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(x for x in r)]
        out.append({"file": os.path.basename(f), "rows": rows})
        print(f"{os.path.basename(f)}: {len(rows)} non-empty rows")
        wb.close()

    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False)
    print(f"wrote {dest}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
