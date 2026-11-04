"use client";

import { Fragment, useMemo, useState } from "react";

import { analisarTextoRico } from "../../lib/nc/texto-rico.js";
import ModalVisualizarEvidencia from "./ModalVisualizarEvidencia.jsx";

/**
 * Desenha o texto rico de uma NC.
 *
 * A árvore validada vira elementos React, um por um: o conteúdo guardado
 * nunca é injetado como HTML na página. Mesmo que algo fora da regra tivesse
 * sido gravado, aqui ele não executa — no pior caso a leitura falha e o texto
 * aparece sem marcação.
 *
 * As imagens apontam para a rota que serve a evidência, que faz a checagem de
 * permissão de sempre.
 */

export const urlDaEvidencia = (ncId, evidenciaId) => `/api/nc/${ncId}/evidencias/${evidenciaId}/arquivo`;

function Nos({ nos, ncId, aoAbrirImagem }) {
  return nos.map((no, indice) => {
    if (no.tipo === "texto") return <Fragment key={indice}>{no.texto}</Fragment>;
    if (no.tag === "br") return <br key={indice} />;
    if (no.tag === "img") {
      const id = Number(no.atributos["data-evidencia"]);
      const alt = no.atributos.alt || "Imagem do relato";
      return (
        <button
          key={indice}
          type="button"
          className="sg-texto-rico__imagem"
          onClick={() => aoAbrirImagem({ id, alt })}
          aria-label={`Ampliar imagem: ${alt}`}
        >
          <img src={urlDaEvidencia(ncId, id)} alt={alt} loading="lazy" />
        </button>
      );
    }
    const Tag = no.tag;
    return <Tag key={indice}><Nos nos={no.filhos} ncId={ncId} aoAbrirImagem={aoAbrirImagem} /></Tag>;
  });
}

export default function TextoRico({ valor, formato, ncId, vazio = "—" }) {
  const [ampliada, setAmpliada] = useState(null);
  const analise = useMemo(() => {
    if (formato !== "html") return { nos: null, texto: String(valor ?? "") };
    try {
      return { nos: analisarTextoRico(valor), texto: null };
    } catch {
      // Conteúdo gravado fora da regra: mostra sem marcação, nunca como HTML.
      return { nos: null, texto: String(valor ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() };
    }
  }, [valor, formato]);

  if (analise.nos) {
    return (
      <>
        <div className="sg-texto-rico">
          <Nos nos={analise.nos} ncId={ncId} aoAbrirImagem={setAmpliada} />
        </div>
        <ModalVisualizarEvidencia
          visivel={!!ampliada}
          evidencia={ampliada ? { nome_original: ampliada.alt, url_temporaria: urlDaEvidencia(ncId, ampliada.id) } : null}
          aoFechar={() => setAmpliada(null)}
        />
      </>
    );
  }
  return <p className="sg-texto-rico">{analise.texto || vazio}</p>;
}
