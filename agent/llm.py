# import os
# from typing import List, Dict

# try:
#     from google import genai as genai_v2  # New Google GenAI SDK
# except Exception:  # pragma: no cover
#     genai_v2 = None

# try:
#     import google.generativeai as genai_v1  # Legacy SDK
# except Exception:  # pragma: no cover
#     genai_v1 = None

# class GeminiClient:
#     def __init__(self, api_key: str | None = None, model_name: str | None = None):
#         key = (
#             api_key
#             or os.getenv("GEMINI_API_KEY")
#             or os.getenv("GOOGLE_API_KEY")
#             or ""
#         )
#         key = key.strip().strip('"').strip("'")
#         if not key:
#             raise ValueError("Gemini API key not set. Set GEMINI_API_KEY (preferred) or GOOGLE_API_KEY.")

#         # Prefer model from env, then argument, then a sane default
#         self.model_name = (model_name or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()

#         # Prefer new SDK if available
#         if genai_v2 is not None:
#             self._provider = "v2"
#             self._client = genai_v2.Client(api_key=key)
#         elif genai_v1 is not None:
#             self._provider = "v1"
#             genai_v1.configure(api_key=key)
#             self._client = genai_v1.GenerativeModel(self.model_name)
#         else:
#             raise RuntimeError("No Gemini SDK available. Install 'google-genai' or 'google-generativeai'.")

#     def _kid_guidelines(self) -> str:
#         return (
#             "\nYou are a kid-safe tutor. Keep language simple (CEFR A1/A2), friendly, and positive. "
#             "Avoid violence, sexual content, drugs, hate, or scary themes. No profanity. Keep responses concise. and give kids friendly response\n"
#         )

#     def translate(self, text_si: str, context: List[Dict[str, str]] | None = None, kid_safe: bool = False) -> str:
#         corpus_block = ""
#         if context:
#             lines = []
#             for it in context[:10]:
#                 si = it.get("sinhala", "")
#                 en = it.get("english", "")
#                 lines.append(f"- Sinhala: {si}\n  English: {en}")
#             corpus_block = "\nUse the following parallel corpus as reference; prefer exact matches and keep output concise. If unknown, provide best effort.\n" + "\n".join(lines) + "\n"
#         prompt = (
#             "Translate the following Sinhala word or sentence to English. "
#             "Return only the English translation." + corpus_block + "\nSinhala: " + text_si
#         )
#         if kid_safe:
#             prompt = self._kid_guidelines() + prompt
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             return (getattr(resp, "text", "") or "").strip()
#         else:
#             resp = self._client.generate_content(prompt)
#             return (getattr(resp, "text", "") or "").strip()

#     def explain_word(self, sinhala: str, english: str, context: List[Dict[str, str]] | None = None, kid_safe: bool = False) -> Dict[str, str]:
#         corpus_block = ""
#         if context:
#             lines = []
#             for it in context[:10]:
#                 si = it.get("sinhala", "")
#                 en = it.get("english", "")
#                 lines.append(f"- Sinhala: {si}\n  English: {en}")
#             corpus_block = "\nUse the following parallel corpus as reference. Keep answers aligned with it where applicable.\n" + "\n".join(lines) + "\n"
#         prompt = (
#             "You are a bilingual tutor for Sinhala speakers learning English. "
#             f"Explain the English word '{english}' with a brief definition, 2 example sentences, and a Sinhala explanation. "
#             f"Sinhala word: '{sinhala}'. Keep responses concise." + corpus_block
#         )
#         if kid_safe:
#             prompt = self._kid_guidelines() + prompt
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             return {"explanation": (getattr(resp, "text", "") or "")}
#         else:
#             resp = self._client.generate_content(prompt)
#             return {"explanation": (getattr(resp, "text", "") or "")}

