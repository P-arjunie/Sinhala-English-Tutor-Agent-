from typing import Dict, List
import random
import pandas as pd
import re

class TutorFunctions:
    def __init__(self, vocab: pd.DataFrame):
        self.vocab = vocab

    @staticmethod
    def filter_offensive(df: pd.DataFrame, banned: List[str]) -> pd.DataFrame:
        """Return a DataFrame with rows containing banned terms (in Sinhala or English) removed.
        Matching is case-insensitive and uses simple substring containment.
        """
        if not banned:
            return df
        # Build regex pattern for banned terms (escape special chars)
        safe_terms = [re.escape(t.strip()) for t in banned if t.strip()]
        if not safe_terms:
            return df
        pattern = re.compile(r"(" + "|".join(safe_terms) + r")", flags=re.IGNORECASE)
        mask_en = df["english"].str.contains(pattern, na=False)
        mask_si = df["sinhala"].str.contains(pattern, na=False)
        return df[~(mask_en | mask_si)]

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

    def sample_items(self, n: int = 10, *, words_only: bool = False, max_words_si: int = 2, max_words_en: int = 2) -> List[Dict[str, str]]:
        cols = ["sinhala", "english", "transliteration", "pos", "example_si", "example_en"]
        df = self.vocab[cols].dropna()
        if words_only:
            def wc(s: str) -> int:
                import re as _re
                if not isinstance(s, str) or not s.strip():
                    return 0
                return len(_re.findall(r"\b\w+\b", s, flags=_re.UNICODE))
            si_wc = df["sinhala"].apply(wc)
            en_wc = df["english"].apply(wc)
            df = df[(si_wc <= max_words_si) & (en_wc <= max_words_en) & (df["sinhala"].str.len() > 0) & (df["english"].str.len() > 0)]
            if df.empty:
                df = self.vocab[cols].dropna()
        n = min(n, len(df))
        if n <= 0:
            return []
        df = df.sample(n)
        return df.to_dict(orient="records")

    @staticmethod
    def normalize(df: pd.DataFrame) -> pd.DataFrame:
        expected = ["sinhala", "english", "transliteration", "pos", "example_si", "example_en"]
        for col in expected:
            if col not in df.columns:
                df[col] = ""
        # Ensure all text fields are strings and no NaN leaks to API
        out = df[expected].copy()
        out = out.fillna("")
        for col in expected:
            # Coerce to string safely
            out[col] = out[col].astype(str)
        # Strip placeholder tokens in transliteration like [Unkown]/[Unknown]/[UNK]
        out["transliteration"] = out["transliteration"].str.replace(r"\[(?:unk|unknown|unkown|UNK|Unknown|Unkown)\]", "", regex=True).str.replace(r"\s+", " ", regex=True).str.strip()
        return out

    def gen_mcq(self, n: int = 5, choices: int = 4) -> List[Dict[str, object]]:
        n = max(1, min(n, len(self.vocab)))
        choices = max(2, min(choices, max(2, len(self.vocab))))
        rows = self.vocab.sample(n).to_dict(orient="records")
        result: List[Dict[str, object]] = []
        for row in rows:
            correct = row["english"]
            pos = (row.get("pos") or "").lower()
            # Pool for distractors: same POS if possible
            pool = self.vocab
            if pos:
                same = pool[pool["pos"].str.lower() == pos]
                if len(same) >= choices:
                    pool = same
            # Build options
            opts = set([correct])
            candidates = pool["english"].dropna().unique().tolist()
            random.shuffle(candidates)
            for cand in candidates:
                if len(opts) >= choices:
                    break
                if isinstance(cand, str) and cand.strip() and cand != correct:
                    opts.add(cand)
            opts_list = list(opts)
            random.shuffle(opts_list)
            answer_index = opts_list.index(correct)
            result.append({
                "sinhala": row["sinhala"],
                "transliteration": row.get("transliteration", ""),
                "pos": row.get("pos", ""),
                "options": opts_list,
                "answer_index": answer_index,
                "answer": correct,
            })
        return result

    def gen_mcq_strict_words(self, n: int = 5, choices: int = 4) -> List[Dict[str, object]]:
        """Generate MCQs ensuring English answer and options are single words.
        Falls back to first token if multi-word strings appear."""
        import re as _re
        def first_word(text: str) -> str:
            if not isinstance(text, str):
                return ""
            m = _re.search(r"\b\w+\b", text)
            return m.group(0) if m else text.strip()
        # Filter vocab to single-word English entries first
        df = self.vocab.copy()
        def word_count(s: str) -> int:
            return len(_re.findall(r"\b\w+\b", s or "", flags=_re.UNICODE))
        df_words = df[df["english"].apply(word_count) <= 1]
        if df_words.empty:
            df_words = df
        n = max(1, min(n, len(df_words)))
        rows = df_words.sample(n).to_dict(orient="records")
        english_pool = [first_word(e) for e in df_words["english"].dropna().tolist() if first_word(e)]
        english_unique = list(dict.fromkeys(english_pool))  # preserve order
        random.shuffle(english_unique)
        result: List[Dict[str, object]] = []
        for row in rows:
            correct_full = row.get("english", "")
            correct = first_word(correct_full)
            opts = [correct]
            for w in english_unique:
                if len(opts) >= choices:
                    break
                if w != correct:
                    opts.append(w)
            random.shuffle(opts)
            answer_index = opts.index(correct)
            result.append({
                "sinhala": row.get("sinhala", ""),
                "transliteration": row.get("transliteration", ""),
                "pos": row.get("pos", ""),
                "options": opts,
                "answer_index": answer_index,
                "answer": correct,
            })
        return result

    def gen_mcq_simple_words(self, n: int = 5, choices: int = 4) -> List[Dict[str, object]]:
        """Generate MCQs restricted to simpler English words for kid mode.
        Heuristics:
        - Single word (already enforced by strict generator logic)
        - Alphabetic only (a-z letters)
        - Length between 2 and 8 characters
        - Exclude words that are just repeated single character (e.g. 'mmm')
        Falls back to strict words if pool too small.
        """
        import re as _re
        def first_word(text: str) -> str:
            if not isinstance(text, str):
                return ""
            m = _re.search(r"\b\w+\b", text)
            return m.group(0) if m else text.strip()
        def is_simple(w: str) -> bool:
            if not w:
                return False
            if not w.isalpha():
                return False
            wl = w.lower()
            if len(wl) < 2 or len(wl) > 8:
                return False
            if len(set(wl)) == 1 and len(wl) > 2:  # exclude 'mmm', 'aaaa'
                return False
            return True
        df = self.vocab.copy()
        def word_count(s: str) -> int:
            return len(_re.findall(r"\b\w+\b", s or "", flags=_re.UNICODE))
        df_words = df[df["english"].apply(word_count) <= 1]
        if df_words.empty:
            df_words = df
        # Apply simplicity filter
        simple_mask = df_words["english"].apply(lambda x: is_simple(first_word(str(x))))
        df_simple = df_words[simple_mask]
        # If too small, fallback to strict words
        if df_simple.shape[0] < max(3, n):
            return self.gen_mcq_strict_words(n=n, choices=choices)
        n = max(1, min(n, len(df_simple)))
        rows = df_simple.sample(n).to_dict(orient="records")
        english_pool = [first_word(e) for e in df_simple["english"].dropna().tolist() if first_word(e)]
        english_unique = list(dict.fromkeys(english_pool))
        random.shuffle(english_unique)
        result: List[Dict[str, object]] = []
        for row in rows:
            correct = first_word(row.get("english", ""))
            opts = [correct]
            for w in english_unique:
                if len(opts) >= choices:
                    break
                if w != correct:
                    opts.append(w)
            random.shuffle(opts)
            answer_index = opts.index(correct)
            result.append({
                "sinhala": row.get("sinhala", ""),
                "transliteration": row.get("transliteration", ""),
                "pos": row.get("pos", ""),
                "options": opts,
                "answer_index": answer_index,
                "answer": correct,
            })
        return result

    def retrieve_context(self, text: str, k: int = 5) -> List[Dict[str, str]]:
        """Return top-k rows most similar to the query text using simple token overlap
        across sinhala and english fields.
        """
        if not isinstance(text, str) or not text.strip():
            return self.vocab.head(k).to_dict(orient="records")

        # Tokenize (letters/digits) and lower for comparison
        def tokenize(s: str) -> set:
            if not isinstance(s, str):
                return set()
            # Keep unicode word characters; this will include Sinhala letters
            return set([t.lower() for t in re.findall(r"\w+", s, flags=re.UNICODE) if t.strip()])

        q_tokens = tokenize(text)
        if not q_tokens:
            return self.vocab.head(k).to_dict(orient="records")

        def score_row(row) -> int:
            si = str(row.get("sinhala", ""))
            en = str(row.get("english", ""))
            tokens = tokenize(si) | tokenize(en)
            return len(tokens & q_tokens)

        df = self.vocab.copy()
        scores = df.apply(score_row, axis=1)
        df = df.assign(_score=scores)
        df = df.sort_values(by="_score", ascending=False)
        top = df[df["_score"] > 0].head(k)
        if top.empty:
            top = df.head(k)
        return top.drop(columns=["_score"], errors="ignore").to_dict(orient="records")
