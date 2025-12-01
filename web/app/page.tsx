"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const styles = {
  container: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "16px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "24px",
    borderRadius: "12px",
    marginBottom: "24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  headerTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "16px",
  },
  controls: {
    display: "flex" as const,
    gap: "12px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  input: {
    padding: "10px 14px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    flex: 1,
    minWidth: "200px",
    fontFamily: "inherit",
  },
  button: {
    padding: "10px 16px",
    fontSize: "14px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "500",
    transition: "all 0.2s",
    backgroundColor: "#667eea",
    color: "white",
  },
  buttonSecondary: {
    backgroundColor: "#f0f0f0",
    color: "#333",
    border: "1px solid #ddd",
  },
  select: {
    padding: "10px 14px",
    fontSize: "14px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  checkbox: {
    display: "flex" as const,
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
  },
  content: {
    display: "grid" as const,
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    marginTop: "24px",
  },
  panel: {
    background: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  panelTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "16px",
    color: "#333",
  },
  listItem: {
    padding: "12px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    transition: "background 0.2s",
    borderRadius: "6px",
  },
  listItemHover: {
    backgroundColor: "#f5f5f5",
  },
  mcqOption: {
    padding: "12px 16px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    marginBottom: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
    backgroundColor: "#fff",
  },
  mcqOptionSelected: {
    borderColor: "#667eea",
    backgroundColor: "#f0f4ff",
  },
  mcqOptionCorrect: {
    borderColor: "#10b981",
    backgroundColor: "#d1fae5",
  },
  mcqOptionWrong: {
    borderColor: "#ef4444",
    backgroundColor: "#fee2e2",
  },
  loading: {
    color: "#667eea",
    fontStyle: "italic",
  },
  speechBtn: {
    background: "#f0f0f0",
    border: "1px solid #ddd",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  responsiveContent: {
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
    },
  },
} as any;

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

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Vocab[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Vocab | null>(null);
  const [explain, setExplain] = useState<string>("");
  const [enriched, setEnriched] = useState<EnrichedEntry | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [useLLMDictionary, setUseLLMDictionary] = useState(false);
  const [quiz, setQuiz] = useState<{ sinhala: string; answer: string }[]>([]);
  const [mode, setMode] = useState<"Dictionary" | "MCQ" | "Typing">("Dictionary");
  const [mcq, setMcq] = useState<Array<{ sinhala: string; transliteration?: string; pos?: string; options: string[]; answer_index: number; answer: string }>>([]);
  const [mcqIdx, setMcqIdx] = useState(0);
  const [mcqSel, setMcqSel] = useState<number | null>(null);
  const [typingIdx, setTypingIdx] = useState(0);
  const [typingAns, setTypingAns] = useState("");
  const [typingFeedback, setTypingFeedback] = useState<"idle" | "correct" | "wrong">("idle");

  const search = async () => {
    console.log('Search called with query:', q);
    console.log('API_URL:', API_URL);
    setLoading(true);
    
    // Switch to Dictionary mode to show search results
    setMode("Dictionary");
    
    try {
      const url = `${API_URL}/search`;
      const params = { q, limit: 100 };
      console.log('Making request to:', url, 'with params:', params);
      
      const response = await axios.get(url, { params });
      console.log('Search response:', response);
      
      const { data } = response;
      setRows(data);
      console.log('Search results:', data);
      
      // Auto-select first result for explanation; if none, explain the raw query
      if (Array.isArray(data) && data.length > 0) {
        console.log('Auto-selecting first result:', data[0]);
        onSelect(data[0]);
      } else {
        console.log('No results found, falling back to LLM explain');
        // Fallback: ask LLM directly about the search text
        setSelected({
          sinhala: q,
          english: q,
          transliteration: "",
          pos: "",
          example_si: "",
          example_en: "",
        });
        setAssistantLoading(true);
        setEnriched(null);
        setExplain("");
        try {
          if (useLLMDictionary) {
            const { data: enr } = await axios.get(`${API_URL}/dictionary/enrich`, { params: { q, level: "A1/A2" } });
            setEnriched(enr);
          } else {
            const { data: exp } = await axios.post(`${API_URL}/explain`, { sinhala: q, english: q });
            setExplain(exp?.explanation || "");
          }
        } catch (e: any) {
          const msg = e?.response?.data?.detail?.message || e?.message || "LLM error";
          setExplain(`Explain failed: ${msg}`);
        } finally {
          setAssistantLoading(false);
        }
      }
    } catch (e) {
      console.error('Search error:', e);
      alert(`Search failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    (async () => {
      const { data } = await axios.get(`${API_URL}/vocab`, { params: { limit: 50 } });
      setRows(data);
    })();
  }, []);

  // Ensure words are available when switching to Typing mode
  useEffect(() => {
    (async () => {
      if (mode === "Typing" && rows.length === 0) {
        try {
          const { data } = await axios.get(`${API_URL}/vocab`, { params: { limit: 50 } });
          setRows(data);
        } catch (e) {
          console.error(e);
        }
      }
    })();
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
    setAssistantLoading(true);
    try {
      if (useLLMDictionary) {
        const payload = {
          english: item.english,
          sinhala: item.sinhala,
          transliteration: item.transliteration,
          pos: item.pos,
          example_si: item.example_si,
          example_en: item.example_en,
          level: "A1/A2",
        };
        const { data } = await axios.post(`${API_URL}/dictionary/enrich`, payload);
        setEnriched(data as EnrichedEntry);
      } else {
        const { data } = await axios.post(`${API_URL}/explain`, { sinhala: item.sinhala, english: item.english });
        setExplain(data.explanation || "");
      }
    } catch (e: any) {
      if (useLLMDictionary) {
        const msg = e?.response?.data?.detail?.message || e?.message || "LLM error";
        setExplain(`Dictionary enrich failed: ${msg}`);
      } else {
        setExplain("LLM error. Ensure backend GEMINI_API_KEY is set.");
      }
    } finally {
      setAssistantLoading(false);
    }
  };

  const enrichNow = async () => {
    if (!selected) return;
    setAssistantLoading(true);
    setEnriched(null);
    try {
      const payload = {
        english: selected.english,
        sinhala: selected.sinhala,
        transliteration: selected.transliteration,
        pos: selected.pos,
        example_si: selected.example_si,
        example_en: selected.example_en,
        level: "A1/A2",
      };
      const { data } = await axios.post(`${API_URL}/dictionary/enrich`, payload);
      setEnriched(data as EnrichedEntry);
    } catch (e: any) {
      const msg = e?.response?.data?.detail?.message || e?.message || "LLM error";
      setExplain(`Dictionary enrich failed: ${msg}`);
    } finally {
      setAssistantLoading(false);
    }
  };

  const onQuiz = async () => {
    try {
      const { data } = await axios.post(`${API_URL}/quiz`, { n: 5 });
      setQuiz(data.questions || []);
    } catch (e) {
      console.error(e);
    }
  };

  const onMCQ = async () => {
    try {
      const { data } = await axios.post(`${API_URL}/quiz/mcq`, { n: 6, choices: 4 });
      setMcq(data || []);
      setMcqIdx(0);
      setMcqSel(null);
    } catch (e) {
      console.error(e);
    }
  };

  const speak = (text: string, lang: string = "en-US") => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      window.speechSynthesis.speak(utter);
    } catch {}
  };

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>📚 Sinhala–English Tutor</h1>
        <div style={styles.controls}>
          <input
            value={q}
            placeholder="🔍 Search Sinhala / English / Transliteration"
            onChange={(e) => setQ(e.target.value)}
            style={{ ...styles.input, flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          />
          <button type="button" onClick={search} disabled={loading} style={styles.button}>
            {loading ? '⏳ Searching…' : '🔎 Search'}
          </button>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={styles.select}>
            <option>Dictionary</option>
            <option>MCQ</option>
            <option>Typing</option>
          </select>
          <label style={styles.checkbox}>
            <input type="checkbox" checked={useLLMDictionary} onChange={(e) => setUseLLMDictionary(e.target.checked)} style={{ cursor: 'pointer' }} />
            <span>LLM Dictionary</span>
          </label>
          <button type="button" onClick={onQuiz} style={styles.button}>✍️ LLM Quiz</button>
          <button type="button" onClick={() => router.push('/mcq')} style={styles.button}>🎯 MCQ</button>
          <button type="button" onClick={() => router.push('/mcq?kid=1')} style={styles.button}>👶 Kid Mode</button>
        </div>
      </header>

      <div style={styles.content}>
        <div>
          <h3>{mode}</h3>
          {mode === 'Dictionary' && (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {rows.map((r, i) => (
                <li key={`${r.sinhala}-${i}`} style={{ padding: 8, borderBottom: '1px solid #eee', cursor: 'pointer' }}
                  onClick={() => onSelect(r)}>
                  <div>
                    <strong>{r.sinhala}</strong> — {r.english} <em style={{ color: '#888' }}>({r.pos})</em>
                    <button type="button" onClick={(e) => { e.stopPropagation(); speak(r.english, 'en-US'); }} style={{ marginLeft: 8 }}>🔊</button>
                  </div>
                  <div style={{ color: '#666', fontSize: 12 }}>{r.transliteration}</div>
                  <div style={{ color: '#444', fontSize: 12 }}>{r.example_si}</div>
                  <div style={{ color: '#444', fontSize: 12 }}>{r.example_en}</div>
                </li>
              ))}
            </ul>
          )}

          {mode === 'MCQ' && (
            <div>
              {mcq.length === 0 ? (
                <div>Click "MCQ Quiz" to generate questions.</div>
              ) : (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>{mcq[mcqIdx].sinhala}</strong> <em style={{ color: '#888' }}>({mcq[mcqIdx].transliteration || ''})</em>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {mcq[mcqIdx].options.map((opt, i) => {
                      const correct = mcq[mcqIdx].answer_index === i;
                      const chosen = mcqSel === i;
                      const bg = mcqSel == null ? '#fff' : chosen ? (correct ? '#d1fadf' : '#ffd6d6') : (correct ? '#e6ffed' : '#fff');
                      return (
                        <li key={i} style={{ padding: 8, border: '1px solid #eee', marginBottom: 8, background: bg }}
                            onClick={() => setMcqSel(i)}>
                          {opt}
                        </li>
                      );
                    })}
                  </ul>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => speak(mcq[mcqIdx].answer, 'en-US')}>🔊 English</button>
                    <button type="button" onClick={() => speak(mcq[mcqIdx].sinhala, 'si-LK')}>🔊 Sinhala</button>
                    <button type="button" onClick={() => { setMcqIdx((mcqIdx + 1) % mcq.length); setMcqSel(null); }}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'Typing' && (
            <div>
              <div style={{ marginBottom: 8, color: '#666' }}>Words loaded: {rows.length}</div>
              {rows.length === 0 ? (
                <div>
                  <div>No words loaded for Typing.</div>
                  <button style={{ marginTop: 8 }} onClick={async () => {
                    try {
                      const { data } = await axios.get(`${API_URL}/vocab`, { params: { limit: 50 } });
                      setRows(data);
                    } catch (e) { console.error(e); }
                  }}>Load 50 words</button>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>{rows[typingIdx % rows.length].sinhala}</strong>
                    <em style={{ color: '#888', marginLeft: 8 }}>{rows[typingIdx % rows.length].transliteration}</em>
                  </div>
                  <input
                    value={typingAns}
                    onChange={(e) => setTypingAns(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTypingCheck(); }}
                    placeholder="Type the English word"
                    style={{ padding: 8, width: '100%', marginBottom: 8, border: '1px solid #ccc', outline: 'none' }}
                  />
                  <div style={{ height: 22, marginBottom: 8, color: typingFeedback === 'correct' ? '#0a7' : typingFeedback === 'wrong' ? '#c00' : '#999' }}>
                    {typingFeedback === 'correct' ? '✓ Correct' : typingFeedback === 'wrong' ? '✗ Try again' : 'Press Enter or click Check'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => speak(rows[typingIdx % rows.length].english, 'en-US')}>🔊 Hear</button>
                    <button type="button" onClick={handleTypingCheck} disabled={!typingAns.trim()}>Check</button>
                    <button type="button" onClick={() => { setTypingIdx(typingIdx + 1); setTypingAns(''); setTypingFeedback('idle'); }}>Skip</button>
                    <button type="button" onClick={() => { setTypingIdx(0); setTypingAns(''); setTypingFeedback('idle'); }}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <h3>Assistant</h3>
          {selected ? (
            <div>
              <div style={{ marginBottom: 8 }}>
                <strong>{selected.sinhala}</strong> — {selected.english}
              </div>
              {assistantLoading ? (
                <div>Loading…</div>
              ) : useLLMDictionary && enriched ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div><strong>Definition:</strong> {enriched.definition_en}</div>
                  {enriched.synonyms_en && enriched.synonyms_en.length > 0 && (
                    <div><strong>Synonyms:</strong> {enriched.synonyms_en.join(', ')}</div>
                  )}
                  <div>
                    <strong>Examples (EN):</strong>
                    <ul style={{ margin: '6px 0' }}>
                      {enriched.examples_en?.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                  <div><strong>සිංහල විස්තරය:</strong> {enriched.explanation_si}</div>
                  {enriched.examples_si && enriched.examples_si.length > 0 && (
                    <div>
                      <strong>උදාහරණ (SI):</strong>
                      <ul style={{ margin: '6px 0' }}>
                        {enriched.examples_si?.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  )}
                  {enriched.notes_si && <div><strong>සටහන්:</strong> {enriched.notes_si}</div>}
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{explain || 'Click a word to get an explanation.'}</div>
              )}

              {!useLLMDictionary && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={enrichNow}>Enrich Dictionary Entry (LLM)</button>
                </div>
              )}
            </div>
          ) : (
            <div>Select a word to view explanation.</div>
          )}

          <h3 style={{ marginTop: 24 }}>LLM Quiz</h3>
          {quiz.length === 0 ? (
            <div>Click "LLM Quiz" to create questions.</div>
          ) : (
            <ol>
              {quiz.map((qz, idx) => (
                <li key={idx}>
                  <div><strong>{qz.sinhala}</strong></div>
                  <details>
                    <summary>Show Answer</summary>
                    <div>{qz.answer}</div>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </main>
  );
}
