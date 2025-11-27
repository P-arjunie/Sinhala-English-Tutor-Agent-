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

3) Run the app locally:

```powershell
streamlit run app.py
```

The app opens in your browser (usually http://localhost:8501).

## Data Format
Use a CSV with these columns:

```
sinhala,english,transliteration,pos,example_si,example_en
```

See `data/vocab.csv` for a sample.

## Deploy Options

### Streamlit Community Cloud (free and fast)
- Push this repo to GitHub.
- Go to https://share.streamlit.io/ and deploy
- Set the entry point to `app.py` and ensure `requirements.txt` is present.

### Azure App Service (container-based)
1) Build a container locally (optional) or use Azure build:
	- Create a `Dockerfile` (if you need it) and push to GitHub.
	- Configure App Service to build from your repo.
2) Alternatively, run on Azure Web Apps with startup command `streamlit run app.py --server.port 8000 --server.address 0.0.0.0`.

## Environment Variables
- `GOOGLE_API_KEY`: required for Gemini API.
- `KAGGLE_USERNAME` and `KAGGLE_KEY` or `%USERPROFILE%\.kaggle\kaggle.json` for Kaggle access.

## Notebook
The `Agentic_AI.ipynb` notebook can be used for experiments or data prep. The web app does not depend on the notebook.

## Notes
- Sinhala Unicode is supported out of the box in modern browsers. If you see tofu boxes, install Sinhala fonts on your system.
