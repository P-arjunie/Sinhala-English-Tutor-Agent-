export const metadata = {
  title: "Sinhala-English Tutor",
  description: "Learn English with Sinhala support",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, Arial, sans-serif', margin: 0 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
          <h1>📚 Sinhala–English Tutor</h1>
          {children}
        </div>
      </body>
    </html>
  );
}
