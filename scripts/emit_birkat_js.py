#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bundles plain-text nuschaot into a Metro-friendly JS module."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"


def slice_al_hamichya_only(mein_text: str, nusach_subtitle: str) -> str:
    """מקטע על המחיה ממעין שלוש — בלי יין ובלי פירות עץ."""
    b = mein_text.split("\n\n")
    return "\n\n".join(
        [f"על המחיה — {nusach_subtitle}", b[1], b[2], b[5], b[6], b[7]]
    )


def main() -> None:
    m = (DATA / "birkat_mizrach.txt").read_text(encoding="utf-8").strip()
    a = (DATA / "birkat_ashkenaz.txt").read_text(encoding="utf-8").strip()
    s = (DATA / "birkat_sefard.txt").read_text(encoding="utf-8").strip()
    out = DATA / "birkatHamazonTexts.js"
    out.write_text(
        "// Generated from birkat_* .txt via scripts/emit_birkat_js.py\n"
        f"export const TEXT_MIZRACH = {json.dumps(m, ensure_ascii=False)};\n\n"
        f"export const TEXT_ASHKENAZ = {json.dumps(a, ensure_ascii=False)};\n\n"
        f"export const TEXT_SEFARD = {json.dumps(s, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print("Wrote", out)

    mein_m = (DATA / "mein_shalosh_mizrach.txt").read_text(encoding="utf-8").strip()
    mein_a = (DATA / "mein_shalosh_ashkenaz.txt").read_text(encoding="utf-8").strip()
    mein_s = (DATA / "mein_shalosh_sefard.txt").read_text(encoding="utf-8").strip()
    al_m = slice_al_hamichya_only(mein_m, "נוסח עדות המזרח")
    al_a = slice_al_hamichya_only(mein_a, "נוסח אשכנז")
    al_s = slice_al_hamichya_only(mein_s, "נוסח ספרד")
    k_m = (DATA / "brachot_katzar_mizrach.txt").read_text(encoding="utf-8").strip()
    k_a = (DATA / "brachot_katzar_ashkenaz.txt").read_text(encoding="utf-8").strip()
    k_s = (DATA / "brachot_katzar_sefard.txt").read_text(encoding="utf-8").strip()
    out2 = DATA / "otherBrachotTexts.js"
    out2.write_text(
        "// Generated from mein_shalosh_* / brachot_katzar_* .txt via scripts/emit_birkat_js.py\n"
        f"export const TEXT_MEIN_SHALOSH_MIZRACH = {json.dumps(mein_m, ensure_ascii=False)};\n\n"
        f"export const TEXT_MEIN_SHALOSH_ASHKENAZ = {json.dumps(mein_a, ensure_ascii=False)};\n\n"
        f"export const TEXT_MEIN_SHALOSH_SEFARD = {json.dumps(mein_s, ensure_ascii=False)};\n\n"
        f"export const TEXT_AL_HAMICHYA_MIZRACH = {json.dumps(al_m, ensure_ascii=False)};\n\n"
        f"export const TEXT_AL_HAMICHYA_ASHKENAZ = {json.dumps(al_a, ensure_ascii=False)};\n\n"
        f"export const TEXT_AL_HAMICHYA_SEFARD = {json.dumps(al_s, ensure_ascii=False)};\n\n"
        f"export const TEXT_BRACHOT_KATZAR_MIZRACH = {json.dumps(k_m, ensure_ascii=False)};\n\n"
        f"export const TEXT_BRACHOT_KATZAR_ASHKENAZ = {json.dumps(k_a, ensure_ascii=False)};\n\n"
        f"export const TEXT_BRACHOT_KATZAR_SEFARD = {json.dumps(k_s, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print("Wrote", out2)


if __name__ == "__main__":
    main()
