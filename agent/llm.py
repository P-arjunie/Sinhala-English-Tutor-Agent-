import os
from typing import List, Dict

import google.generativeai as genai

class GeminiClient:
    def __init__(self, api_key: str | None = None, model_name: str = "gemini-1.5-flash"):
        key = api_key or os.getenv("GOOGLE_API_KEY")
        if not key:
            raise ValueError("GOOGLE_API_KEY not set. Set env var or pass api_key.")
        genai.configure(api_key=key)
        self.model = genai.GenerativeModel(model_name)

    def translate(self, text_si: str) -> str:
        prompt = (
            "Translate the following Sinhala word or sentence to English. "
            "Return only the English translation.\nSinhala: " + text_si
        )
        resp = self.model.generate_content(prompt)
        return (resp.text or "").strip()

    def explain_word(self, sinhala: str, english: str) -> Dict[str, str]:
        prompt = (
            "You are a bilingual tutor for Sinhala speakers learning English. "
            f"Explain the English word '{english}' with a brief definition, 2 example sentences, and a Sinhala explanation. "
            f"Sinhala word: '{sinhala}'. Keep responses concise."
        )
        resp = self.model.generate_content(prompt)
        return {"explanation": resp.text or ""}

    def generate_quiz(self, items: List[Dict[str, str]], n: int = 5) -> List[Dict[str, str]]:
        # Few-shot prompt from items
        examples = "\n".join([f"- {it['sinhala']} -> {it['english']}" for it in items[:10]])
        prompt = (
            "Create a quiz of Sinhala to English matching with clear answers. "
            f"Here are sample pairs:\n{examples}\n\n"
            f"Produce {n} questions as JSON list objects with fields: sinhala, answer."
        )
        resp = self.model.generate_content(prompt)
        text = resp.text or "[]"
        # Try safe eval via json
        import json
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return data
        except Exception:
            pass
        # Fallback: simple selection from items
        return [{"sinhala": it["sinhala"], "answer": it["english"]} for it in items[:n]]
