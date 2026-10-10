"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "../../auth/components/AuthContext.jsx";
import { useOnboarding } from "./OnboardingContext.jsx";
import { checklistDoPapel, ehPrimeiroAcesso } from "../onboardingConteudo.js";
import Botao from "../../../components/ui/Botao.jsx";

const CHAVE_PREFERENCIA = "sgnc-onboarding-checklist";

function lerPreferencia(usuarioId) {
  try {
    const valor = window.localStorage.getItem(`${CHAVE_PREFERENCIA}-${usuarioId}`);
    return valor === "aberto" || valor === "recolhido" ? valor : null;
  } catch {
    return null;
  }
}

function gravarPreferencia(usuarioId, valor) {
  try {
    window.localStorage.setItem(`${CHAVE_PREFERENCIA}-${usuarioId}`, valor);
  } catch {
    // Sem armazenamento local: a escolha vale só até recarregar a página.
  }
}

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
  const [preferencia, setPreferencia] = useState(null);

  useEffect(() => {
    if (!usuario?.id) return;
    // Preferência lida após a montagem para não divergir da renderização do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferencia(lerPreferencia(usuario.id));
  }, [usuario?.id]);

  function alternar(valor) {
    setPreferencia(valor);
    if (usuario?.id) gravarPreferencia(usuario.id, valor);
  }

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
  const expandido = preferencia ? preferencia === "aberto" : ehPrimeiroAcesso(progresso);

  if (!expandido) {
    return (
      <section
        className="sg-onboarding-checklist sg-onboarding-checklist--recolhido mb-4"
        aria-label="Seus primeiros passos"
      >
        <div className="sg-onboarding-checklist__resumo">
          <strong>Seus primeiros passos</strong>
          <span className="texto-sm texto-suave">
            {concluidos} de {itens.length} tarefas concluídas
          </span>
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
        </div>
        <div className="sg-onboarding-checklist__acoes">
          <Botao variante="subtle" tamanho="sm" onClick={() => alternar("aberto")} aria-expanded="false">
            Continuar
          </Botao>
          <Botao variante="subtle" tamanho="sm" onClick={dispensar}>
            Ocultar
          </Botao>
        </div>
      </section>
    );
  }

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
              href={item.destino}
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
        <div className="d-flex gap-2 flex-wrap">
          <Botao variante="subtle" tamanho="sm" onClick={abrirRevisao}>
            Rever apresentação
          </Botao>
          <Botao variante="subtle" tamanho="sm" onClick={() => alternar("recolhido")} aria-expanded="true">
            Recolher
          </Botao>
        </div>
        <Botao variante="subtle" tamanho="sm" onClick={dispensar}>
          Ocultar primeiros passos
        </Botao>
      </div>
    </section>
  );
}
