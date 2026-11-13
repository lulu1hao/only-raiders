"""
buildWeaponVisualAssets.py

Builds weapon recognition assets for the Raider loadout recognizer from raw game exports.

Input  (exported with the local CUE4Parse extractor from the installed game paks):
  F:/arc-export/weapon-visuals/PioneerGame/Content/Pioneer/...   (T_UI_Icon_* / T_UI_Ammo_* / T_UI_Icon_Upgrade_* PNGs)
  F:/arc-export/weapon-visuals/dumps/*.txt                       (property dumps of DA_UIMetaData_* / DA_Upgrade_*)

Output:
  public/weapons/small/<id>.png              base weapon small icon (stash tile capture framing), 192x192
  public/weapons/ascended/<id>.png           amplified ("增强型") weapon big icon (loadout slot framing), 384x192
  public/weapons/ascended/small/<id>.png     amplified weapon small icon, 192x192
  public/weapons/ammo/<Type>.png             bottom-bar ammo category icons, 64x64
  public/weapons/amps/<Name>.png             amplification upgrade icons, 64x64
  src/data/weaponVisuals.json                mapping consumed by src/utils/raiderLoadoutRecognizer.js

Note: since the 2026-11 game update the in-game weapon thumbnails are rendered live by
BP_WeaponIconCapture (3D model + attached mods, per-item ItemCaptureCamera/ActorTransform),
so no per-mod thumbnail textures exist in the paks. The static icons below are used only as a
tie-breaker; identity is primarily derived from mod-invariant UI cues.
"""

import glob
import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"F:/arc-export/weapon-visuals"
TEX = os.path.join(SRC, "PioneerGame", "Content", "Pioneer")
DUMPS = os.path.join(SRC, "dumps")
PUB = os.path.join(ROOT, "public", "weapons")
OUT_JSON = os.path.join(ROOT, "src", "data", "weaponVisuals.json")
WEAPONS_JSON = os.path.join(ROOT, "src", "data", "weaponsData.json")

# Game asset folder -> app weapon id (verified against DA_UIMetaData ItemName / localization)
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

AMMO_FILES = {
    "Light Ammo": "T_UI_Ammo_Light",
    "Medium Ammo": "T_UI_Ammo_Medium",
    "Heavy Ammo": "T_UI_Ammo_Heavy",
    "Shotgun Ammo": "T_UI_Ammo_Shotgun",
    "Energy Clip": "T_UI_Ammo_Energy",
    "Launcher Ammo": "T_UI_Ammo_Launcher",
}

QUALITY_TO_RARITY = {1: "Common", 2: "Uncommon", 3: "Rare", 4: "Epic", 5: "Legendary"}


