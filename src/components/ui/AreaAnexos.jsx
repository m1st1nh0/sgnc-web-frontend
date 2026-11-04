"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { FORMATOS_ANEXO, juntarAnexos, nomeDeImagemColada } from "../../lib/nc/anexos.js";

/**
 * Área de anexos: seleção tradicional, arrastar e soltar, e colar com Ctrl+V.
 *
 * O componente só cuida da lista de arquivos escolhidos (`arquivos`/`aoMudar`);
 * o envio continua com a tela que o usa, pelo fluxo atual de armazenamento e
 * permissões. Formato e tamanho são checados aqui com as mesmas regras da API,
 * para o usuário saber do problema antes de enviar.
 */

function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function Miniatura({ arquivo }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img className="sg-area-anexos__miniatura" src={url} alt={`Pré-visualização de ${arquivo.name}`} />;
}

export default function AreaAnexos({
  id,
  rotulo = "Arquivos",
  ajuda = "",
  arquivos = [],
  aoMudar,
  multiple = true,
  disabled = false,
  accept = FORMATOS_ANEXO,
  aoVisualizar = null,
}) {
  const geradoId = useId();
  const idCampo = id || `anexos-${geradoId}`;
  const entradaRef = useRef(null);
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [confirmacao, setConfirmacao] = useState("");

  function acrescentar(novos, origem) {
    if (disabled || !novos.length) return;
    const lista = multiple ? novos : novos.slice(0, 1);
    const base = multiple ? arquivos : [];
    const { arquivos: resultado, aceitos, aviso: problema } = juntarAnexos(base, lista);
    setAviso(problema);
    setConfirmacao(aceitos.length ? `${aceitos.length} arquivo(s) ${origem}.` : "");
    if (aceitos.length) aoMudar(resultado);
  }

  function aoSelecionar(evento) {
    acrescentar(Array.from(evento.target.files || []), "adicionado(s)");
    evento.target.value = "";
  }

  function aoSoltar(evento) {
    evento.preventDefault();
    setArrastando(false);
    acrescentar(Array.from(evento.dataTransfer?.files || []), "soltado(s) aqui");
  }

  function aoColar(evento) {
    const itens = Array.from(evento.clipboardData?.files || []);
    if (!itens.length) return;
    evento.preventDefault();
    // A imagem da área de transferência vem como "image.png": renomeia para não colidir.
    const renomeados = itens.map((arquivo) => new File([arquivo], nomeDeImagemColada(arquivo), { type: arquivo.type, lastModified: Date.now() }));
    acrescentar(renomeados, "colado(s)");
  }

  function remover(indice) {
    setAviso("");
    setConfirmacao("");
    aoMudar(arquivos.filter((_, i) => i !== indice));
  }

  return (
    <div className="sg-area-anexos">
      <label className="sg-label" htmlFor={idCampo}>{rotulo}</label>
      {/* Zona focável: recebe o Ctrl+V e também responde a Enter/Espaço abrindo o seletor. */}
      <div
        className={`sg-area-anexos__zona${arrastando ? " is-arrastando" : ""}${disabled ? " is-desabilitada" : ""}`}
        tabIndex={disabled ? -1 : 0}
        role="group"
        aria-label={`${rotulo}: arraste arquivos, cole com Ctrl+V ou use o botão de seleção`}
        aria-describedby={`${idCampo}-ajuda`}
        onDragOver={(evento) => { if (!disabled) { evento.preventDefault(); setArrastando(true); } }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        onPaste={aoColar}
        onKeyDown={(evento) => {
          if (disabled || (evento.key !== "Enter" && evento.key !== " ")) return;
          evento.preventDefault();
          entradaRef.current?.click();
        }}
      >
        <p className="sg-area-anexos__chamada">
          Arraste arquivos para cá, cole uma imagem com <kbd>Ctrl</kbd>+<kbd>V</kbd> ou selecione no campo abaixo.
        </p>
        <input
          ref={entradaRef}
          id={idCampo}
          className="sg-input sg-area-anexos__campo"
          type="file"
          multiple={multiple}
          accept={accept}
          disabled={disabled}
          onChange={aoSelecionar}
        />
      </div>
      <p id={`${idCampo}-ajuda`} className="sg-helper">
        {ajuda || "Imagens, PDFs ou planilhas de até 15 MB cada."}
      </p>
      <p className="sg-area-anexos__estado" role="status" aria-live="polite">{confirmacao}</p>
      {aviso && <div className="sg-erro-campo" role="alert">{aviso}</div>}
      {arquivos.length > 0 && (
        <ul className="sg-arquivos-selecionados mt-2 mb-0">
          {arquivos.map((arquivo, indice) => (
            <li key={`${arquivo.name}-${arquivo.size}-${arquivo.lastModified}`}>
              <span>
                {arquivo.type?.startsWith("image/") && <Miniatura arquivo={arquivo} />}
                <strong>{arquivo.name}</strong>
                <small>{formatarTamanho(arquivo.size)}</small>
              </span>
              <div className="d-flex gap-2">
                {aoVisualizar && arquivo.type?.startsWith("image/") && (
                  <button
                    className="sg-acao-arquivo sg-acao-arquivo--preview"
                    type="button"
                    onClick={() => aoVisualizar(arquivo)}
                    disabled={disabled}
                    aria-label={`Visualizar ${arquivo.name}`}
                  >
                    Visualizar
                  </button>
                )}
                <button
                  className="sg-acao-arquivo sg-acao-arquivo--remover"
                  type="button"
                  onClick={() => remover(indice)}
                  disabled={disabled}
                  aria-label={`Remover ${arquivo.name}`}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
