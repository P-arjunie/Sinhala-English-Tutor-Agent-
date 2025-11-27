from typing import Dict, List
import pandas as pd

class TutorFunctions:
    def __init__(self, vocab: pd.DataFrame):
        self.vocab = vocab

    def search(self, query: str) -> pd.DataFrame:
        if not query:
            return self.vocab
        q = query.strip().lower()
        df = self.vocab
        return df[
            df["sinhala"].str.contains(q, case=False, na=False)
            | df["english"].str.contains(q, case=False, na=False)
            | df["transliteration"].str.contains(q, case=False, na=False)
        ]

    def sample_items(self, n: int = 10) -> List[Dict[str, str]]:
        cols = ["sinhala", "english", "transliteration", "pos", "example_si", "example_en"]
        df = self.vocab[cols].dropna().sample(min(n, len(self.vocab)), random_state=42)
        return df.to_dict(orient="records")

    @staticmethod
    def normalize(df: pd.DataFrame) -> pd.DataFrame:
        expected = ["sinhala", "english", "transliteration", "pos", "example_si", "example_en"]
        for col in expected:
            if col not in df.columns:
                df[col] = ""
        return df[expected]
