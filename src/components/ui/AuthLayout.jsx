import MarcaSgnc from "./MarcaSgnc";

export default function AuthLayout({ children }) {
  return (
    <div className="sg-auth-wrapper">
      <div className="sg-auth-shell">
        <aside className="sg-auth-contexto">
          <MarcaSgnc />
          <div className="sg-auth-contexto__conteudo">
            <span className="sg-auth-contexto__rotulo">Qualidade e conformidade</span>
            <h2>Desvios claros.<br />Ações rastreáveis.</h2>
            <p>
              Registre, acompanhe e encerre não conformidades com
              responsabilidade definida em cada etapa.
            </p>
          </div>
          <span className="sg-auth-contexto__rodape">Ambiente interno</span>
        </aside>
        <main className="sg-auth-card">\n          <MarcaSgnc completa />\n          {children}\n        </main>
      </div>
    </div>
  );
}
