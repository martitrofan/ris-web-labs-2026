# -*- coding: utf-8 -*-
"""Build docs/students.json from final_12.11.json (+ missing roster names)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKDIR = Path(r"C:\Users\m.shakirov\source\repos\kgeu-lab-review-2026-10-19")
SRC = WORKDIR / "final_12.11.json"
OUT = ROOT / "students.json"

LABS = [f"lr{i}" for i in range(1, 11)]
MISSING = [
    {"fio": "Газизова Дилара Гаязовна", "group": "ТРИС-1-23"},
    {"fio": "Емельянов Максим Юрьевич", "group": "ТРИС-1-23"},
    {"fio": "Зайнуллин Ильназ Ильясович", "group": "ТРИС-1-23"},
    {"fio": "Илюшин Алексндр Романович", "group": "ТРИС-1-23"},
    {"fio": "Касимов Эрнест Рашидович", "group": "ТРИС-3-23"},
    {"fio": "Филимонова Вероника Сергеевна", "group": "ТРИС-3-23"},
]


def main() -> None:
    rows = json.loads(SRC.read_text(encoding="utf-8"))
    students = []
    seen = set()
    for r in rows:
        if (r.get("status") or {}).get("lr1") == "не актуален":
            continue
        fio = (r.get("fio") or "").strip()
        key = " ".join(fio.lower().split())
        if key in seen:
            continue
        seen.add(key)
        st = r.get("status") or {}
        students.append(
            {
                "fio": fio,
                "group": (r.get("group") or "").strip(),
                "url": r.get("url") or "",
                "labs": {lab: st.get(lab, "не сдано") for lab in LABS},
            }
        )
    for m in MISSING:
        key = " ".join(m["fio"].lower().split())
        if key in seen:
            continue
        seen.add(key)
        students.append(
            {
                "fio": m["fio"],
                "group": m["group"],
                "url": "",
                "labs": {lab: "недоступен" for lab in LABS},
            }
        )
    students.sort(key=lambda s: (s["group"], s["fio"].lower()))
    payload = {
        "reviewDate": "12.11.2026",
        "course": "РИС и Web · семестр 1 · 2026/2027",
        "labs": LABS,
        "labLabels": {f"lr{i}": f"ЛР{i}" for i in range(1, 11)},
        "students": students,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(students)} students)")


if __name__ == "__main__":
    main()
