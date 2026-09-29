import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { checklistDoPapel } from "../../data/onboardingConteudo";
import Botao from "../ui/Botao";

export default function OnboardingChecklist() {
  const { usuario } = useAuth();
  const {
    progresso,
    carregando,
    etapaConcluida,
    dispensar,
    abrirRevisao,
    concluirEtapa,
  } = useOnboarding();

  if (
    carregando ||
    !progresso ||
    progresso.status === "dispensado" ||
    progresso.status === "concluido"
  ) {
    return null;
  }

  const itens = checklistDoPapel(usuario?.papel, usuario?.id);
  const concluidos = itens.filter((item) =>
    etapaConcluida(item.chave)
  ).length;
  const percentual = Math.round((concluidos / itens.length) * 100);

  return (
    <section
      className="sg-onboarding-checklist mb-4"
      aria-labelledby="onboarding-checklist-titulo"
    >
      <div className="sg-onboarding-checklist__cabecalho">
        <div>
          <span className="sg-onboarding__etapa">Onboarding do seu papel</span>
          <h2 id="onboarding-checklist-titulo" className="h5 mb-1">
            Seus primeiros passos
          </h2>
          <p className="texto-sm texto-suave mb-0">
            {concluidos} de {itens.length} tarefas concluídas
          </p>
        </div>
        <span className="sg-onboarding-checklist__percentual">
          {percentual}%
        </span>
      </div>

      <div
        className="sg-onboarding__progresso"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percentual}
        aria-label={"Progresso dos primeiros passos: " + percentual + "%"}
      >
        <span style={{ width: percentual + "%" }} />
      </div>

      <div className="sg-onboarding-checklist__itens">
        {itens.map((item) => {
          const concluido = etapaConcluida(item.chave);
          return (
            <Link
              key={item.chave}
              to={item.destino}
              className={
                "sg-onboarding-tarefa" +
                (concluido ? " sg-onboarding-tarefa--concluida" : "")
              }
              onClick={() => {
                if (item.concluirAoAbrir && !concluido) {
                  concluirEtapa(item.chave, "checklist", {
                    origem: "atalho_onboarding",
                  });
                }
              }}
            >
              <span className="sg-onboarding-tarefa__estado" aria-hidden="true">
                {concluido ? "✓" : "○"}
              </span>
              <span>
                <strong>{item.titulo}</strong>
                <small>{item.descricao}</small>
              </span>
              <span className="sg-onboarding-tarefa__seta" aria-hidden="true">
                →
              </span>
              <span className="visually-hidden">
                {concluido ? "Concluída" : "Pendente"}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="sg-onboarding-checklist__rodape">
        <Botao variante="subtle" tamanho="sm" onClick={abrirRevisao}>
          Rever apresentação
        </Botao>
        <Botao variante="subtle" tamanho="sm" onClick={dispensar}>
          Ocultar primeiros passos
        </Botao>
      </div>
    </section>
  );
}
