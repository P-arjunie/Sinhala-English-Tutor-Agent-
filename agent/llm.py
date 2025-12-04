# gemini_client.py
# gemini_client.py — YOUR FULL PROFESSIONAL VERSION (Dec 2025 ready)
import os
import json
import re
from typing import List, Dict, Any, Optional

# We will standardize on the google.generativeai library (referred to as v1 in previous logic)
# as it is the current standard. This avoids conflicts and simplifies the client.
try:
    import google.generativeai as genai
except ImportError:
    raise RuntimeError("Required library not found. Please install it by running: pip install google-generativeai")

class GeminiClient:
    """Client for interacting with the Gemini LLM."""

    def __init__(self, api_key: Optional[str] = None, model_name: str | None = None):
        """
        Initializes the Gemini client, standardizing on the google.generativeai library.
        """
        key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        key = key.strip().strip('"').strip("'")
        if not key:
            raise ValueError("Gemini API key not found! Set GEMINI_API_KEY or GOOGLE_API_KEY")

        # Configure the library with the API key
        genai.configure(api_key=key)

        # Get model name from environment or use a default
        self.model_name = (model_name or os.getenv("GEMINI_MODEL") or "gemini-1.5-flash").strip()
        
        # Create the generative model instance
        self.model = genai.GenerativeModel(self.model_name)

    def _clean_json_response(self, raw_text: str) -> str:
        """Strips markdown code block fences from a raw string to get to the JSON."""
        # Find the start of the JSON object
        json_start = raw_text.find('{')
        if json_start == -1:
            return "{}" # Return empty JSON if no '{' found
        # Find the end of the JSON object
        json_end = raw_text.rfind('}')
        if json_end == -1:
            return "{}" # Return empty JSON if no '}' found
        # Extract the JSON part
        json_str = raw_text[json_start : json_end + 1]
        return json_str

    def _kid_guidelines(self) -> str:
        return (
            "\nYou are a warm, joyful, kid-safe Sinhala-English tutor for children 6–12 years old. "
            "Always be positive, encouraging, and fun. Use simple A1/A2 English. "
            "Speak naturally in Sinhala script. Never say 'wrong' or 'incorrect'. "
            "Use emojis. Keep everything super safe and happy!\n"
        )

    def _generate(self, prompt: str) -> str:
        """
        Generates content using the configured Gemini model.
        Now simplified to use the single, standardized client method.
        """
        try:
            # Use the safety settings to reduce the chance of blocks for harmless content.
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]
            resp = self.model.generate_content(prompt, safety_settings=safety_settings)
            # Check if the response has text, otherwise handle potential blocks/empty responses
            if resp.parts:
                return resp.text
            else:
                # This can happen if the content is blocked despite safety settings.
                # Log or handle as needed.
                return "[Gemini Error: No content generated. The prompt might have been blocked.]"
        except Exception as e:
            # Log the full error for debugging
            print(f"An exception occurred in _generate: {e}")
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

    def explain_word(self, word: str, context: List[Dict[str, str]], kid_safe: bool = False) -> str:
        """Generate a detailed, structured explanation for a word."""
        context_str = "\n".join([f"- {c['sinhala']} ({c['english']})" for c in context])
        
        if kid_safe:
            persona_prompt = self._kid_guidelines() + (
                f"\n**Task:** Explain the word '{word}' for a 5-8 year old child in a simple, happy, and encouraging way."
            )
            output_format = '''
            **Output Format:**
            You MUST respond with ONLY a single, valid JSON object. Do not include any other text or markdown formatting like ```json. The JSON object should have the following keys:

            {{
              "word": "{word}",
              "explanation": "A super simple, one-sentence explanation of what the word means. Use words a child can easily understand.",
              "example": "A very simple example sentence. For example: 'The [word] is big.'",
              "fun_fact": "A short, fun fact about the word or concept. Make it exciting!"
            }}
            '''.format(word=word)
        else:
            persona_prompt = "**Persona:** You are a friendly and knowledgeable language tutor. Your goal is to provide a clear, comprehensive, and encouraging explanation of a Sinhala or English word."
            output_format = '''
            **Output Format:**
            Provide a detailed explanation in the following structure. Use Markdown for formatting.
            **must start with this: "බලන්න ඔයා මේ වචනෙ දන්නව ද කියල 🙈"**

            ### 📖 Word: {word}

            **1. Definition:** : must start with this: "ඉංග්‍රීසි වචන වලට අපි කියන්නේ English words. ඔයා දන්නව ද ඒ වචන වල අර්ථය එහෙමත් නැතිනම් තේරුම කියන්නේ meaning කියල? 🙈
                    එහෙනම් බලන්න මේ වචනෙ අර්ථය. 
                    ඉතින් මේ වචනෙ තේරුම තමයි…. 👀"
            *   Start with a clear and concise definition of the word.

            **2. Example Sentences:** : must start with this: "උදාහරණ වාක්‍ය කියන්නේ example sentences කියල. 👩🏻‍🏫මෙන්න මේ විදිහට ඔයාට මේ වචනය පාවිච්චි කරන්න පුළුවන්. 😃
                බලන්න මේ වචනෙ උදාහරණ වාක්‍ය දෙකක්. 🤓👩🏻‍🏫"
            *   **Simple:** Provide one simple sentence showing the word in use.
            *   **Complex:** Provide a second, more complex sentence that demonstrates a deeper or more nuanced use of the word.

            **3. Synonyms & Antonyms:** 
            *   **Synonyms:** : must start with :"දැන් අපි බලමු ද මේ වචනය වෙනුවට අපිට පාවිච්චි කරන්න පුළුවන් වෙනත් වචන මොනව ද කියලා …… "
                    "එහෙමත් නැත්නම් සමාන පද 🤓"
                    List 2-3 words that have a similar meaning.
            *   **Antonyms:** : must start with :"දැන් අපි බලමු ද මේ වචනයට විරුද්ධ අර්ථයක් තියෙන වචන මොනව ද කියලා …… "
                    "එහෙමත් නැත්නම් විරුද්ධ පද 🤓       "
                    List 2-3 words that have the opposite meaning.

            **4. Fun Fact / Etymology:** must start with this: "මේ වචනය ගැන මතක තියාගන්න පහසු වෙන්න පුංචි විනෝදජනක කරුණු කීපයක් දැන් අපි බලමු. 😃🙈 
                අපිට වචන වල අරුත් හොයාගන්න පුළුවන් විදියක් තියෙනව 🙈. ඒක නම් වචන වල ඉතිහාසය හොයාගන්න එකයි. 🤓👩🏻‍🏫"
            *   Share a brief, interesting fact about the word's origin, usage, or cultural context. Make it memorable!
            
            **5. Sinhala translation:** : must start with this: "ඔයාට පුළුවන් අපි මේ ඉගෙනගත්ත හැමදේම නැවත සිංහලෙන් කියවලා තහවුරු කරගන්න. 😊 පහතින් ඔයාට සිංහල පරිවර්තනය බලාගන්න පුළුවන් 👩‍🏫🧚‍♀ 🙈👀
            *   Provide the Sinhala translation of the above content we provided about the word.
            '''.format(word=word)

            

        prompt = f"""
        {persona_prompt}

        **Context from Vocabulary:**
        Here are some related words from the dictionary. Use them to understand the context, but focus your explanation ONLY on the requested word "{word}".
        {context_str}

        {output_format}
        """
        response_text = self._generate(prompt)
        if kid_safe:
            return self._clean_json_response(response_text)
        return response_text

    def kid_explain(self, word: str, context: List[Dict[str, str]]) -> str:
        """Generate a simple, kid-friendly explanation in a structured JSON format."""
        return self.explain_word(word, context, kid_safe=True)

    def generate_quiz(self, items: List[Dict[str, str]], n: int = 5, words_only: bool = True, kid_safe: bool = False) -> List[Dict[str, str]]:
        examples = "\n".join([f"- {it['sinhala']} → {it['english']}" for it in items[:12]])
        guidance = "Create a Sinhala→English quiz using only WORD pairs. If any item is a sentence, extract the main word. Return clean JSON list of objects with keys: sinhala, answer"
        prompt = f"{guidance}\n\nExamples:\n{examples}\n\nGenerate {n} questions:"
        if kid_safe:
            prompt = self._kid_guidelines() + prompt
        text = self._generate(prompt)
        try:
            # Adding a fallback to clean the response, in case the LLM wraps it in markdown
            cleaned_text = self._clean_json_response(text)
            data = json.loads(cleaned_text)
            return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            # If JSON is still invalid, fallback to the simple list
            return [{"sinhala": it["sinhala"], "answer": it["english"]} for it in items[:n]]

    def answer_with_context(self, question: str, context: List[Dict[str, str]], style: str = "concise", kid_safe: bool = False) -> str:
        corpus = "\n".join([f"- Sinhala: {c.get('sinhala','')}\n  English: {c.get('english','')}" for c in context[:10]])
        prompt = (
            f"Answer using ONLY this corpus. If not found, say 'කණගාටුයි මම ඒ ගැන දන්නෙ නැහැ 😓'. Keep answer {style}.\n\n"
            f"Corpus:\n{corpus}\n\nQuestion: {question}"
        )
        if kid_safe:
            prompt = self._kid_guidelines() + prompt
        return self._generate(prompt)

    # --- Kid-friendly helpers ---
    def moderate_text(self, text: str) -> Dict[str, Any]:
        prompt = f'Classify as JSON {{"safe": bool, "reasons": [str]}}. Unsafe if violence, sex, hate, drugs, swearing, self-harm.\nText: {text}'
        raw = self._generate(prompt)
        try:
            return json.loads(self._clean_json_response(raw))
        except:
            return {"safe": True, "reasons": []}

    def kid_feedback(self, user_answer: str, correct_answer: str) -> str:
        
        prompt = (
            f"{self._kid_guidelines()}"
            f"User said: {user_answer}\nCorrect: {correct_answer}\n"
            "Give warm, encouraging feedback in Sinhala with emoji. Never say wrong!"
        )
        return self._generate(prompt)

    def kid_story(self, words: List[str]) -> str:
        """Generate a short, simple story for kids using a list of words."""
        words_str = ", ".join(words)
        prompt = f"""
        **Persona:** You are a magical storyteller for kids. Your stories are simple, fun, and always have a happy ending.

        **Task:** Write a very short story (about 5-7 sentences) for a 5-8 year old child. The story MUST include all of the following words: **{words_str}**.

        **Instructions:**
        1.  Weave all the words from the list naturally into the story.
        2.  The story should have a clear beginning, a middle, and a happy end.
        3.  Keep the sentences short and easy to understand.
        4.  Make the story imaginative and cheerful!
        5.  The story must start with this "කොහොමද පුංචි දරුවො 😊 අපි අද ලස්සන පුංචි කතාවක් කියවමු ද🙈. 
            මුලින්ම අපි ඉංග්‍රීසියෙන් කතාව කියවලා ඉමු. 🤓👩🏻‍🏫 බලන්න කතාව තේරෙනව ද කියල 🧚‍♀. ඔයා දන්නෙ නැති වචන තියෙනව නම් dictionary page එකෙන් තේරුම බලන්නත් පුළුවන් 🙈"
        6. Then translate the entire story into Sinhala script, keeping it simple and fun. before the Sinhala story start these lines should be printed: 
            " WOW!! You did it 🎉 ඔයා නියමයිනෙ 😊 දැන් එහෙනම් බලමු ද අපි ඒ කතාව සිංහලෙන් 👀 බලන්න ඔයා තේරුම් ගත්තා හරි ද කියල "

        **Example Structure:**
        *   Once upon a time... (beginning)
        *   One day, something happened... (middle)
        *   In the end, everyone was happy... (end)
        """
        return self._generate(prompt)

    def summarize_session(self, words: List[str]) -> str:
        """Generates a summary of the words learned in the session."""
        if not words:
            return "You haven't learned any new words in this session yet. Ask for a 'lesson' to get started!"

        words_str = ", ".join(f"'{w}'" for w in words)
        prompt = f"""
        **Persona:** You are a friendly and encouraging language coach.

        **Task:** Create a brief, positive summary of the words the user has learned in this session. Congratulate them on their progress and encourage them to keep practicing.

        **Words Learned:** {words_str}

        **Instructions:**
        1.  Start by congratulating the user.
        2.  List the words they learned.
        3.  End with a warm, encouraging message to motivate them to continue their learning journey.
        4.  Keep the tone light, positive, and celebratory. Use emojis! 🎉

        **Example Output:**
        "Wow, you've had a great session! Look at all the new words you've learned: 'word1', 'word2', 'word3'. That's fantastic progress! Keep up the amazing work, and you'll be an English expert in no time. Keep learning! 🚀"
        """
        return self._generate(prompt)