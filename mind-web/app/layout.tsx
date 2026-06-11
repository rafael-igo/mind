export const metadata = {
  title: "Mind",
  description: "Cérebro digital da empresa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b1020", color: "#e6e9f0" }}>
        {children}
      </body>
    </html>
  );
}
