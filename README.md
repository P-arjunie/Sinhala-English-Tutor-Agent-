# Sinhala–English Tutor Agent

A simple, hostable learning platform to help Sinhala-speaking students learn English. The app provides Sinhala and English words with transliteration, examples, and practice modes (dictionary, flashcards, quiz).

## Features
- Dictionary view with Sinhala, English, transliteration, part of speech, and examples
- Flashcards for step-by-step review
- Quiz mode (Sinhala → English)
- CSV upload to bring your own vocabulary

## Quick Start (Windows PowerShell)

1) Create and activate a virtual environment (optional but recommended):

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
setx GOOGLE_API_KEY "<your_google_api_key>"
setx KAGGLE_USERNAME "<your_kaggle_username>"
setx KAGGLE_KEY "<your_kaggle_key>"
```

2) Install dependencies:

```powershell
pip install -r requirements.txt
python data/kaggle_fetch.py
```

3) Run the Streamlit app locally (optional UI):

```powershell
streamlit run app.py
```

The app opens in your browser (usually http://localhost:8501).

## Backend API (FastAPI)

Run the backend (Gemini + Kaggle + vocab endpoints):

```powershell
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Environment options for Gemini API key:
- Preferred: set `GEMINI_API_KEY` in a root `.env` file:

```
GEMINI_API_KEY=your_gemini_api_key
# Optional: override model
GEMINI_MODEL=gemini-2.5-flash
```

- Or set it in your shell (persists):

```powershell
setx GEMINI_API_KEY "your_gemini_api_key"
```

Notes:
- We also support legacy `GOOGLE_API_KEY` with the older `google-generativeai` client.
- The backend prefers the new `google-genai` library when available and defaults to `gemini-2.5-flash`.

Restart the backend after changing env values.

Endpoints:
- `GET /health`
- `GET /vocab?limit=100`
- `GET /search?q=<query>&pos=<pos>&limit=100`
- `POST /translate` body `{ "text_si": "..." }`
- `POST /explain` body `{ "sinhala": "...", "english": "..." }`
- `POST /quiz` body `{ "n": 5 }`
- `POST /quiz` also supports `{ "mode": "words"|"sentences", "max_words": 2 }` (defaults to word-only)
- `POST /quiz/mcq` dataset-based multiple choice
- `POST /llm/answer` grounded answers using only dataset context
- Kid-safe mode (global):

Set these in `.env` to restrict LLM outputs for children:

```
KID_SAFE_MODE=1         # prepend kid-friendly guidelines to all LLM prompts
KID_SAFE_STRICT=0       # if 1, block responses flagged unsafe by moderation (returns 406)
```


### Kid-Friendly Endpoints
- `POST /kid/explain` → child-friendly bilingual explanation

	Example body:
	```json
	{ "english": "teacher", "sinhala": "ගුරු", "age": 8 }
	```

- `POST /kid/feedback` → encouraging one-line feedback

	```json
	{ "user_answer": "ticher", "correct_answer": "teacher" }
	```

- `POST /kid/story` → short cheerful story using given words

	```json
	{ "words": ["book", "school", "friend"], "sentences": 3 }
	```

- `POST /moderate/check` → simple moderation helper `{ "text": "..." }`

### Dictionary Enrichment (LLM)
- `POST /dictionary/enrich` → builds a clean learner's dictionary entry (definition, POS, examples EN/SI, synonyms)

	Example body:
	```json
	{
		"english": "teacher",
		"sinhala": "ගුරු",
		"level": "A1/A2"
	}
	```

- `GET /dictionary/enrich?q=teacher` → convenience GET for quick testing

## Frontend (Next.js)

1) Configure API URL (optional; defaults to http://localhost:8000):

```powershell
cd web
copy .env.local.example .env.local
# edit .env.local to set NEXT_PUBLIC_API_URL if needed
```

2) Install and run:

```powershell
npm install
npm run dev
```

Open http://localhost:3000

## Data Format
Use a CSV with these columns:

```
sinhala,english,transliteration,pos,example_si,example_en
```

See `data/vocab.csv` for a sample.

## Data: Clean and Filter

The raw dataset may include noisy rows (dialogue fragments, placeholder tokens like `[Unkown]/[Unknown]`, or overly long sentences). Clean it and export `data/vocab_clean.csv`:

```powershell
python data/clean_vocab.py
```

Options:
- `--input`: Input CSV path (default `data/vocab.csv`)
- `--output`: Output CSV path (default `data/vocab_clean.csv`)
- `--max-words`: Max words allowed in `sinhala` and `english` (default 20)
- `--keep-translit-placeholders`: Keep rows where transliteration contains placeholder tokens

The cleaner:
- Ensures `sinhala` contains Sinhala script.
- Limits word count for `sinhala` and `english`.
- Requires non-empty `sinhala` and `english`.
- Drops transliteration placeholders unless allowed.
- Normalizes spacing and deduplicates `(sinhala, english)` pairs.

## Deploy Options

### Streamlit Community Cloud (free and fast)

### Azure App Service (container-based)
1) Build a container locally (optional) or use Azure build:
	- Create a `Dockerfile` (if you need it) and push to GitHub.
	- Configure App Service to build from your repo.
2) Alternatively, run on Azure Web Apps with startup command `streamlit run app.py --server.port 8000 --server.address 0.0.0.0`.

## Environment Variables
 - `NEXT_PUBLIC_API_URL` (frontend): URL of FastAPI backend.
 - `KID_SAFE_MODE` (backend): Prepend kid-friendly guidelines to LLM prompts when `1`.
 - `KID_SAFE_STRICT` (backend): Block unsafe moderated responses (HTTP 406) when `1`.
 - `KID_SAFE_FILTER` (backend): When `1`, remove offensive/unsafe vocab rows before serving or using for quizzes.
 - `KID_SAFE_BANNED` (backend): Optional comma-separated extra banned terms for filtering (e.g. `violence,blood`).

### Kid-Safe Filtering
Enable dataset filtering to hide rows containing disallowed terms in Sinhala or English.

```
KID_SAFE_FILTER=1
KID_SAFE_BANNED=violent,terror
```

Default banned substrings (case-insensitive) include: `sex, sexual, fuck, fucking, tits, breast, kill, die, suicide, weapon, gun, drugs, drug`.
Filtering is applied at load time and again on `/vocab`, `/search`, and MCQ generation ensuring quizzes avoid unsafe words.

## Notebook

### Kaggle Dataset Selection
- Default dataset: `programmerrdai/sinhala-english-singlish-translation-dataset` (maps `Singlish` to `transliteration`).
- Override via env:

```powershell
setx KAGGLE_DATASET "programmerrdai/sinhala-english-singlish-translation-dataset"
```

Then fetch:

```powershell
python data/kaggle_fetch.py
```
The `Agentic_AI.ipynb` notebook can be used for experiments or data prep. The web app does not depend on the notebook.

### Notebook: Child Safety Pipeline
Add a cell describing safety:
1. Dataset normalization (removes placeholders)
2. Optional banned-term filtering (`KID_SAFE_FILTER=1`)
3. Prompt guidelines (`KID_SAFE_MODE`)
4. Post-generation moderation (`KID_SAFE_STRICT=1`)
5. Manual moderation endpoint `/moderate/check` for ad hoc screening.

This layered approach reduces exposure to inappropriate content while preserving educational value.

## Notes
- Sinhala Unicode is supported out of the box in modern browsers. If you see tofu boxes, install Sinhala fonts on your system.
