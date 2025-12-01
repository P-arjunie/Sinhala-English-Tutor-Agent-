from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from agent.functions import TutorFunctions
from agent.llm import GeminiClient
from agent.dictionary import DictionaryEnricher


# Load env from project root .env if present (non-fatal if missing)
ROOT_DOTENV = Path(__file__).resolve().parents[1] / ".env"
try:
    # Prefer .env values in dev to avoid stale machine envs
    load_dotenv(dotenv_path=ROOT_DOTENV, override=True)
except Exception:
    pass

app = FastAPI(title="Sinhala-English Tutor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_PATH = DATA_DIR / "vocab.csv"
DATA_CLEAN_PATH = DATA_DIR / "vocab_clean.csv"


def _bool_env(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


def load_vocab_df() -> pd.DataFrame:
    source = None
    if DATA_CLEAN_PATH.exists():
        df = pd.read_csv(DATA_CLEAN_PATH)
        source = DATA_CLEAN_PATH
    elif DATA_PATH.exists():
        df = pd.read_csv(DATA_PATH)
        source = DATA_PATH
    else:
        # Fallback demo data
        demo = [
            {"sinhala": "හෙලෝ", "english": "hello", "transliteration": "hello", "pos": "intj", "example_si": "හෙලෝ! කොහොමද?", "example_en": "Hello! How are you?"},
            {"sinhala": "ගුරු", "english": "teacher", "transliteration": "guru", "pos": "noun", "example_si": "ගුරු පාඩම් කියවයි", "example_en": "The teacher teaches lessons"},
            {"sinhala": "සිසු", "english": "student", "transliteration": "sisu", "pos": "noun", "example_si": "සිසු සරසවියට යයි", "example_en": "The student goes to the university"},
        ]
        df = pd.DataFrame(demo)
    df = TutorFunctions.normalize(df)
    # Optional kid-safe filtering: remove rows containing banned terms in Sinhala or English
    if _bool_env("KID_SAFE_FILTER", False):
        # Allow override via env KID_SAFE_BANNED (comma-separated)
        default_banned = [
            "sex", "sexual", "fuck", "fucking", "tits", "breast", "kill", "die", "suicide", "weapon", "gun", "drugs", "drug",
        ]
        extra = os.getenv("KID_SAFE_BANNED", "")
        if extra.strip():
            default_banned.extend([x.strip() for x in extra.split(",") if x.strip()])
        df = TutorFunctions.filter_offensive(df, default_banned)
    return df


vocab_df = load_vocab_df()
functions = TutorFunctions(vocab_df)


# --- Fallback helpers for kid endpoints when LLM is unavailable ---
def _kid_explain_fallback(english: str, sinhala: str | None = None, age: int = 8) -> dict:
    en = (english or "").strip()
    si = (sinhala or "").strip()
    word = en or (si and "(unknown)") or "(word)"
    definition_en = f"'{word}' is a simple word you can learn. Let's use it in short, friendly sentences. 😊"
    examples_en = [
        f"I can say '{word}' in a sentence.",
        f"Do you know '{word}'?"
    ]
    explanation_si = ("මේ වචනය තේරුම් ගන්න පහසුයි. අපි හුරු හුරු උදාහරණ වලින් ඉගෙන ගමු. 😊")
    return {
        "word": word,
        "definition_en": definition_en,
        "examples_en": examples_en,
        "explanation_si": explanation_si,
    }


def _kid_story_fallback(words: list[str], sentences: int = 3) -> str:
    ws = [w for w in (words or []) if isinstance(w, str) and w.strip()][:6]
    if not ws:
        ws = ["cat", "play", "sun"]
    parts = [
        f"One sunny day, a kid found the words: {', '.join(ws)}. ☀️",
        f"They used the words to make a happy story and share with friends. 😊",
        "Learning new words can be fun and kind!"
    ]
    return "\n".join(parts[: max(1, min(sentences, 4))])


def _dict_enrich_fallback(base: dict, level: str = "A1/A2") -> dict:
    """Fallback dictionary enrichment when LLM is unavailable."""
    english = (base.get("english", "") or "").strip()
    sinhala = (base.get("sinhala", "") or "").strip()
    word = english or sinhala or "(word)"
    
    return {
        "english": english,
        "sinhala": sinhala,
        "transliteration": base.get("transliteration", "") or "",
        "pos": base.get("pos", "") or "",
        "definition_en": f"A {level} level word that you can learn step by step.",
        "examples_en": [f"I can use '{word}' in sentences.", f"Learning '{word}' helps me communicate."],
        "explanation_si": "මෙය ඉගෙන ගත හැකි වචනයක්. අපි එය වාක්‍යවල භාවිතා කරමු.",
        "examples_si": [f"මම '{word}' වචනය භාවිතා කරමි.", "නව වචන ඉගෙන ගැනීම ප්‍රයෝජනවත්."],
        "synonyms_en": [],
        "notes_si": "ස්වයං අධ්‍යයනය කරන්න."
    }


class SearchResponseItem(BaseModel):
    sinhala: str
    english: str
    transliteration: str
    pos: str
    example_si: str
    example_en: str


class TranslateRequest(BaseModel):
    text_si: str


class ExplainRequest(BaseModel):
    sinhala: str
    english: str


class QuizRequest(BaseModel):
    n: int = 5
    mode: str = "words"  # "words" or "sentences"
    max_words: int = 2
class McqRequest(BaseModel):
    n: int = 5
    choices: int = 4
    explain: bool = False
    simple: bool = False  # if true, prefer simpler kid-friendly words

class AnswerRequest(BaseModel):
    question: str
    k: int = 5


class McqItem(BaseModel):
    sinhala: str
    transliteration: str | None = None
    pos: str | None = None
    options: list[str]
    answer_index: int
    answer: str
    answer_explanation: str | None = None

class KidExplainRequest(BaseModel):
    english: str
    sinhala: Optional[str] = None
    age: int = 8

class KidFeedbackRequest(BaseModel):
    user_answer: str
    correct_answer: str

class KidStoryRequest(BaseModel):
    words: List[str]
    sentences: int = 3

class ModerateRequest(BaseModel):
    text: str

class DictEnrichRequest(BaseModel):
    english: Optional[str] = None
    sinhala: Optional[str] = None
    transliteration: Optional[str] = None
    pos: Optional[str] = None
    example_si: Optional[str] = None
    example_en: Optional[str] = None
    level: str = "A1/A2"



@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug/env")
def debug_env():
    import os as _os
    key = (
        _os.getenv("GEMINI_API_KEY")
        or _os.getenv("GOOGLE_API_KEY")
        or ""
    ).strip().strip('"').strip("'")
    model = (_os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()
    return {
        "has_key": bool(key),
        "key_len": len(key),
        "key_prefix": key[:6] if key else "",
        "model": model,
    }


@app.get("/vocab", response_model=List[SearchResponseItem])
def vocab(limit: int = 100):
    df = vocab_df
    if _bool_env("KID_SAFE_FILTER", False):
        # Re-apply in case env changed after load (cheap call)
        banned = ["sex", "sexual", "fuck", "fucking", "tits", "breast", "kill", "die", "suicide", "weapon", "gun", "drugs", "drug"]
        extra = os.getenv("KID_SAFE_BANNED", "")
        if extra.strip():
            banned.extend([x.strip() for x in extra.split(",") if x.strip()])
        df = TutorFunctions.filter_offensive(df, banned)
    rows = df.head(limit).to_dict(orient="records")
    return rows


@app.get("/search", response_model=List[SearchResponseItem])
def search(q: Optional[str] = None, pos: Optional[str] = None, limit: int = 100):
    df = functions.search(q)
    if pos:
        df = df[df["pos"].str.lower() == pos.lower()]
    if _bool_env("KID_SAFE_FILTER", False):
        banned = ["sex", "sexual", "fuck", "fucking", "tits", "breast", "kill", "die", "suicide", "weapon", "gun", "drugs", "drug"]
        extra = os.getenv("KID_SAFE_BANNED", "")
        if extra.strip():
            banned.extend([x.strip() for x in extra.split(",") if x.strip()])
        df = TutorFunctions.filter_offensive(df, banned)
    return df.head(limit).to_dict(orient="records")


@app.post("/translate")
def translate(req: TranslateRequest):
    try:
        gem = GeminiClient()
        # Provide light grounding from dataset for better consistency
        ctx = functions.retrieve_context(req.text_si, k=5)
        out = gem.translate(req.text_si, context=ctx, kid_safe=_bool_env("KID_SAFE_MODE", False))
        if _bool_env("KID_SAFE_STRICT", False):
            mod = gem.moderate_text(out)
            if not mod.get("safe", True):
                raise HTTPException(status_code=406, detail={"message": "Response blocked by kid-safety policy", "reasons": mod.get("reasons", [])})
        return {"translation": out}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/explain")
def explain(req: ExplainRequest):
    try:
        gem = GeminiClient()
        ctx = functions.retrieve_context(req.english or req.sinhala, k=5)
        res = gem.explain_word(req.sinhala, req.english, context=ctx, kid_safe=_bool_env("KID_SAFE_MODE", False))
        if _bool_env("KID_SAFE_STRICT", False):
            mod = gem.moderate_text(res.get("explanation", ""))
            if not mod.get("safe", True):
                raise HTTPException(status_code=406, detail={"message": "Response blocked by kid-safety policy", "reasons": mod.get("reasons", [])})
        return res
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/quiz")
def quiz(req: QuizRequest):
    try:
        words_only = (req.mode.lower() == "words")
        items = functions.sample_items(max(req.n, 1), words_only=words_only, max_words_si=req.max_words, max_words_en=req.max_words)
        gem = GeminiClient()
        qs = gem.generate_quiz(items, n=req.n, words_only=words_only, kid_safe=_bool_env("KID_SAFE_MODE", False))
        if _bool_env("KID_SAFE_STRICT", False):
            # Join questions text and run a quick moderation; if unsafe, block
            joined = "\n".join([str(q) for q in qs])
            mod = gem.moderate_text(joined)
            if not mod.get("safe", True):
                raise HTTPException(status_code=406, detail={"message": "Quiz blocked by kid-safety policy", "reasons": mod.get("reasons", [])})
        return {"questions": qs}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/quiz/mcq", response_model=list[McqItem])
@app.post("/quiz/mcq/", response_model=list[McqItem])
def quiz_mcq(req: McqRequest):
    # Prepare filtered dataset if needed
    df = vocab_df
    if _bool_env("KID_SAFE_FILTER", False):
        banned = ["sex", "sexual", "fuck", "fucking", "tits", "breast", "kill", "die", "suicide", "weapon", "gun", "drugs", "drug"]
        extra = os.getenv("KID_SAFE_BANNED", "")
        if extra.strip():
            banned.extend([x.strip() for x in extra.split(",") if x.strip()])
        df = TutorFunctions.filter_offensive(df, banned)
    # Enforce strict single-word constraint (<=1 word each side) for MCQ clarity
    import re as _re
    def wc(s: str) -> int:
        return len(_re.findall(r"\b\w+\b", s or "", flags=_re.UNICODE))
    df_words = df[(df["sinhala"].apply(wc) <= 1) & (df["english"].apply(wc) <= 1)]
    # If too few strictly single-word rows, fallback to original dataset but we'll truncate later
    if df_words.shape[0] < max(3, req.n):
        df_words = df
    temp_funcs = TutorFunctions(df_words)
    # Choose generator based on 'simple' flag
    if req.simple:
        items = temp_funcs.gen_mcq_simple_words(n=req.n, choices=req.choices)
    else:
        items = temp_funcs.gen_mcq_strict_words(n=req.n, choices=req.choices)
    # Post-process Sinhala to single word (first token) to ensure UI shows word-only prompt
    def first_word(text: str) -> str:
        if not isinstance(text, str):
            return ""
        m = _re.search(r"\b\w+\b", text)
        return m.group(0) if m else text.strip()
    for it in items:
        it["sinhala"] = first_word(it.get("sinhala", ""))
    if req.explain:
        try:
            gem = GeminiClient()
            # Explain each answer briefly (kid-safe style optionally)
            for it in items:
                ctx = functions.retrieve_context(it["answer"], k=5)
                # Use original Sinhala phrase (may be multi-word) but explain reduced English answer word
                exp_obj = gem.explain_word(it["sinhala"], it["answer"], context=ctx, kid_safe=_bool_env("KID_SAFE_MODE", False))
                explanation = exp_obj.get("explanation", "")
                if _bool_env("KID_SAFE_STRICT", False):
                    mod = gem.moderate_text(explanation)
                    if not mod.get("safe", True):
                        explanation = "(blocked by safety policy)"
                it["answer_explanation"] = explanation
        except Exception:
            # Non-fatal: leave explanations None
            pass
    return items


@app.get("/lessons", response_model=List[SearchResponseItem])
def lessons(pos: str | None = None, limit: int = 50):
    df = vocab_df
    if pos:
        df = df[df["pos"].str.lower() == pos.lower()]
    return df.head(limit).to_dict(orient="records")


@app.get("/llm/ping")
def llm_ping():
    try:
        gem = GeminiClient()
        txt = gem.translate("හෙලෝ", context=functions.retrieve_context("හෙලෝ", k=3), kid_safe=_bool_env("KID_SAFE_MODE", False))
        return {"ok": True, "sample": txt[:40]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/llm/answer")
def llm_answer(req: AnswerRequest):
    try:
        ctx = functions.retrieve_context(req.question, k=max(1, min(req.k, 10)))
        gem = GeminiClient()
        ans = gem.answer_with_context(req.question, context=ctx, style="concise", kid_safe=_bool_env("KID_SAFE_MODE", False))
        if _bool_env("KID_SAFE_STRICT", False):
            mod = gem.moderate_text(ans)
            if not mod.get("safe", True):
                raise HTTPException(status_code=406, detail={"message": "Response blocked by kid-safety policy", "reasons": mod.get("reasons", [])})
        return {"answer": ans, "used": ctx}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/kid/explain")
def kid_explain(req: KidExplainRequest):
    try:
        # Check if we can initialize GeminiClient
        try:
            gem = GeminiClient()
        except Exception:
            # If GeminiClient fails to initialize, use fallback immediately
            return _kid_explain_fallback(req.english, req.sinhala, req.age)
        
        ctx = functions.retrieve_context(req.english or (req.sinhala or ""), k=5)
        return gem.kid_explain(word_en=req.english, word_si=req.sinhala, age=req.age, context=ctx)
    except Exception as e:
        # Fallback to a simple, safe template response instead of 502
        return _kid_explain_fallback(req.english, req.sinhala, req.age)


@app.get("/kid/explain")
def kid_explain_get(english: Optional[str] = None, sinhala: Optional[str] = None, age: int = 8):
    try:
        if not english and not sinhala:
            raise HTTPException(status_code=400, detail="Provide 'english' or 'sinhala' query param, e.g., /kid/explain?english=teacher")
        
        # Check if we can initialize GeminiClient
        try:
            gem = GeminiClient()
        except Exception:
            # If GeminiClient fails to initialize, use fallback immediately
            return _kid_explain_fallback(english or "", sinhala, age)
        
        key = english or sinhala or ""
        ctx = functions.retrieve_context(key, k=5)
        return gem.kid_explain(word_en=english or "", word_si=sinhala, age=age, context=ctx)
    except HTTPException:
        raise
    except Exception as e:
        return _kid_explain_fallback(english or "", sinhala, age)


@app.post("/kid/feedback")
def kid_feedback(req: KidFeedbackRequest):
    try:
        gem = GeminiClient()
        out = gem.kid_feedback(req.user_answer, req.correct_answer)
        return {"feedback": out}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/kid/story")
def kid_story(req: KidStoryRequest):
    try:
        # Check if we can initialize GeminiClient
        try:
            gem = GeminiClient()
        except Exception:
            # If GeminiClient fails to initialize, use fallback immediately
            return {"story": _kid_story_fallback(req.words, sentences=req.sentences)}
        
        out = gem.kid_story(req.words, sentences=req.sentences)
        return {"story": out}
    except Exception as e:
        # Fallback story so UI remains functional
        return {"story": _kid_story_fallback(req.words, sentences=req.sentences)}


@app.post("/moderate/check")
def moderate_check(req: ModerateRequest):
    try:
        gem = GeminiClient()
        result = gem.moderate_text(req.text)
        # Basic keyword scan as a second safety net
        banned = ["kill", "sex", "drug", "suicide", "hate", "terror", "weapon"]
        lowered = (req.text or "").lower()
        if any(b in lowered for b in banned):
            result["safe"] = False
            reasons = set(result.get("reasons", []))
            reasons.add("keyword_match")
            result["reasons"] = list(reasons)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")


@app.post("/dictionary/enrich")
def dictionary_enrich(req: DictEnrichRequest):
    try:
        # Assemble base from request or dataset
        base = {
            "english": (req.english or "").strip(),
            "sinhala": (req.sinhala or "").strip(),
            "transliteration": (req.transliteration or "").strip(),
            "pos": (req.pos or "").strip(),
            "example_si": (req.example_si or "").strip(),
            "example_en": (req.example_en or "").strip(),
        }
        # If no direct fields given, try to find row from dataset by query
        query = base["english"] or base["sinhala"]
        ctx = []
        if query:
            ctx = functions.retrieve_context(query, k=8)
            # Use the top context row to prefill any missing fields
            if ctx:
                top = ctx[0]
                for k in ["english", "sinhala", "transliteration", "pos", "example_si", "example_en"]:
                    if not base.get(k):
                        base[k] = str(top.get(k, "") or "")
        
        # Try to use LLM enricher, fallback if it fails
        try:
            enricher = DictionaryEnricher(kid_safe=_bool_env("KID_SAFE_MODE", False))
            out = enricher.enrich(base, context_rows=ctx, level=req.level)
        except Exception:
            # If enricher fails, use simple fallback
            return _dict_enrich_fallback(base, req.level)
        
        if _bool_env("KID_SAFE_STRICT", False):
            try:
                gem = GeminiClient()
                joined = "\n".join([
                    out.get("definition_en", ""),
                    " ".join(out.get("examples_en", [])),
                    out.get("explanation_si", ""),
                    " ".join(out.get("examples_si", [])),
                ]).strip()
                if joined:
                    mod = gem.moderate_text(joined)
                    if not mod.get("safe", True):
                        raise HTTPException(status_code=406, detail={"message": "Dictionary entry blocked by kid-safety policy", "reasons": mod.get("reasons", [])})
            except Exception:
                pass  # Skip moderation if GeminiClient fails
        return out
    except HTTPException:
        raise
    except Exception as e:
        # Final fallback
        return _dict_enrich_fallback(base, req.level)


@app.get("/dictionary/enrich")
def dictionary_enrich_get(q: Optional[str] = None, level: str = "A1/A2"):
    try:
        if not q:
            raise HTTPException(status_code=400, detail="Provide ?q=<word> to enrich")
        ctx = functions.retrieve_context(q, k=8)
        base = {"english": q}
        if ctx:
            top = ctx[0]
            for k in ["english", "sinhala", "transliteration", "pos", "example_si", "example_en"]:
                base.setdefault(k, str(top.get(k, "") or ""))
        
        # Try to use LLM enricher, fallback if it fails
        try:
            enricher = DictionaryEnricher(kid_safe=_bool_env("KID_SAFE_MODE", False))
            out = enricher.enrich(base, context_rows=ctx, level=level)
            return out
        except Exception:
            # If enricher fails, use simple fallback
            return _dict_enrich_fallback(base, level)
    except HTTPException:
        raise
    except Exception as e:
        return _dict_enrich_fallback({"english": q or ""}, level)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