def norm_name(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def read_props(path):
    props = {}
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            m = re.match(r"\s{3}(\w+) = (.*)$", line.rstrip("\r\n"))
            if m and m.group(1) not in props:
                props[m.group(1)] = m.group(2)
    return props


def asset_basename(ref):
    # "/Game/Pioneer/.../T_UI_Icon_X.T_UI_Icon_X" -> "T_UI_Icon_X"
    return (ref or "").split("/")[-1].split(".")[0]


def find_icon(folder_dir, candidates):
    for pattern in candidates:
        hits = sorted(glob.glob(os.path.join(folder_dir, pattern)))
        if hits:
            return hits[0]
    return None


def save_fit(src_path, out_path, size):
    im = Image.open(src_path).convert("RGBA")
    tw, th = size
    # Preserve the UMG ScaleBox framing: scale uniformly to fit, then center on a transparent canvas
    s = min(tw / im.width, th / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((tw - nw) // 2, (th - nh) // 2))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path, optimize=True)


def main():
    weapons = json.load(open(WEAPONS_JSON, encoding="utf-8"))["weapons"]
    weapon_by_id = {w["id"]: w for w in weapons}

    out = {
        "source": "ARC Raiders paks (2026-11-06) via CUE4Parse extractor; see tools/buildWeaponVisualAssets.py",
        "ammoIcons": {},
        "ampIcons": {},
        "weapons": {},
    }

    # 1. Ammo category icons (bottom-bar TypeIcon / stash tile TinyIcon)
    for ammo, fname in AMMO_FILES.items():
        src = os.path.join(TEX, "UI", "Assets", "ItemCategories", fname + ".png")
        rel = f"weapons/ammo/{fname.replace('T_UI_Ammo_', '')}.png"
        save_fit(src, os.path.join(ROOT, "public", rel), (64, 64))
        out["ammoIcons"][ammo] = rel

    # 2. Amplification upgrade icons
    for src in sorted(glob.glob(os.path.join(TEX, "UI", "Assets", "Icons", "Ascended_upgrades", "*.png"))):
        name = os.path.splitext(os.path.basename(src))[0]
        rel = f"weapons/amps/{name.replace('T_UI_Icon_Upgrade_', '')}.png"
        save_fit(src, os.path.join(ROOT, "public", rel), (64, 64))
        out["ampIcons"][name] = rel

    # 3. Upgrade data assets: folder-prefix -> list of upgrades
    upgrades_by_folder = {}
    for path in sorted(glob.glob(os.path.join(DUMPS, "DA_Upgrade_*.txt"))):
        tag = os.path.basename(path)[len("DA_Upgrade_"):-4]
        props = read_props(path)
        removes = [int(x) for x in re.findall(r"Type=EModSlotUpgradeModificationType::Remove, position=(\d+)", props.get("ModSlotModifications", ""))]
        upgrades_by_folder.setdefault(tag, []).append({
            "displayName": props.get("DisplayName", ""),
            "icon": asset_basename(props.get("Icon")),
            "isAscensionNode": props.get("bIsAscensionNode", "False") == "True",
            "removesSlotPositions": removes,
        })

    # 4. Ascended UI metadata (rarity of amplified variants)
    asc_quality = {}
    for path in sorted(glob.glob(os.path.join(DUMPS, "DA_UIMetaData_*_Ascended.txt"))):
        tag = os.path.basename(path)[len("DA_UIMetaData_"):-len("_Ascended.txt")]
        q = read_props(path).get("QualityLevel")
        if q and q.isdigit():
            asc_quality[tag] = int(q)

    missing = []
    for folder, wid in FOLDER_TO_ID.items():
        w = weapon_by_id.get(wid)
        if not w:
            continue
        short = folder.split("/")[-1]
        fdir = os.path.join(TEX, "Items", *folder.split("/"))
        entry = {"folder": short, "ammo": w.get("ammo")}

        small = find_icon(fdir, [f"T_UI_Icon_{short}_T0.png", f"T_UI_Icon_{short}_SmallIcon_T0.png", f"T_UI_Icon_{short}_A_T0.png", f"T_UI_Icon_{short}_T*.png"])
        if small:
            rel = f"weapons/small/{wid}.png"
            save_fit(small, os.path.join(ROOT, "public", rel), (192, 192))
            entry["imageSmall"] = rel
        else:
            missing.append(f"{wid}: small icon")

        adir = os.path.join(fdir, "Ascended")
        if os.path.isdir(adir):
            a_big = find_icon(adir, [f"T_UI_Icon_{short}_Ascended_Big*_T0.png", f"T_UI_Icon_{short}_Ascended_Big*_T*.png"])
            a_small = find_icon(adir, [f"T_UI_Icon_{short}_Ascended_T0.png", f"T_UI_Icon_{short}_Ascended_SmallIcon_T0.png", f"T_UI_Icon_{short}_Ascended_A_T0.png", f"T_UI_Icon_{short}_Ascended_T*.png"])
            asc = {"rarity": QUALITY_TO_RARITY.get(asc_quality.get(short, 5), "Legendary")}
            if a_big:
                rel = f"weapons/ascended/{wid}.png"
                save_fit(a_big, os.path.join(ROOT, "public", rel), (384, 192))
                asc["image"] = rel
            if a_small:
                rel = f"weapons/ascended/small/{wid}.png"
                save_fit(a_small, os.path.join(ROOT, "public", rel), (192, 192))
                asc["imageSmall"] = rel
            if not a_big or not a_small:
                missing.append(f"{wid}: ascended big={bool(a_big)} small={bool(a_small)}")

            # Map game upgrades onto the app's amplification ids by display name
            app_amps = {norm_name(a.get("name")): a["id"] for a in (w.get("amplifications") or [])}
            amps = {}
            ascension_icon = None
            for up in upgrades_by_folder.get(short, []) + [u for k, v in upgrades_by_folder.items() if k.startswith(short + "_") for u in v]:
                if up["isAscensionNode"]:
                    ascension_icon = up["icon"]
                    continue
                aid = app_amps.get(norm_name(up["displayName"]))
                if not aid:
                    missing.append(f"{wid}: unmapped upgrade '{up['displayName']}'")
                    continue
                amps[aid] = {"icon": up["icon"], "removesSlotPositions": up["removesSlotPositions"]}
            asc["ascensionIcon"] = ascension_icon or "T_UI_Icon_Upgrade_Amplified"
            asc["amps"] = amps
            entry["ascended"] = asc

        out["weapons"][wid] = entry

    # De-duplicate upgrade collection (folder prefix scan may double count)
    for entry in out["weapons"].values():
        asc = entry.get("ascended")
        if asc:
            asc["amps"] = dict(sorted(asc["amps"].items()))

    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)

    print(f"weapons: {len(out['weapons'])}  ammo: {len(out['ammoIcons'])}  ampIcons: {len(out['ampIcons'])}")
    print("ascended:", sorted(k for k, v in out["weapons"].items() if v.get("ascended")))
    if missing:
        print("WARN:")
        for m in sorted(set(missing)):
            print("  ", m)


if __name__ == "__main__":
    main()