#     def generate_quiz(self, items: List[Dict[str, str]], n: int = 5, words_only: bool = True, kid_safe: bool = False) -> List[Dict[str, str]]:
#         # Few-shot prompt from items
#         examples = "\n".join([f"- {it['sinhala']} -> {it['english']}" for it in items[:10]])
#         guidance = (
#             "Create a Sinhala→English matching quiz using WORD-LEVEL pairs only. "
#             "If any examples look like sentences, extract the key word (ignore extra words). "
#             "Return strictly JSON (no markdown) with a list of objects: {\"sinhala\", \"answer\"}."
#         )
#         prompt = (
#             guidance +
#             f"\nHere are sample pairs (treat as words):\n{examples}\n\n" +
#             f"Produce {n} questions."
#         )
#         if kid_safe:
#             prompt = self._kid_guidelines() + prompt
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             text = getattr(resp, "text", "") or "[]"
#         else:
#             resp = self._client.generate_content(prompt)
#             text = getattr(resp, "text", "") or "[]"
#         # Try safe eval via json
#         import json
#         try:
#             data = json.loads(text)
#             if isinstance(data, list):
#                 return data
#         except Exception:
#             pass
#         # Fallback: simple selection from items
#         return [{"sinhala": it["sinhala"], "answer": it["english"]} for it in items[:n]]

#     def answer_with_context(self, question: str, context: List[Dict[str, str]], style: str = "concise", kid_safe: bool = False) -> str:
#         lines = []
#         for it in context[:10]:
#             si = it.get("sinhala", "")
#             en = it.get("english", "")
#             lines.append(f"- Sinhala: {si}\n  English: {en}")
#         corpus = "\n".join(lines)
#         prompt = (
#             "You are a Sinhala–English tutor. Answer the user's question using ONLY the following parallel corpus as reference. "
#             "Prefer exact matches; if an answer is not covered, say you can't answer from the corpus. Keep the answer " + style + ".\n\n"
#             "Corpus:\n" + corpus + "\n\nQuestion: " + question
#         )
#         if kid_safe:
#             prompt = self._kid_guidelines() + prompt
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             return (getattr(resp, "text", "") or "").strip()
#         else:
#             resp = self._client.generate_content(prompt)
#             return (getattr(resp, "text", "") or "").strip()

#     # --- Kid-friendly helpers ---
#     def moderate_text(self, text: str) -> Dict[str, object]:
#         prompt = (
#             "Classify the following text for child safety. Respond as JSON with keys: "
#             "{\"safe\": boolean, \"reasons\": [string]}. "
#             "Mark as unsafe if it includes violence, sexual content, hate, drugs, profanity, self-harm, or personal data requests.\n\n"
#             f"Text:\n{text}"
#         )
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             raw = (getattr(resp, "text", "") or "").strip()
#         else:
#             resp = self._client.generate_content(prompt)
#             raw = (getattr(resp, "text", "") or "").strip()
#         import json
#         try:
#             data = json.loads(raw)
#             if isinstance(data, dict) and "safe" in data:
#                 return {"safe": bool(data.get("safe")), "reasons": data.get("reasons", [])}
#         except Exception:
#             pass
#         return {"safe": True, "reasons": []}

#     def kid_explain(self, word_en: str, word_si: str | None = None, age: int = 8, context: List[Dict[str, str]] | None = None) -> Dict[str, str]:
#         corpus_block = ""
#         if context:
#             lines = []
#             for it in context[:8]:
#                 si = it.get("sinhala", "")
#                 en = it.get("english", "")
#                 lines.append(f"- Sinhala: {si}\n  English: {en}")
#             corpus_block = "\nUse this corpus to keep examples familiar:\n" + "\n".join(lines) + "\n"
#         prompt = (
#             "Explain this English word for a child. Keep it friendly, simple (CEFR A1/A2), 1-2 short examples, include a Sinhala explanation, and add 1-2 fun emojis. "
#             "Return JSON: {\"word\": string, \"definition_en\": string, \"examples_en\": [string], \"explanation_si\": string}. "
#             f"Target age: {age}. Word: '{word_en}'. Sinhala hint: '{word_si or ''}'." + corpus_block
#         )
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             raw = (getattr(resp, "text", "") or "").strip()
#         else:
#             resp = self._client.generate_content(prompt)
#             raw = (getattr(resp, "text", "") or "").strip()
#         import json, re
#         cleaned = raw.strip()
#         # Strip markdown code fences if present
#         if cleaned.startswith("```"):
#             cleaned = re.sub(r"^```[a-zA-Z0-9_]*\n?", "", cleaned)  # remove opening fence with optional lang
#             if cleaned.endswith("```"):
#                 cleaned = cleaned[:-3].strip()
#         # Extract first JSON object if extra text surrounds it
#         if "{" in cleaned and "}" in cleaned:
#             # Greedy from first { to last }
#             start = cleaned.find("{")
#             end = cleaned.rfind("}")
#             candidate = cleaned[start:end+1]
#         else:
#             candidate = cleaned
#         try:
#             data = json.loads(candidate)
#             if isinstance(data, dict) and data.get("word"):
#                 # Ensure required keys; add fallbacks
#                 data.setdefault("definition_en", data.get("definition_en", ""))
#                 data.setdefault("examples_en", data.get("examples_en", []))
#                 data.setdefault("explanation_si", data.get("explanation_si", ""))
#                 return data
#         except Exception:
#             pass
#         # Fallback: treat cleaned (sans fences) as definition text
#         return {"word": word_en, "definition_en": cleaned, "examples_en": [], "explanation_si": ""}

