"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { escaparTexto, TAGS_PERMITIDAS } from "../../lib/nc/texto-rico.js";
import { problemaDoAnexo } from "../../lib/nc/anexos.js";
import { EXTENSOES_IMAGEM } from "../../lib/nc/anexos.js";

/**
 * Editor do relato: texto com imagens no meio, coladas com Ctrl+V ou
 * arrastadas para dentro do campo.
 *
 * O que sai daqui é sempre serializado por esta tela, percorrendo o DOM e
 * escrevendo só as marcações da lista de permissão — o HTML que o navegador
 * monta ao colar nunca é aproveitado como está. Imagem vira
 * `<img data-evidencia="id">`, sem endereço: quem desenha resolve o id.
 *
 * `enviarImagem(arquivo)` devolve o id da evidência. Quando a NC ainda não
 * existe (abertura), a tela que usa o editor guarda o arquivo e devolve um id
 * **negativo**, que não passa na validação: é obrigatório trocá-lo pelo id
 * real antes de salvar.
 */

const COMANDOS = [
  { chave: "bold", rotulo: "Negrito", atalho: "Ctrl+B", simbolo: "B", classe: "is-negrito" },
  { chave: "italic", rotulo: "Itálico", atalho: "Ctrl+I", simbolo: "I", classe: "is-italico" },
  { chave: "underline", rotulo: "Sublinhado", atalho: "Ctrl+U", simbolo: "U", classe: "is-sublinhado" },
  { chave: "insertUnorderedList", rotulo: "Lista", atalho: "", simbolo: "•—", classe: "" },
];
const EQUIVALENTES = { b: "strong", i: "em", div: "p", span: null, font: null };

/** Percorre o DOM e escreve só o que a lista de permissão aceita. */
export function serializar(raiz) {
  let saida = "";
  const visitar = (nos) => {
    for (const no of nos) {
      if (no.nodeType === 3) { saida += escaparTexto(no.nodeValue); continue; }
      if (no.nodeType !== 1) continue;
      const original = no.tagName.toLowerCase();
      const tag = Object.hasOwn(EQUIVALENTES, original) ? EQUIVALENTES[original] : original;
      if (tag === "img") {
        const id = Number(no.getAttribute("data-evidencia"));
        if (!Number.isInteger(id) || id === 0) continue;
        const alt = no.getAttribute("alt") || "";
        saida += `<img data-evidencia="${id}"${alt ? ` alt="${escaparTexto(alt)}"` : ""}>`;
        continue;
      }
      if (tag === "br") { saida += "<br>"; continue; }
      if (!tag || !Object.hasOwn(TAGS_PERMITIDAS, tag)) { visitar(no.childNodes); continue; }
      saida += `<${tag}>`;
      visitar(no.childNodes);
      saida += `</${tag}>`;
    }
  };
  visitar(raiz.childNodes);
  // Texto solto fora de parágrafo: embrulha para o conteúdo ficar sempre em blocos.
  if (saida && !/^\s*<(p|ul|ol)\b/.test(saida)) saida = `<p>${saida}</p>`;
  return saida;
}

