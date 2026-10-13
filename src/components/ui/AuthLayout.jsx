import MarcaSgnc from "./MarcaSgnc.jsx";

const PASSOS = [
  { verbo: "Registre", texto: "a não conformidade com fatos e evidências." },
  { verbo: "Acompanhe", texto: "cada etapa e saiba com quem ela está." },
  { verbo: "Encerre", texto: "com feedback, aceite e plano de ação." },
];

export default function AuthLayout({ children }) {
  return (
    <div className="sg-auth">
      <section className="sg-auth__contexto" aria-label="Sobre o SGNC">
        <MarcaSgnc />
        <div className="sg-auth__mensagem">
          <span className="sg-auth__rotulo">Qualidade e conformidade</span>
          <p className="sg-auth__titulo">Desvios claros.<br />Ações rastreáveis.</p>
          <ol className="sg-auth__passos">
            {PASSOS.map((passo, indice) => (
              <li key={passo.verbo}>
                <span className="sg-auth__passo-numero" aria-hidden="true">{indice + 1}</span>
                <span><strong>{passo.verbo}</strong> {passo.texto}</span>
              </li>
            ))}
          </ol>
        </div>
        <span className="sg-auth__rodape">Arquem Sistemas · Ambiente interno</span>
      </section>
      <main className="sg-auth__principal">
        <div className="sg-auth__painel">
          <MarcaSgnc completa />
          {children}
        </div>
      </main>
    </div>
  );
}
