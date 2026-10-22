import { IBM_Plex_Mono, Public_Sans } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "../index.css";
import "../redesign.css";

// Fontes servidas pelo próprio app (next/font baixa no build); as variáveis alimentam os tokens de redesign.css.
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--fonte-public-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--fonte-plex-mono", display: "swap" });

// Rotas autenticadas e dinâmicas: a navegação pode esperar o servidor, como antes do cacheComponents.
export const instant = false;

export const metadata = {
  title: "SGNC | Arquem Sistemas",
  description: "Sistema de gestão de não conformidades",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${publicSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