export default function EditorTextoRico({
  id,
  valor,
  aoMudar,
  enviarImagem,
  urlDaImagem,
  placeholder = "",
  disabled = false,
  erro = "",
  descricaoAjuda = "",
  "aria-describedby": descritoPor,
}) {
  const geradoId = useId();
  const idCampo = id || `editor-${geradoId}`;
  const areaRef = useRef(null);
  const ultimoHtml = useRef("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  // Só escreve no campo quando o valor vem de fora (carregamento, limpeza):
  // reescrever a cada tecla jogaria o cursor para o começo.
  useEffect(() => {
    const area = areaRef.current;
    if (!area || valor === ultimoHtml.current) return;
    ultimoHtml.current = valor ?? "";
    area.innerHTML = paraEdicao(valor ?? "", urlDaImagem);
  }, [valor, urlDaImagem]);

  const emitir = useCallback(() => {
    const html = serializar(areaRef.current);
    ultimoHtml.current = html;
    aoMudar(html);
  }, [aoMudar]);

  function inserir(no) {
    const selecao = window.getSelection();
    const area = areaRef.current;
    if (!selecao || selecao.rangeCount === 0 || !area.contains(selecao.anchorNode)) {
      area.append(no);
    } else {
      const faixa = selecao.getRangeAt(0);
      faixa.deleteContents();
      faixa.insertNode(no);
      faixa.setStartAfter(no);
      faixa.collapse(true);
      selecao.removeAllRanges();
      selecao.addRange(faixa);
    }
    emitir();
  }

  async function inserirImagens(arquivos) {
    const imagens = arquivos.filter((arquivo) => EXTENSOES_IMAGEM.some((item) => arquivo.name.toLowerCase().endsWith(`.${item}`)) || arquivo.type.startsWith("image/"));
    if (!imagens.length) {
      if (arquivos.length) setAviso("Só imagens podem ser inseridas no meio do texto. Outros arquivos vão na área de evidências.");
      return;
    }
    setAviso("");
    setOcupado(true);
    try {
      for (const arquivo of imagens) {
        const problema = problemaDoAnexo(arquivo);
        if (problema) { setAviso(problema); continue; }
        const idEvidencia = await enviarImagem(arquivo);
        const imagem = document.createElement("img");
        imagem.setAttribute("data-evidencia", String(idEvidencia));
        imagem.setAttribute("alt", arquivo.name);
        imagem.src = urlDaImagem(idEvidencia);
        inserir(imagem);
      }
    } catch (e) {
      setAviso(e?.message || "Não foi possível inserir a imagem.");
    } finally {
      setOcupado(false);
    }
  }

  function aoColar(evento) {
    const arquivos = Array.from(evento.clipboardData?.files || []);
    if (arquivos.length) {
      evento.preventDefault();
      void inserirImagens(arquivos);
      return;
    }
    // Texto colado entra sem formatação: o modelo aceita poucas marcações.
    evento.preventDefault();
    const texto = evento.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, texto);
    emitir();
  }

  function aoSoltar(evento) {
    const arquivos = Array.from(evento.dataTransfer?.files || []);
    if (!arquivos.length) return;
    evento.preventDefault();
    void inserirImagens(arquivos);
  }

  function comando(chave) {
    document.execCommand(chave);
    areaRef.current?.focus();
    emitir();
  }

  const ajudaId = `${idCampo}-ajuda`;
  return (
    <div className={`sg-editor-rico${disabled ? " is-desabilitado" : ""}${erro ? " is-invalido" : ""}`}>
      <div className="sg-editor-rico__barra" role="toolbar" aria-label="Formatação do texto">
        {COMANDOS.map((item) => (
          <button
            key={item.chave}
            type="button"
            className={`sg-editor-rico__botao ${item.classe}`}
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={() => comando(item.chave)}
            disabled={disabled}
            title={item.atalho ? `${item.rotulo} (${item.atalho})` : item.rotulo}
            aria-label={item.rotulo}
          >
            {item.simbolo}
          </button>
        ))}
        <span className="sg-editor-rico__dica">Cole uma imagem com Ctrl+V ou arraste-a para dentro do texto.</span>
      </div>
      <div
        id={idCampo}
        ref={areaRef}
        className="sg-editor-rico__area"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-invalid={erro ? true : undefined}
        aria-describedby={[descritoPor, descricaoAjuda ? ajudaId : null].filter(Boolean).join(" ") || undefined}
        data-placeholder={placeholder}
        onInput={emitir}
        onBlur={emitir}
        onPaste={aoColar}
        onDrop={aoSoltar}
        onDragOver={(evento) => { if (evento.dataTransfer?.types?.includes("Files")) evento.preventDefault(); }}
      />
      {descricaoAjuda && <p id={ajudaId} className="sg-helper">{descricaoAjuda}</p>}
      <p className="sg-editor-rico__estado" role="status" aria-live="polite">{ocupado ? "Enviando imagem..." : ""}</p>
      {aviso && <div className="sg-erro-campo" role="alert">{aviso}</div>}
      {erro && <div className="sg-erro-campo">{erro}</div>}
    </div>
  );
}

/** Repõe o `src` das imagens para a edição; o conteúdo guardado não tem endereço. */
function paraEdicao(html, urlDaImagem) {
  return String(html ?? "").replace(/<img data-evidencia="(-?\d+)"([^>]*)>/g, (inteiro, id, resto) => {
    const url = urlDaImagem ? urlDaImagem(Number(id)) : "";
    return url ? `<img data-evidencia="${id}"${resto} src="${escaparTexto(url)}">` : inteiro;
  });
}
