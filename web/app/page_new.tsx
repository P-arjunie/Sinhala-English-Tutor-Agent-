"use client";
import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Vocab = {
  sinhala: string;
  english: string;
  transliteration: string;
  pos: string;
  example_si: string;
  example_en: string;
};

type EnrichedEntry = {
  english: string;
  sinhala: string;
  transliteration: string;
  pos: string;
  definition_en: string;
  examples_en: string[];
  explanation_si: string;
  examples_si: string[];
  synonyms_en: string[];
  notes_si: string;
};

const styles = {
  container: { maxWidth: 1400, margin: "0 auto", padding: "16px", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  header: { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white", padding: "24px", borderRadius: "12px", marginBottom: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
  headerTitle: { margin: 0, fontSize: "28px", fontWeight: "bold" as const, marginBottom: "16px" },
  controls: { display: "flex" as const, gap: "12px", flexWrap: "wrap" as const, alignItems: "center" },
  input: { padding: "10px 14px", fontSize: "14px", border: "1px solid #ddd", borderRadius: "6px", flex: 1, minWidth: "200px", fontFamily: "inherit" },
  button: { padding: "10px 16px", fontSize: "14px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 500 as const, backgroundColor: "#667eea", color: "white", transition: "all 0.2s" },
  buttonSecondary: { backgroundColor: "#f0f0f0", color: "#333", border: "1px solid #ddd" },
  select: { padding: "10px 14px", fontSize: "14px", border: "1px solid #ddd", borderRadius: "6px", fontFamily: "inherit", cursor: "pointer" },
  checkbox: { display: "flex" as const, alignItems: "center", gap: "8px", padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "6px", color: "white", cursor: "pointer" },
  content: { display: "grid" as const, gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" },
  panel: { background: "white", border: "1px solid #e0e0e0", borderRadius: "10px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
  panelTitle: { fontSize: "18px", fontWeight: "bold" as const, marginBottom: "16px", color: "#333" },
  listItem: { padding: "12px", borderBottom: "1px solid #f0f0f0", cursor: "pointer", transition: "background 0.2s", borderRadius: "6px" },
  mcqOption: { padding: "12px 16px", border: "2px solid #e0e0e0", borderRadius: "8px", marginBottom: "8px", cursor: "pointer", transition: "all 0.2s", backgroundColor: "#fff" },
  speechBtn: { background: "#f0f0f0", border: "1px solid #ddd", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "14px" },
  // Kid mode enhanced styles
  kidControlBar: { width: "100%", display: "flex", flexWrap: "wrap" as const, gap: "10px", marginTop: "4px" },
  kidModeBtn: { flex: "1 1 140px", padding: "16px 18px", fontSize: "18px", fontWeight: 600, borderRadius: "14px", border: "3px solid #fff", background: "linear-gradient(135deg,#ffaf7b,#ff865e)", color: "#222", cursor: "pointer", boxShadow: "0 4px 8px rgba(0,0,0,0.15)", transition: "transform .15s" },
  kidModeBtnInactive: { background: "linear-gradient(135deg,#ffe8d1,#ffd8bd)", color: "#555", border: "3px solid #fff" },
  kidTogglePill: { padding: "10px 16px", background: "#ffdd57", color: "#3b3b3b", fontWeight: 600, borderRadius: "24px", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,0.15)" },
  kidHeaderTitle: { margin: 0, fontSize: "32px", fontWeight: 700, letterSpacing: ".5px", textShadow: "1px 2px 0 rgba(0,0,0,0.15)" },
  kidListItem: { padding: "16px", border: "3px solid #ffd8bd", background: "#fff9f5", borderRadius: "14px", marginBottom: "10px", cursor: "pointer", transition: "background .2s, transform .1s" },
  kidListItemActive: { background: "#ffe2cc", transform: "scale(1.01)", borderColor: "#ffaf7b" },
  kidAssistantPanelTitle: { fontSize: "20px", fontWeight: 700, color: "#ff7b42", marginBottom: "12px" },
};

export default function HomePage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Vocab[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Vocab | null>(null);
  const [explain, setExplain] = useState("");
  const [enriched, setEnriched] = useState<EnrichedEntry | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [useLLMDictionary, setUseLLMDictionary] = useState(false);
  const [quiz, setQuiz] = useState<{ sinhala: string; answer: string; explanation?: string; enriched?: EnrichedEntry | null }[]>([]);
  const [quizSelectedIdx, setQuizSelectedIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<"Dictionary" | "MCQ" | "Typing">("Dictionary");
  const [mcq, setMcq] = useState<any[]>([]);
  const [mcqIdx, setMcqIdx] = useState(0);
  const [mcqSel, setMcqSel] = useState<number | null>(null);
  const [mcqEnriched, setMcqEnriched] = useState<EnrichedEntry | null>(null);
  const [mcqEnrichLoading, setMcqEnrichLoading] = useState(false);
  const [mcqExplanation, setMcqExplanation] = useState<string>("");
  const [mcqExplainLoading, setMcqExplainLoading] = useState(false);
  const [mcqExplainCache, setMcqExplainCache] = useState<Record<number, string>>({});
  const [showMcqAssistant, setShowMcqAssistant] = useState(true);
  const [typingIdx, setTypingIdx] = useState(0);
  const [typingAns, setTypingAns] = useState("");
  const [typingFeedback, setTypingFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  // Kid Mode state & caches
  const [kidMode, setKidMode] = useState(false);
  const [kidExplain, setKidExplain] = useState<any | null>(null);
  const [kidExplainLoading, setKidExplainLoading] = useState(false);
  const [kidMcqExplainCache, setKidMcqExplainCache] = useState<Record<number, any>>({});
  const [kidQuizExplainCache, setKidQuizExplainCache] = useState<Record<number, any>>({});
  const [mcqAutoRequested, setMcqAutoRequested] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/search`, { params: { q, limit: 100 } });
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data } = await axios.get(`${API_URL}/vocab`, { params: { limit: 50 } });
      setRows(data);
    })();
  }, []);

  // Auto-generate MCQs when entering MCQ mode if none loaded yet
  useEffect(() => {
    if (mode === 'MCQ') {
      if (mcq.length === 0 && !mcqAutoRequested) {
        onMCQ();
        setMcqAutoRequested(true);
      }
    } else {
      setMcqAutoRequested(false);
    }
  }, [mode]);

  const handleTypingCheck = () => {
    if (rows.length === 0) return;
    const curr = rows[typingIdx % rows.length];
    const correct = (curr.english || "").trim().toLowerCase();
    const user = typingAns.trim().toLowerCase();
    if (user && user === correct) {
      setTypingFeedback("correct");
      setTimeout(() => {
        setTypingIdx((v) => v + 1);
        setTypingAns("");
        setTypingFeedback("idle");
      }, 400);
    } else {
      setTypingFeedback("wrong");
      setTimeout(() => setTypingFeedback("idle"), 800);
    }
  };

  const onSelect = async (item: Vocab) => {
    setSelected(item);
    setEnriched(null);
    setExplain("");
    setKidExplain(null);
    setAssistantLoading(true);
    try {
      if (kidMode) {
        setKidExplainLoading(true);
        try {
          const { data } = await axios.post(`${API_URL}/kid/explain`, { english: item.english, sinhala: item.sinhala, age: 8 });
          setKidExplain(data);
        } catch (e: any) {
          setKidExplain({ definition_en: "Kid explanation error", explanation_si: e?.message || "Error" });
        } finally {
          setKidExplainLoading(false);
        }
      } else if (useLLMDictionary) {
        const payload = { english: item.english, sinhala: item.sinhala, transliteration: item.transliteration, pos: item.pos, example_si: item.example_si, example_en: item.example_en, level: "A1/A2" };
        const { data } = await axios.post(`${API_URL}/dictionary/enrich`, payload);
        setEnriched(data as EnrichedEntry);
      } else {
        const { data } = await axios.post(`${API_URL}/explain`, { sinhala: item.sinhala, english: item.english });
        setExplain(data.explanation || "");
      }
    } catch (e: any) {
      setExplain(useLLMDictionary ? `Error: ${e?.response?.data?.detail?.message || e?.message || "LLM error"}` : "LLM error. Ensure GEMINI_API_KEY is set.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const enrichNow = async () => {
    if (!selected) return;
    setAssistantLoading(true);
    try {
      const payload = { english: selected.english, sinhala: selected.sinhala, transliteration: selected.transliteration, pos: selected.pos, example_si: selected.example_si, example_en: selected.example_en, level: "A1/A2" };
      const { data } = await axios.post(`${API_URL}/dictionary/enrich`, payload);
      setEnriched(data as EnrichedEntry);
    } catch (e: any) {
      setExplain(`Error: ${e?.response?.data?.detail?.message || e?.message}`);
    } finally {
      setAssistantLoading(false);
    }
  };

  const onQuiz = async () => {
    try {
      const { data } = await axios.post(`${API_URL}/quiz`, { n: 5 });
      const questions = (data.questions || []).map((q: any) => ({ ...q, explanation: undefined, enriched: null }));
      setQuiz(questions);
      setQuizSelectedIdx(null);
    } catch (e) {
      console.error(e);
    }
  };

  const explainQuizAnswer = async (idx: number) => {
    if (idx < 0 || idx >= quiz.length) return;
    // Avoid refetch if already enriched/explained
    if (useLLMDictionary && quiz[idx].enriched) return;
    if (!useLLMDictionary && quiz[idx].explanation) return;
    try {
      if (useLLMDictionary) {
        const payload = { english: quiz[idx].answer, level: "A1/A2" };
        const { data } = await axios.post(`${API_URL}/dictionary/enrich`, payload);
        setQuiz((prev) => prev.map((q, i) => i === idx ? { ...q, enriched: data as EnrichedEntry } : q));
      } else {
        const { data } = await axios.post(`${API_URL}/explain`, { sinhala: quiz[idx].sinhala, english: quiz[idx].answer });
        setQuiz((prev) => prev.map((q, i) => i === idx ? { ...q, explanation: data.explanation || "" } : q));
      }
    } catch (e: any) {
      if (useLLMDictionary) {
        setQuiz((prev) => prev.map((q, i) => i === idx ? { ...q, explanation: `Error: ${e?.response?.data?.detail?.message || e?.message}` } : q));
      } else {
        setQuiz((prev) => prev.map((q, i) => i === idx ? { ...q, explanation: `Error: ${e?.response?.data?.detail?.message || e?.message}` } : q));
      }
    }
  };

  const selectQuiz = async (idx: number) => {
    setQuizSelectedIdx(idx);
    await explainQuizAnswer(idx);
    if (kidMode && !kidQuizExplainCache[idx]) {
      try {
        const q = quiz[idx];
        const { data } = await axios.post(`${API_URL}/kid/explain`, { english: q.answer, sinhala: q.sinhala, age: 8 });
        setKidQuizExplainCache(prev => ({ ...prev, [idx]: data }));
      } catch (e) {
        setKidQuizExplainCache(prev => ({ ...prev, [idx]: { definition_en: "Kid explanation error", explanation_si: "" } }));
      }
    }
  };

  const onMCQ = async () => {
    try {
      const { data } = await axios.post(`${API_URL}/quiz/mcq`, { n: 6, choices: 4, explain: true });
      setMcq(data || []);
      setMcqIdx(0);
      setMcqSel(null);
      setMcqEnriched(null);
      setMcqExplanation("");
      setMcqExplainCache({});
      setKidMcqExplainCache({});
      enrichMCQAnswer(0, data || []);
      explainMCQAnswer(0, data || []);
      if (kidMode) explainKidMCQAnswer(0, data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const enrichMCQAnswer = async (idx: number, mcqData: any[]) => {
    if (!mcqData || idx >= mcqData.length) return;
    setMcqEnrichLoading(true);
    try {
      const answer = mcqData[idx].answer;
      const payload = { english: answer, level: "A1/A2" };
      const { data } = await axios.post(`${API_URL}/dictionary/enrich`, payload);
      setMcqEnriched(data as EnrichedEntry);
    } catch (e) {
      setMcqEnriched(null);
    } finally {
      setMcqEnrichLoading(false);
    }
  };

  const explainMCQAnswer = async (idx: number, mcqData: any[]) => {
    if (!mcqData || idx >= mcqData.length) return;
    // Use cache if available
    if (mcqExplainCache[idx]) {
      setMcqExplanation(mcqExplainCache[idx]);
      return;
    }
    setMcqExplainLoading(true);
    try {
      const { sinhala, answer } = mcqData[idx];
      const { data } = await axios.post(`${API_URL}/explain`, { sinhala, english: answer });
      const exp = data.explanation || "";
      setMcqExplanation(exp);
      setMcqExplainCache(prev => ({ ...prev, [idx]: exp }));
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message || e?.message || "Explanation error";
      setMcqExplanation(`Error: ${msg}`);
      setMcqExplainCache(prev => ({ ...prev, [idx]: `Error: ${msg}` }));
    } finally {
      setMcqExplainLoading(false);
    }
  };

  const explainKidMCQAnswer = async (idx: number, mcqData: any[]) => {
    if (!kidMode || !mcqData || idx >= mcqData.length) return;
    if (kidMcqExplainCache[idx]) return;
    try {
      const { sinhala, answer } = mcqData[idx];
      const { data } = await axios.post(`${API_URL}/kid/explain`, { english: answer, sinhala, age: 8 });
      setKidMcqExplainCache(prev => ({ ...prev, [idx]: data }));
    } catch (e) {
      setKidMcqExplainCache(prev => ({ ...prev, [idx]: { definition_en: "Kid explanation error", explanation_si: "" } }));
    }
  };

  const speak = (text: string, lang: string = "en-US") => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      window.speechSynthesis.speak(utter);
    } catch {}
  };

  const kidLabel = (m: typeof mode) => {
    switch (m) {
      case "Dictionary": return "📖 ශබ්ද කෝෂය";
      case "MCQ": return "🎯 තේරීම";
      case "Typing": return "⌨️ ලියන්න";
      default: return m;
    }
  };

  const setModeKid = (m: "Dictionary" | "MCQ" | "Typing") => {
    setMode(m);
    // reset selections for clarity in kid mode
    setSelected(null);
    setQuizSelectedIdx(null);
  };

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        {kidMode ? (
          <h1 style={styles.kidHeaderTitle}>👧👦 සිංහල – English ඉගෙනගමු!</h1>
        ) : (
          <h1 style={styles.headerTitle}>📚 Sinhala–English Tutor</h1>
        )}
        <div style={kidMode ? { ...styles.kidControlBar } : styles.controls}>
          <input
            value={q}
            placeholder={kidMode ? "🔍 වචන සොයන්න" : "🔍 Search Sinhala / English / Transliteration"}
            onChange={(e) => setQ(e.target.value)}
            style={kidMode ? { ...styles.input, fontSize: 16, padding: "14px" } : { ...styles.input, flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          <button
            onClick={search}
            disabled={loading}
            style={kidMode ? { ...styles.button, padding: "14px 22px", fontSize: 18, fontWeight: 600, background: "#ff7b42" } : styles.button}
          >{loading ? (kidMode ? '⏳' : '⏳ Searching…') : (kidMode ? '🔎 සොයන්න' : '🔎 Search')}</button>
          {kidMode ? (
            <>
              <button
                onClick={() => setModeKid("Dictionary")}
                style={{ ...styles.kidModeBtn, ...(mode === 'Dictionary' ? {} : styles.kidModeBtnInactive) }}
              >{kidLabel("Dictionary")}</button>
              <button
                onClick={() => setModeKid("MCQ")}
                style={{ ...styles.kidModeBtn, ...(mode === 'MCQ' ? {} : styles.kidModeBtnInactive) }}
              >{kidLabel("MCQ")}</button>
              <button
                onClick={() => setModeKid("Typing")}
                style={{ ...styles.kidModeBtn, ...(mode === 'Typing' ? {} : styles.kidModeBtnInactive) }}
              >{kidLabel("Typing")}</button>
              <div style={styles.kidTogglePill} onClick={() => setKidMode(false)}>
                👶 Kid Mode: ON
              </div>
              <div style={styles.kidTogglePill} onClick={() => setUseLLMDictionary(!useLLMDictionary)}>
                {useLLMDictionary ? '🧠 ලේසී පරිභාෂක' : '🧪 LLM Dict'}
              </div>
              {mode === 'MCQ' && (
                <div style={styles.kidTogglePill} onClick={() => setShowMcqAssistant(!showMcqAssistant)}>
                  {showMcqAssistant ? '🤖 උදව් ON' : '🤖 උදව් OFF'}
                </div>
              )}
              <div style={styles.kidTogglePill} onClick={onQuiz}>✍️ Quiz</div>
              {/* MCQ generation pill removed; auto generation on mode switch */}
            </>
          ) : (
            <>
              <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={styles.select}>
                <option>Dictionary</option>
                <option>MCQ</option>
                <option>Typing</option>
              </select>
              <label style={styles.checkbox}>
                <input type="checkbox" checked={kidMode} onChange={(e) => setKidMode(e.target.checked)} />
                <span>Kid Mode</span>
              </label>
              {mode === 'MCQ' && (
                <label style={styles.checkbox}>
                  <input type="checkbox" checked={showMcqAssistant} onChange={(e) => setShowMcqAssistant(e.target.checked)} />
                  <span>Assistant</span>
                </label>
              )}
              <label style={styles.checkbox}>
                <input type="checkbox" checked={useLLMDictionary} onChange={(e) => setUseLLMDictionary(e.target.checked)} style={{ cursor: 'pointer' }} />
                <span>LLM Dict</span>
              </label>
              <button onClick={onQuiz} style={styles.button}>✍️ Quiz</button>
              {/* MCQ button removed; auto generation on mode switch */}
            </>
          )}
        </div>
      </header>

      <div style={styles.content}>
        <div>
          <div style={styles.panel}>
            <h3 style={kidMode ? styles.kidAssistantPanelTitle : styles.panelTitle}>{kidMode ? kidLabel(mode) : ((mode === 'Dictionary' && '📖') || (mode === 'MCQ' && '🎯') || (mode === 'Typing' && '⌨️'))} {kidMode ? '' : mode}</h3>

            {mode === 'Dictionary' && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {rows.length === 0 ? (
                  <li style={{ padding: '16px', color: '#999', textAlign: 'center' }}>No entries found</li>
                ) : (
                  rows.map((r, i) => {
                    const active = selected === r;
                    const baseStyle = kidMode ? styles.kidListItem : styles.listItem;
                    const styleMerged = kidMode ? { ...baseStyle, ...(active ? styles.kidListItemActive : {}) } : { ...baseStyle, backgroundColor: active ? '#f5f5f5' : 'transparent' };
                    return (
                    <li key={`${r.sinhala}-${i}`} style={styleMerged} onClick={() => onSelect(r)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: '4px' }}>
                            <strong style={{ fontSize: '16px', color: '#333' }}>{r.sinhala}</strong>
                            <span style={{ marginLeft: '12px', color: '#666' }}>→</span>
                            <span style={{ marginLeft: '12px', color: '#667eea', fontWeight: '500' }}>{r.english}</span>
                            {r.pos && <em style={{ marginLeft: '8px', color: '#999', fontSize: '12px' }}>({r.pos})</em>}
                          </div>
                          {r.transliteration && <div style={{ color: '#666', fontSize: '12px', marginBottom: '4px' }}>📝 {r.transliteration}</div>}
                          {(r.example_si || r.example_en) && <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>💬 {r.example_en || r.example_si}</div>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); speak(r.english, 'en-US'); }} style={styles.speechBtn} title="Speak English">🔊</button>
                      </div>
                    </li>
                  );})
                )}
              </ul>
            )}

            {mode === 'MCQ' && (
              <div>
                {mcq.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>⏳ Preparing word questions…</div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                      <strong style={{ fontSize: '16px', color: '#333' }}>{mcq[mcqIdx].sinhala}</strong>
                      {mcq[mcqIdx].transliteration && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{mcq[mcqIdx].transliteration}</div>}
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>Question {mcqIdx + 1} of {mcq.length}</div>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '16px' }}>
                      {mcq[mcqIdx].options.map((opt: string, i: number) => {
                        const correct = mcq[mcqIdx].answer_index === i;
                        const chosen = mcqSel === i;
                        let style: any = { ...styles.mcqOption };
                        if (mcqSel == null) {
                          style.cursor = 'pointer';
                        } else if (chosen) {
                          style = { ...style, borderColor: correct ? '#10b981' : '#ef4444', backgroundColor: correct ? '#d1fae5' : '#fee2e2' };
                        } else if (correct) {
                          style = { ...style, borderColor: '#10b981', backgroundColor: '#d1fae5' };
                        }
                        return (
                          <li key={i} style={style} onClick={() => mcqSel == null && setMcqSel(i)}>
                            {opt}
                            {mcqSel != null && correct && ' ✓'}
                          </li>
                        );
                      })}
                    </ul>
                    {/* Inline compact explanation */}
                    <div style={{ minHeight: '40px', marginBottom: '12px' }}>
                      {(() => {
                        if (kidMode) {
                          const kidObj = kidMcqExplainCache[mcqIdx];
                          if (!kidObj) return <span style={{ color: '#bbb', fontSize: '12px' }}>Kid answer will appear here</span>;
                          const compactKid = (kidObj.definition_en || '').length > 140 ? kidObj.definition_en.substring(0, 140) + '…' : kidObj.definition_en;
                          return <span style={{ fontSize: '12px', color: '#555' }}>🧒 {compactKid}</span>;
                        }
                        const raw = mcq[mcqIdx].answer_explanation || mcqExplainCache[mcqIdx] || mcqExplanation;
                        if (!raw) return <span style={{ color: '#bbb', fontSize: '12px' }}>Answer explanation will appear here</span>;
                        const compact = raw.length > 140 ? raw.substring(0, 140) + '…' : raw;
                        return <span style={{ fontSize: '12px', color: '#555' }}>💡 {compact}</span>;
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => speak(mcq[mcqIdx].answer, 'en-US')} style={{ ...styles.button, ...styles.buttonSecondary }}>🔊 EN</button>
                      <button onClick={() => speak(mcq[mcqIdx].sinhala, 'si-LK')} style={{ ...styles.button, ...styles.buttonSecondary }}>🔊 SI</button>
                      <button onClick={() => { const next = (mcqIdx + 1) % mcq.length; setMcqIdx(next); setMcqSel(null); enrichMCQAnswer(next, mcq); explainMCQAnswer(next, mcq); if (kidMode) explainKidMCQAnswer(next, mcq); }} style={styles.button}>Next →</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'Typing' && (
              <div>
                {rows.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <div style={{ color: '#999', marginBottom: '12px' }}>No words loaded for practice</div>
                    <button style={styles.button} onClick={async () => { try { const { data } = await axios.get(`${API_URL}/vocab`, { params: { limit: 50 } }); setRows(data); } catch (e) { } }}>Load 50 Words</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>{rows[typingIdx % rows.length].sinhala}</div>
                      {rows[typingIdx % rows.length].transliteration && <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{rows[typingIdx % rows.length].transliteration}</div>}
                      <div style={{ fontSize: '11px', color: '#999' }}>Progress: {typingIdx + 1} words</div>
                    </div>
                    <input value={typingAns} onChange={(e) => setTypingAns(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTypingCheck()} placeholder="Type the English word" style={{ ...styles.input, marginBottom: '12px', width: '100%' }} />
                    <div style={{ height: '32px', marginBottom: '12px', padding: '8px', borderRadius: '6px', textAlign: 'center', fontWeight: 500, color: typingFeedback === 'correct' ? '#10b981' : typingFeedback === 'wrong' ? '#ef4444' : '#999', backgroundColor: typingFeedback === 'correct' ? '#d1fae5' : typingFeedback === 'wrong' ? '#fee2e2' : '#f5f5f5' }}>
                      {typingFeedback === 'correct' ? '✓ Correct!' : typingFeedback === 'wrong' ? '✗ Try again' : 'Press Enter to check'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => speak(rows[typingIdx % rows.length].english, 'en-US')} style={{ ...styles.button, ...styles.buttonSecondary }}>🔊 Hear</button>
                      <button onClick={handleTypingCheck} disabled={!typingAns.trim()} style={styles.button}>Check</button>
                      <button onClick={() => { setTypingIdx(typingIdx + 1); setTypingAns(''); setTypingFeedback('idle'); }} style={{ ...styles.button, ...styles.buttonSecondary }}>Skip</button>
                      <button onClick={() => { setTypingIdx(0); setTypingAns(''); setTypingFeedback('idle'); }} style={{ ...styles.button, ...styles.buttonSecondary }}>Reset</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          {!(mode === 'MCQ' && !showMcqAssistant) && (
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>💡 Details & Assistant</h3>
            {mode === 'MCQ' ? (
              mcq.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>👆 Click "🎯 MCQ" to generate questions</div>
              ) : (
                <div>
                  <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                    <div><strong style={{ color: '#333' }}>Answer: {mcq[mcqIdx].answer}</strong></div>
                  </div>
                  {mcqEnrichLoading ? (
                    <div style={{ color: '#667eea', fontStyle: 'italic' }}>⏳ Loading…</div>
                  ) : mcqEnriched ? (
                    <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Definition</div>
                        <div style={{ color: '#333' }}>{mcqEnriched.definition_en}</div>
                      </div>
                      {mcqEnriched.synonyms_en?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Synonyms</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {mcqEnriched.synonyms_en.map((x: string, i: number) => <span key={i} style={{ backgroundColor: '#f0f4ff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>{x}</span>)}
                          </div>
                        </div>
                      )}
                      {mcqEnriched.examples_en?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Examples (EN)</div>
                          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                            {mcqEnriched.examples_en.map((x: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}
                          </ul>
                        </div>
                      )}
                      {mcqEnriched.explanation_si && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>සිංහල විස්තරය</div>
                          <div style={{ color: '#666' }}>{mcqEnriched.explanation_si}</div>
                        </div>
                      )}
                      {mcqEnriched.examples_si?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>උදාහරණ (SI)</div>
                          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                            {mcqEnriched.examples_si.map((x: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}
                          </ul>
                        </div>
                      )}
                      {mcqEnriched.notes_si && <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>📌 {mcqEnriched.notes_si}</div>}
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
                        {kidMode ? (
                          <div style={{ color: '#444', whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                            {(() => {
                              const kidObj = kidMcqExplainCache[mcqIdx];
                              if (!kidObj) return '🧒 Loading kid answer…';
                              return `🧒 ${kidObj.definition_en}\nසිංහල: ${kidObj.explanation_si || ''}`;
                            })()}
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Explanation</div>
                            <div style={{ color: '#444', whiteSpace: 'pre-wrap' }}>
                              {mcq[mcqIdx].answer_explanation ? mcq[mcqIdx].answer_explanation : (mcqExplainLoading ? '⏳ Loading…' : mcqExplanation || 'No explanation')}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontSize: '13px' }}>No enriched content available</div>
                  )}
                </div>
              )
            ) : selected ? (
              <div>
                <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                  <div><strong style={{ color: '#333' }}>{selected.sinhala}</strong> <span style={{ color: '#666' }}>→</span> <span style={{ color: '#667eea', fontWeight: '500' }}>{selected.english}</span></div>
                </div>
                {kidMode ? (
                  kidExplainLoading ? <div style={{ color: '#667eea', fontStyle: 'italic' }}>🧒 Loading…</div> : kidExplain ? (
                    <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ff9800', marginBottom: '4px', textTransform: 'uppercase' }}>Kid Definition</div>
                        <div style={{ color: '#333' }}>{kidExplain.definition_en}</div>
                      </div>
                      {kidExplain.examples_en?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ff9800', marginBottom: '4px', textTransform: 'uppercase' }}>Examples</div>
                          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                            {kidExplain.examples_en.map((x: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}
                          </ul>
                        </div>
                      )}
                      {kidExplain.explanation_si && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ff9800', marginBottom: '4px', textTransform: 'uppercase' }}>සිංහල</div>
                          <div style={{ color: '#666' }}>{kidExplain.explanation_si}</div>
                        </div>
                      )}
                    </div>
                  ) : <div style={{ color: '#999', fontSize: '13px' }}>No kid explanation</div>
                ) : assistantLoading ? (
                  <div style={{ color: '#667eea', fontStyle: 'italic' }}>⏳ Loading…</div>
                ) : useLLMDictionary && enriched ? (
                  <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Definition</div>
                      <div style={{ color: '#333' }}>{enriched.definition_en}</div>
                    </div>
                    {enriched.synonyms_en?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Synonyms</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {enriched.synonyms_en.map((x: string, i: number) => <span key={i} style={{ backgroundColor: '#f0f4ff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>{x}</span>)}
                        </div>
                      </div>
                    )}
                    {enriched.examples_en?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Examples (EN)</div>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                          {enriched.examples_en.map((x: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}
                        </ul>
                      </div>
                    )}
                    {enriched.explanation_si && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>සිංහල විස්තරය</div>
                        <div style={{ color: '#666' }}>{enriched.explanation_si}</div>
                      </div>
                    )}
                    {enriched.examples_si?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>උදාහරණ (SI)</div>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                          {enriched.examples_si.map((x: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}
                        </ul>
                      </div>
                    )}
                    {enriched.notes_si && <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>📌 {enriched.notes_si}</div>}
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#333', fontSize: '13px' }}>
                    {explain || (useLLMDictionary ? '⏳ Enrich this entry' : 'Explanation will appear here')}
                  </div>
                )}

                {!useLLMDictionary && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                    <button onClick={enrichNow} style={{ ...styles.button, width: '100%' }}>✨ Enrich Entry (LLM)</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
                👈 Select a word to view details<br />
                {quizSelectedIdx !== null && quiz[quizSelectedIdx] && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#667eea' }}>
                    Quiz answer selected: <strong>{quiz[quizSelectedIdx].answer}</strong>
                  </div>
                )}
              </div>
            )}
            {quizSelectedIdx !== null && quiz[quizSelectedIdx] && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e0e0e0' }}>
                <h4 style={{ margin: 0, marginBottom: '12px', fontSize: '15px', color: '#333' }}>🧠 Quiz Answer Explanation</h4>
                {kidMode ? (
                  kidQuizExplainCache[quizSelectedIdx] ? (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '13px', color: '#444' }}>
                      🧒 {kidQuizExplainCache[quizSelectedIdx].definition_en}
                      {kidQuizExplainCache[quizSelectedIdx].explanation_si && `\nසිංහල: ${kidQuizExplainCache[quizSelectedIdx].explanation_si}`}
                    </div>
                  ) : (
                    <div style={{ color: '#999', fontSize: '12px' }}>Loading kid explanation…</div>
                  )
                ) : useLLMDictionary && quiz[quizSelectedIdx].enriched ? (
                  <div style={{ display: 'grid', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Definition</div>
                      <div style={{ color: '#333' }}>{quiz[quizSelectedIdx].enriched!.definition_en}</div>
                    </div>
                    {quiz[quizSelectedIdx].enriched!.synonyms_en?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Synonyms</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {quiz[quizSelectedIdx].enriched!.synonyms_en.map((x: string, i: number) => <span key={i} style={{ backgroundColor: '#f0f4ff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>{x}</span>)}
                        </div>
                      </div>
                    )}
                    {quiz[quizSelectedIdx].enriched!.examples_en?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>Examples (EN)</div>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                          {quiz[quizSelectedIdx].enriched!.examples_en.map((x: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}
                        </ul>
                      </div>
                    )}
                    {quiz[quizSelectedIdx].enriched!.explanation_si && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>සිංහල විස්තරය</div>
                        <div style={{ color: '#666' }}>{quiz[quizSelectedIdx].enriched!.explanation_si}</div>
                      </div>
                    )}
                    {quiz[quizSelectedIdx].enriched!.examples_si?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#667eea', marginBottom: '4px', textTransform: 'uppercase' }}>උදාහරණ (SI)</div>
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                          {quiz[quizSelectedIdx].enriched!.examples_si.map((x: string, i: number) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}
                        </ul>
                      </div>
                    )}
                    {quiz[quizSelectedIdx].enriched!.notes_si && <div style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>📌 {quiz[quizSelectedIdx].enriched!.notes_si}</div>}
                  </div>
                ) : !useLLMDictionary && quiz[quizSelectedIdx].explanation ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#333', fontSize: '13px' }}>{quiz[quizSelectedIdx].explanation}</div>
                ) : (
                  <div style={{ color: '#999', fontSize: '12px' }}>Select a quiz item to load explanation.</div>
                )}
              </div>
            )}
          </div>
          )}

          <div style={{ ...styles.panel, marginTop: '20px' }}>
            <h3 style={styles.panelTitle}>✍️ LLM Quiz</h3>
            {quiz.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>👆 Click "✍️ Quiz" to generate</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                {quiz.map((qz, idx) => {
                  const selectedQuiz = quizSelectedIdx === idx;
                  return (
                    <li key={idx} style={{ marginBottom: '10px', padding: '10px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: selectedQuiz ? '#eef2ff' : '#fff', cursor: 'pointer' }} onClick={() => selectQuiz(idx)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#333' }}>{qz.sinhala}</strong>
                        <span style={{ fontSize: '11px', color: '#667eea' }}>{selectedQuiz ? 'Selected' : 'Click'}</span>
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#444' }}>Answer: <span style={{ color: '#667eea', fontWeight: 500 }}>{qz.answer}</span></div>
                      {selectedQuiz && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#333' }}>
                          {useLLMDictionary ? (
                            qz.enriched ? (
                              <span style={{ color: '#555' }}>Definition: {qz.enriched.definition_en}</span>
                            ) : (
                              <span style={{ color: '#999' }}>⏳ Loading enrichment…</span>
                            )
                          ) : qz.explanation ? (
                            <span style={{ color: '#555' }}>{qz.explanation.substring(0, 140)}{qz.explanation.length > 140 ? '…' : ''}</span>
                          ) : (
                            <span style={{ color: '#999' }}>⏳ Loading explanation…</span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
