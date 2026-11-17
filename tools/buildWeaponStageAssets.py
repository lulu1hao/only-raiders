"""
buildWeaponStageAssets.py

Builds HD stage renders (tiers I-IV + Ascended + Permutations) for the Weapons
workbench/compare view without touching raiderLoadoutRecognizer templates.

Input:
  F:/arc-export/weapon-visuals/PioneerGame/Content/Pioneer/Items/...
  src/data/weaponsData.json
  src/data/weaponVisuals.json

Output:
  public/weapons/hd/tiers/<wid>_t<tier>.png
  public/weapons/hd/ascended/<wid>.png
  public/weapons/hd/ascended/<wid>__<key>.png
  src/data/weaponStageVisuals.json
"""

import glob
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ITEMS = r"F:/arc-export/weapon-visuals/PioneerGame/Content/Pioneer/Items"
WEAPONS_JSON = os.path.join(ROOT, "src", "data", "weaponsData.json")
VISUALS_JSON = os.path.join(ROOT, "src", "data", "weaponVisuals.json")
HD_DIR = os.path.join(ROOT, "public", "weapons", "hd")
OUT_JSON = os.path.join(ROOT, "src", "data", "weaponStageVisuals.json")

STAGE_W = 768
STAGE_H = 384

FOLDER_TO_ID = {
    "Firearms/AssaultRifle_Bullpup_01": "tempest",
    "Firearms/AssaultRifle_Burst_01": "arpeggio",
    "Firearms/AssaultRifle_Heavy_01": "bettina",
    "Firearms/AssaultRifle_LowTier_01": "rattler",
    "Firearms/AssaultRifle_Pneumatic_01": "kettle",
    "Firearms/BattleRifle_BreachAction_01": "ferro",
    "Firearms/BattleRifle_EnergyBurst_01": "aphelion",
    "Firearms/BattleRifle_LeverAction_01": "renegade",
    "Firearms/BattleRifle_SemiAuto_Light_01": "stiletto",
    "Firearms/HandCannon_DoubleAction_Snubnose_01": "bantam",
    "Firearms/HandCannon_SingleAction_01": "anvil",
    "Firearms/LMG_Medium_01": "torrente",
    "Firearms/Pistol_01": "burletta",
    "Firearms/Pistol_HighPower_01": "venator",
    "Firearms/Pistol_Silenced_01": "hairpin",
    "Firearms/SMG_01": "bobcat",
    "Firearms/SMG_LowTier_01": "stitcher",
    "Firearms/SMG_Medium_01": "canto",
    "Firearms/Shotgun_Energy_Adjustable_01": "dolabra",
    "Firearms/Shotgun_PumpAction_01": "il_toro",
    "Firearms/Shotgun_SemiAuto_01": "vulcano",
    "Firearms/SniperRifle_BoltAction_Medium_01": "osprey",
    "Firearms/Special_BeamRifle_01": "equalizer",
    "Firearms/Special_Railgun_01": "jupiter",
    "Launchers/Launcher_AntiArc_SingleShot_01": "rascal",
    "Launchers/Launcher_AntiArc_Medium_01": "hullcracker",
}
ID_TO_FOLDER = {v: k for k, v in FOLDER_TO_ID.items()}


def save_fit(src_path, out_path, size=(STAGE_W, STAGE_H)):
    im = Image.open(src_path).convert("RGBA")
    tw, th = size
    s = min(tw / im.width, th / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((tw - nw) // 2, (th - nh) // 2))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path, optimize=True)


def find_first(patterns):
    for pat in patterns:
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[0]
    return None


def main():
    with open(WEAPONS_JSON, encoding="utf-8") as fh:
        weapons_data = json.load(fh)
    with open(VISUALS_JSON, encoding="utf-8") as fh:
        visuals_data = json.load(fh)

    os.makedirs(os.path.join(HD_DIR, "tiers"), exist_ok=True)
    os.makedirs(os.path.join(HD_DIR, "ascended"), exist_ok=True)

    weapons_out = {}
    for w in weapons_data.get("weapons", []):
        wid = w["id"]
        folder = ID_TO_FOLDER[wid]
        short = folder.split("/")[-1]
        fdir = os.path.join(SRC_ITEMS, *folder.split("/"))

        tiers = [t["tier"] for t in (w.get("tiers") or [{"tier": 1}])]
        tier_images = {}
        for tnum in tiers:
            if len(tiers) == 1:
                src = find_first([
                    os.path.join(fdir, f"T_UI_Icon_{short}_Big*_T3.png"),
                    os.path.join(fdir, f"T_UI_Icon_{short}_Big*_T0.png"),
                    os.path.join(fdir, f"T_UI_Icon_{short}_Big*_T*.png"),
                ])
            else:
                tex_idx = max(0, min(3, tnum - 1))
                src = find_first([
                    os.path.join(fdir, f"T_UI_Icon_{short}_Big*_T{tex_idx}.png"),
                    os.path.join(fdir, f"T_UI_Icon_{short}_Big*_T0.png"),
                ])
            if not src:
                raise FileNotFoundError(f"Missing BigIcon for {wid} tier {tnum} in {fdir}")
            rel = f"weapons/hd/tiers/{wid}_t{tnum}.png"
            save_fit(src, os.path.join(ROOT, "public", rel), (STAGE_W, STAGE_H))
            tier_images[str(tnum)] = rel

        asc_meta = visuals_data.get("weapons", {}).get(wid, {}).get("ascended")
        asc_image = None
        variant_images = {}
        if asc_meta:
            adir = os.path.join(fdir, "Ascended")
            a_src = find_first([
                os.path.join(adir, f"T_UI_Icon_{short}_Ascended_Big*_T0.png"),
                os.path.join(adir, f"T_UI_Icon_{short}_Ascended_Big*_T*.png"),
            ])
            if a_src:
                rel = f"weapons/hd/ascended/{wid}.png"
                save_fit(a_src, os.path.join(ROOT, "public", rel), (STAGE_W, STAGE_H))
                asc_image = rel

            for vis in asc_meta.get("visuals", []):
                vkey = vis["key"]
                small_rel = vis.get("image") or ""
                perm_dir = os.path.join(adir, "Permutations")
                token_stem = vkey.split("-")[0]
                p_src = find_first([
                    os.path.join(perm_dir, f"*{token_stem}*Big*.png"),
                    os.path.join(perm_dir, "*Big*.png"),
                ])
                if not p_src and os.path.exists(os.path.join(ROOT, "public", small_rel)):
                    p_src = os.path.join(ROOT, "public", small_rel)
                if p_src:
                    rel = f"weapons/hd/ascended/{wid}__{vkey}.png"
                    save_fit(p_src, os.path.join(ROOT, "public", rel), (STAGE_W, STAGE_H))
                    variant_images[vkey] = rel

        weapons_out[wid] = {
            "tierImages": tier_images,
            "ascendedImage": asc_image,
            "variantImages": variant_images,
        }

    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump({"weapons": weapons_out}, fh, ensure_ascii=False, indent=2)

    tier_cnt = sum(len(v["tierImages"]) for v in weapons_out.values())
    asc_cnt = sum(1 for v in weapons_out.values() if v["ascendedImage"])
    var_cnt = sum(len(v["variantImages"]) for v in weapons_out.values())
    print(f"Built {tier_cnt} tier HD renders, {asc_cnt} ascended HD renders, {var_cnt} permutation HD renders.")


if __name__ == "__main__":
    main()
