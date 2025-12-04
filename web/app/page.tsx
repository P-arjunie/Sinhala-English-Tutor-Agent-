"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import ReactMarkdown from 'react-markdown';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Styles (simplified for chat) ---
const styles = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    backgroundColor: "#f9f9f9",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: "24px",
    borderRadius: "12px",
    marginBottom: "24px",
    textAlign: "center" as const,
  },
  headerTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: "bold",
  },
  chatbox: {
    backgroundColor: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    minHeight: "400px",
    display: "flex" as const,
    flexDirection: "column" as const,
    justifyContent: "space-between",
  },
  messages: {
    overflowY: "auto" as const,
    paddingRight: "10px",
    marginBottom: "20px",
    flexGrow: 1,
  },
  message: {
    marginBottom: "16px",
    padding: "12px 16px",
    borderRadius: "10px",
    maxWidth: "80%",
  },
  userMessage: {
    backgroundColor: "#667eea",
    color: "white",
    alignSelf: "flex-end",
    marginLeft: "auto",
  },
  agentMessage: {
    backgroundColor: "#f0f0f0",
    color: "#333",
    alignSelf: "flex-start",
  },
  inputArea: {
    display: "flex" as const,
    gap: "12px",
    marginTop: "12px",
  },
  input: {
    padding: "12px 16px",
    fontSize: "16px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    flex: 1,
    fontFamily: "inherit",
  },
  button: {
    padding: "12px 20px",
    fontSize: "16px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s",
    backgroundColor: "#667eea",
    color: "white",
  },
  loading: {
    fontStyle: "italic",
    color: "#666",
    textAlign: "center" as const,
    padding: "20px",
  },
} as any;

type Message = {
  sender: "user" | "agent";
  text: string;
};

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!query.trim()) return;

    const newMessages: Message[] = [...messages, { sender: "user", text: query }];
    setMessages(newMessages);
    setQuery("");
    setLoading(true);

    try {
      // Unified endpoint that routes to the correct agent on the backend
      const { data } = await axios.post(`${API_URL}/agent/invoke`, {
        input: query,
        // We can pass memory/state if we build that feature in the future
      });
      
      // The new endpoint returns a single 'output' field with the agent's response
      const agentResponse = data.output || "Sorry, I didn't understand that. Can you try asking in a different way?";
      
      setMessages([...newMessages, { sender: "agent", text: agentResponse }]);

    } catch (e: any) {
      const errorMsg = e?.response?.data?.detail || "An error occurred with the agent.";
      setMessages([...newMessages, { sender: "agent", text: `Error: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>📚 Sinhala-English Tutor Agent</h1>
        <p>Ask for a any word, a story or your progress!</p>
      </header>

      <div style={styles.chatbox}>
        <div style={styles.messages}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                ...styles.message,
                ...(msg.sender === "user" ? styles.userMessage : styles.agentMessage),
              }}
            >
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          ))}
          {loading && <div style={styles.loading}>Agent is thinking... 🤔</div>}
        </div>

        <div style={styles.inputArea}>
          <input
            value={query}
            placeholder="Ask me for a 'word', 'story', or 'quiz'..."
            onChange={(e) => setQuery(e.target.value)}
            style={styles.input}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
          />
          <button type="button" onClick={handleSend} disabled={loading} style={styles.button}>
            {loading ? "⏳" : "Ask"}
          </button>
        </div>
      </div>
       <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button type="button" onClick={() => router.push('/mcq')} style={{...styles.button, backgroundColor: '#764ba2'}}>
            🎯 Go to MCQ Page
          </button>
        </div>
    </main>
  );
}