#     def kid_feedback(self, user_answer: str, correct_answer: str) -> str:
#         prompt = (
#             "Give one-line, child-friendly feedback with positive tone and a tiny hint. "
#             "No scolding. Include 1 emoji.\n\n"
#             f"User answer: {user_answer}\nCorrect answer: {correct_answer}"
#         )
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             return (getattr(resp, "text", "") or "").strip()
#         else:
#             resp = self._client.generate_content(prompt)
#             return (getattr(resp, "text", "") or "").strip()

#     def kid_story(self, words: List[str], sentences: int = 3) -> str:
#         words_str = ", ".join(words[:6])
#         prompt = (
#             "Write a short, cheerful story for a child using these words. "
#             "Keep it simple (A1/A2), safe, and 3-4 short sentences. Include 2 emojis. Avoid scary or mature themes.\n\n"
#             f"Words: {words_str}"
#         )
#         if self._provider == "v2":
#             resp = self._client.models.generate_content(model=self.model_name, contents=prompt)
#             return (getattr(resp, "text", "") or "").strip()
#         else:
#             resp = self._client.generate_content(prompt)
#             return (getattr(resp, "text", "") or "").strip()

# gemini_client.py
# gemini_client.py — YOUR FULL PROFESSIONAL VERSION (Dec 2025 ready)
import os
import json
import re
from typing import List, Dict, Any

try:
    from google import genai as genai_v2
    HAS_V2 = True
except ImportError:
    HAS_V2 = False

try:
    import google.generativeai as genai_v1
    HAS_V1 = True
except ImportError:
    HAS_V1 = False

