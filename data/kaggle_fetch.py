import os
from pathlib import Path
import zipfile
import pandas as pd

# Configure Kaggle credentials: place kaggle.json in %USERPROFILE%\.kaggle\kaggle.json or set envs
# KAGGLE_USERNAME and KAGGLE_KEY

DATA_DIR = Path(__file__).parent
OUT_CSV = DATA_DIR / "vocab.csv"

# Example dataset slug; replace with the exact one used in the notebook if different.
# This is a placeholder; user should confirm the dataset.
KAGGLE_DATASET = os.getenv("KAGGLE_DATASET", "sanjaytharanga/sinhala-english-dictionary")


def download_and_prepare():
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except Exception:
        raise RuntimeError("kaggle package not installed. Run: pip install kaggle")

    api = KaggleApi()
    api.authenticate()

    dest = DATA_DIR / "kaggle_download"
    dest.mkdir(exist_ok=True)

    # Download dataset files
    api.dataset_download_files(KAGGLE_DATASET, path=str(dest), unzip=False)
    zips = list(dest.glob("*.zip"))
    if not zips:
        raise RuntimeError("No zip file downloaded from Kaggle dataset.")

    # Unzip first zip
    zpath = zips[0]
    with zipfile.ZipFile(zpath, 'r') as zf:
        zf.extractall(dest)

    # Heuristic: find a CSV and map columns to expected format
    csvs = list(dest.glob("*.csv"))
    if not csvs:
        raise RuntimeError("No CSV found after unzip.")

    df = pd.read_csv(csvs[0])

    # Attempt column mapping
    mapping_candidates = [
        ("Sinhala", "sinhala"), ("si", "sinhala"), ("si_word", "sinhala"), ("sinhala", "sinhala"),
        ("English", "english"), ("en", "english"), ("en_word", "english"), ("english", "english"),
        ("Transliteration", "transliteration"), ("roman", "transliteration"), ("transliteration", "transliteration"),
        ("POS", "pos"), ("pos", "pos"),
        ("Example_SI", "example_si"), ("example_si", "example_si"),
        ("Example_EN", "example_en"), ("example_en", "example_en"),
    ]
    colmap = {}
    for src, tgt in mapping_candidates:
        if src in df.columns:
            colmap[src] = tgt
    df = df.rename(columns=colmap)

    # Normalize to expected columns
    expected = ["sinhala", "english", "transliteration", "pos", "example_si", "example_en"]
    for col in expected:
        if col not in df.columns:
            df[col] = ""
    df = df[expected]

    df.to_csv(OUT_CSV, index=False, encoding="utf-8")
    return OUT_CSV

if __name__ == "__main__":
    out = download_and_prepare()
    print(f"Saved: {out}")
