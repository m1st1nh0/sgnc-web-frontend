import "bootstrap/dist/css/bootstrap.min.css";
import "../index.css";
import "../redesign.css";

export const metadata = {
  title: "SGNC | Arquem Sistemas",
  description: "Sistema de gestão de não conformidades",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
