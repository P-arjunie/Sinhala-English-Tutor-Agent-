"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface McqItem {
  sinhala: string;
  transliteration?: string;
  pos?: string;
  options: string[];
  answer_index: number;
  answer: string;
  answer_explanation?: string | null;
}

const styles = {
  wrap: { maxWidth: 900, margin: "0 auto", padding: "20px", fontFamily: "Segoe UI, sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  h1: { fontSize: 26, margin: 0, fontWeight: 700 },
  kidH1: { fontSize: 30, margin: 0, fontWeight: 800, color: "#ff7b42" },
  btn: { padding: "10px 16px", background: "#667eea", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 },
  btnGhost: { padding: "10px 16px", background: "#f5f5f5", color: "#333", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  card: { background: "#fff", border: "1px solid #ececec", borderRadius: 12, padding: 20, boxShadow: "0 2px 6px rgba(0,0,0,0.06)", marginBottom: 20 },
  word: { fontSize: 22, fontWeight: 600, margin: 0 },
  translit: { fontSize: 12, color: "#666", marginTop: 4 },
  progress: { fontSize: 11, color: "#999", marginTop: 8 },
  option: { padding: "14px 16px", border: "2px solid #e0e0e0", borderRadius: 10, marginBottom: 10, cursor: "pointer", background: "#fff", fontWeight: 500, transition: "all .15s" },
  kidOption: { padding: "18px 20px", border: "3px solid #ffd8bd", borderRadius: 16, marginBottom: 14, cursor: "pointer", background: "#fff9f5", fontWeight: 600, fontSize: 18 },
  explanationBox: { minHeight: 48, fontSize: 13, color: "#444", background: "#f9f9f9", borderRadius: 8, padding: "8px 12px", marginTop: 8 },
  kidExplanationBox: { minHeight: 64, fontSize: 15, color: "#333", background: "#fff3e6", borderRadius: 14, padding: "12px 16px", marginTop: 10, fontWeight: 500 },
  inlineHint: { fontSize: 12, color: "#888", marginTop: 4 },
  bar: { display: "flex", gap: 10, flexWrap: "wrap" as any, marginTop: 10 },
  pill: { padding: "10px 14px", background: "#ffdd57", color: "#333", fontWeight: 600, borderRadius: 24, cursor: "pointer", fontSize: 14, border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,0.12)" },
};

export default function MCQPage() {
  const [mcq, setMcq] = useState<McqItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [explainCache, setExplainCache] = useState<Record<number, string>>({});
  const [explainLoading, setExplainLoading] = useState(false);
  const [kidMode, setKidMode] = useState(false);
  const [kidCache, setKidCache] = useState<Record<number, any>>({});
  const [story, setStory] = useState<string>("");
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string>("");
  const router = useRouter();

  const fetchMCQ = async (simpleOverride?: boolean) => {
    setLoading(true);
    try {
      const simple = typeof simpleOverride === 'boolean' ? simpleOverride : kidMode;
      const { data } = await axios.post(`${API_URL}/quiz/mcq`, { n: 6, choices: 4, explain: true, simple });
      setMcq(data || []);
      setIdx(0);
      setSel(null);
      setStory("");
      setStoryError("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const searchParams = useSearchParams();
  useEffect(() => {
    const kid = (searchParams?.get('kid') || '').toLowerCase();
    const wantKid = kid === '1' || kid === 'true' || kid === 'yes';
    if (wantKid) setKidMode(true);
    fetchMCQ(wantKid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Auto kid explanation fetch
    if (kidMode && mcq.length > 0 && kidCache[idx] == null) {
      const run = async () => {
        try {
          const { data } = await axios.post(`${API_URL}/kid/explain`, { english: mcq[idx].answer, sinhala: mcq[idx].sinhala, age: 8 });
          setKidCache(prev => ({ ...prev, [idx]: data }));
        } catch (e) {
          setKidCache(prev => ({ ...prev, [idx]: { definition_en: "Kid explain error", explanation_si: "" } }));
        }
      };
      run();
    }
  }, [kidMode, idx, mcq]);

  const fetchExplanation = async (i: number) => {
    if (explainCache[i]) return;
    setExplainLoading(true);
    try {
      const { sinhala, answer } = mcq[i];
      const { data } = await axios.post(`${API_URL}/explain`, { sinhala, english: answer });
      setExplainCache(prev => ({ ...prev, [i]: data.explanation || "" }));
    } catch (e: any) {
      setExplainCache(prev => ({ ...prev, [i]: `Error: ${e?.message || 'explain failed'}` }));
    } finally {
      setExplainLoading(false);
    }
  };

  const next = () => {
    const n = (idx + 1) % mcq.length;
    setIdx(n);
    setSel(null);
    if (!kidMode) fetchExplanation(n);
  };

  useEffect(() => {
    if (!kidMode && mcq.length > 0) fetchExplanation(idx);
  }, [mcq, kidMode]);

  useEffect(() => {
    if (kidMode && mcq.length > 0 && !story && !storyLoading) {
      genStory();
    }
  }, [kidMode, mcq]);

  // If user toggles kid mode, refresh questions to match difficulty
  useEffect(() => {
    if (mcq.length > 0) {
      fetchMCQ();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidMode]);

  const speak = (t: string, lang: string) => {
    try { const u = new SpeechSynthesisUtterance(t); u.lang = lang; window.speechSynthesis.speak(u); } catch {}
  };

  const genStory = async () => {
    if (!kidMode) return;
    const words = Array.from(new Set(mcq.map(x => (x.answer || "").toString().trim()).filter(Boolean))).slice(0, 6);
    if (words.length === 0) return;
    setStoryLoading(true);
    setStoryError("");
    try {
      const { data } = await axios.post(`${API_URL}/kid/story`, { words, sentences: 3 });
      setStory((data?.story || "").trim());
    } catch (e: any) {
      setStoryError(e?.message || "Story failed");
    } finally {
      setStoryLoading(false);
    }
  };

  const current = mcq[idx];

  return (
    <main style={styles.wrap}>
      <div style={styles.header}>
        <h1 style={kidMode ? styles.kidH1 : styles.h1}>{kidMode ? '👧🎯 තේරීම (MCQ)' : 'MCQ Quiz'}</h1>
        <div style={styles.bar}>
          <div style={styles.pill} onClick={() => router.push('/')}>🏠 {kidMode ? 'මුල් පිටුව' : 'Home'}</div>
          <div style={styles.pill} onClick={() => fetchMCQ()}>🔄 {kidMode ? 'නව' : 'Regenerate'}</div>
          <div style={styles.pill} onClick={() => setKidMode(!kidMode)}>{kidMode ? '👶 Kid ON' : '👶 Kid OFF'}</div>
          {kidMode && <div style={styles.pill} onClick={genStory}>📖 කතාව</div>}
        </div>
      </div>

      {loading && <div style={{ padding: 20 }}>⏳ Loading questions…</div>}

      {!loading && mcq.length === 0 && (
        <div style={{ padding: 20 }}>No questions generated.</div>
      )}

      {!loading && mcq.length > 0 && (
        <div style={styles.card}>
          <p style={styles.word}>{current.sinhala}</p>
          {current.transliteration && <div style={styles.translit}>{current.transliteration}</div>}
          <div style={styles.progress}>Question {idx + 1} / {mcq.length}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0' }}>
            {current.options.map((opt, i) => {
              const correct = current.answer_index === i;
              const chosen = sel === i;
              let style: any = kidMode ? { ...styles.kidOption } : { ...styles.option };
              if (sel != null) {
                if (chosen && correct) style = { ...style, borderColor: '#10b981', background: kidMode ? '#d1fae5' : '#d1fae5' };
                else if (chosen && !correct) style = { ...style, borderColor: '#ef4444', background: kidMode ? '#fee2e2' : '#fee2e2' };
                else if (correct) style = { ...style, borderColor: '#10b981', background: kidMode ? '#d1fae5' : '#d1fae5' };
              }
              return (
                <li key={i} style={style} onClick={() => sel == null && setSel(i)}>
                  {opt}{sel != null && correct && ' ✓'}
                </li>
              );
            })}
          </ul>
          <div style={kidMode ? styles.kidExplanationBox : styles.explanationBox}>
            {kidMode ? (
              kidCache[idx] ? (
                <span>🧒 {kidCache[idx].definition_en} {kidCache[idx].explanation_si && `\nසිංහල: ${kidCache[idx].explanation_si}`}</span>
              ) : (
                <span style={{ color: '#999' }}>Kid explanation loading…</span>
              )
            ) : (
              current.answer_explanation ? current.answer_explanation : (explainLoading ? '⏳ Loading…' : (explainCache[idx] || 'Explanation pending…'))
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={styles.btnGhost as any} onClick={() => speak(current.answer, 'en-US')}>🔊 English</button>
            <button type="button" style={styles.btnGhost as any} onClick={() => speak(current.sinhala, 'si-LK')}>🔊 Sinhala</button>
            <button type="button" style={styles.btn as any} onClick={next}>Next →</button>
          </div>
          {!kidMode && <div style={styles.inlineHint}>💡 Select an option to reveal the correct one.</div>}
        </div>
      )}

      {kidMode && (
        <div style={{ ...styles.card, background: '#fffaf3' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📖 කුඩා කථාව</div>
          {storyLoading ? (
            <div>⏳ කථාව බනිනවා…</div>
          ) : story ? (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.5 }}>{story}</div>
          ) : storyError ? (
            <div style={{ color: '#c00' }}>{storyError}</div>
          ) : (
            <div style={{ color: '#888' }}>කථාවක් බන්න "කතාව" क्लिक කරන්න.</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" style={styles.btnGhost as any} onClick={() => story && speak(story, 'en-US')} disabled={!story}>🔊 Read</button>
            <button type="button" style={styles.btn as any} onClick={genStory} disabled={storyLoading}>🔄 New Story</button>
          </div>
        </div>
      )}
    </main>
  );
}