class GeminiClient:
    def __init__(self, api_key: str | None = None, model_name: str | None = None):
        key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        key = key.strip().strip('"').strip("'")
        if not key:
            raise ValueError("Gemini API key not found! Set GEMINI_API_KEY or GOOGLE_API_KEY")

        self.model_name = (model_name or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()

        if HAS_V2:
            self.provider = "v2"
            self.client = genai_v2.Client(api_key=key)
        elif HAS_V1:
            self.provider = "v1"
            genai_v1.configure(api_key=key)
            self.client = genai_v1.GenerativeModel(self.model_name)
        else:
            raise RuntimeError("Install: pip install google-genai  OR  google-generativeai")

    def _kid_guidelines(self) -> str:
        return (
            "\nYou are a warm, joyful, kid-safe Sinhala-English tutor for children 6–12 years old. "
            "Always be positive, encouraging, and fun. Use simple A1/A2 English. "
            "Speak naturally in Sinhala script. Never say 'wrong' or 'incorrect'. "
            "Use emojis. Keep everything super safe and happy!\n"
        )

    def _generate(self, prompt: str) -> str:
        try:
            if self.provider == "v2":
                resp = self.client.models.generate_content(model=self.model_name, contents=prompt)
                return resp.text or ""
            else:
                resp = self.client.generate_content(prompt)
                return resp.text or ""
        except Exception as e:
            return f"[Gemini Error: {e}]"

    def translate(self, text_si: str, context: List[Dict[str, str]] | None = None, kid_safe: bool = False) -> str:
        corpus_block = ""
        if context:
            lines = [f"- Sinhala: {c.get('sinhala','')}\n  English: {c.get('english','')}" for c in context[:10]]
            corpus_block = "\nReference corpus (use exact matches when possible):\n" + "\n".join(lines) + "\n"
        prompt = f"Translate only to English. Return just the translation.\n{corpus_block}\nSinhala: {text_si}"
        if kid_safe:
            prompt = self._kid_guidelines() + prompt
        return self._generate(prompt).strip()

    def explain_word(self, sinhala: str, english: str, context: List[Dict[str, str]] | None = None, kid_safe: bool = False) -> Dict[str, str]:
        corpus_block = ""
        if context:
            lines = [f"- {c.get('sinhala','')} → {c.get('english','')}" for c in context[:10]]
            corpus_block = "\nSimilar words from corpus:\n" + "\n".join(lines) + "\n"
        prompt = (
            f"You are a bilingual tutor. Explain the English word '{english}' (Sinhala: {sinhala}) "
            "with: short definition, 2 simple sentences, Sinhala explanation. Keep it concise."
            f"{corpus_block}"
        )
        if kid_safe:
            prompt = self._kid_guidelines() + prompt
        return {"explanation": self._generate(prompt)}

    def generate_quiz(self, items: List[Dict[str, str]], n: int = 5, words_only: bool = True, kid_safe: bool = False) -> List[Dict[str, str]]:
        examples = "\n".join([f"- {it['sinhala']} → {it['english']}" for it in items[:12]])
        guidance = "Create a Sinhala→English quiz using only WORD pairs. If any item is a sentence, extract the main word. Return clean JSON list of objects with keys: sinhala, answer"
        prompt = f"{guidance}\n\nExamples:\n{examples}\n\nGenerate {n} questions:"
        if kid_safe:
            prompt = self._kid_guidelines() + prompt
        text = self._generate(prompt)
        try:
            data = json.loads(text)
            return data if isinstance(data, list) else []
        except:
            return [{"sinhala": it["sinhala"], "answer": it["english"]} for it in items[:n]]

    def answer_with_context(self, question: str, context: List[Dict[str, str]], style: str = "concise", kid_safe: bool = False) -> str:
        corpus = "\n".join([f"- Sinhala: {c.get('sinhala','')}\n  English: {c.get('english','')}" for c in context[:10]])
        prompt = (
            f"Answer using ONLY this corpus. If not found, say 'මට ඒ ගැන දත්ත නැහැ'. Keep answer {style}.\n\n"
            f"Corpus:\n{corpus}\n\nQuestion: {question}"
        )
        if kid_safe:
            prompt = self._kid_guidelines() + prompt
        return self._generate(prompt)

    def moderate_text(self, text: str) -> Dict[str, Any]:
        prompt = f'Classify as JSON {{"safe": bool, "reasons": [str]}}. Unsafe if violence, sex, hate, drugs, swearing, self-harm.\nText: {text}'
        raw = self._generate(prompt)
        try:
            return json.loads(raw)
        except:
            return {"safe": True, "reasons": []}

    def kid_explain(self, word_en: str, word_si: str | None = None, age: int = 8, context: List[Dict] | None = None) -> Dict[str, str]:
        corpus = ""
        if context:
            corpus = "\n".join([f"- {c['sinhala']} → {c['english']}" for c in context[:8]])
            corpus = f"\nFamiliar words:\n" + corpus + "\n"
        prompt = (
            f"{self._kid_guidelines()}"
            f"{corpus}"
            f"Explain '{word_en}' (Sinhala: {word_si or '??'}) to a {age}-year-old. "
            "Return JSON: {{\"word\": str, \"definition_en\": str, \"examples_en\": [str], \"explanation_si\": str}}"
        )
        raw = self._generate(prompt)
        # Clean markdown fences
        cleaned = re.sub(r"^```json\s*|```$", "", raw.strip(), flags=re.MULTILINE)
        try:
            return json.loads(cleaned)
        except:
            return {"word": word_en, "definition_en": cleaned, "examples_en": [], "explanation_si": ""}

    def kid_feedback(self, user_answer: str, correct_answer: str) -> str:
        prompt = (
            f"{self._kid_guidelines()}"
            f"User said: {user_answer}\nCorrect: {correct_answer}\n"
            "Give warm, encouraging feedback in Sinhala with emoji. Never say wrong!"
        )
        return self._generate(prompt)

    def kid_story(self, words: List[str], sentences: int = 3) -> str:
        words_str = ", ".join(words[:7])
        prompt = (
            f"{self._kid_guidelines()}"
            f"Write a short happy story using these words: {words_str}\n"
            f"Exactly {sentences} sentences. Mix Sinhala + little English. Add 2–3 emojis."
        )
        return self._generate(prompt)