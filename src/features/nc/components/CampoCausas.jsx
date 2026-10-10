import { useState, useEffect, useRef } from "react";

const normalizar = (valor) => String(valor ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export default function CampoCausas({
  valor = [],
  aoMudar,
  sugestoes = [],
  aoSolicitarCausa,
  linkCatalogo = false,
  aoMudarPendente,
  erro,
  idCampo = "campo-causas",
}) {
  const [textoDigitado, setTextoDigitado] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [mostrarSolicitacao, setMostrarSolicitacao] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);
  const [erroSolicitacao, setErroSolicitacao] = useState("");
  const referenciaCaixa = useRef(null);

  const termo = normalizar(textoDigitado);
  const mensagemErroId = `${idCampo}-erro`;

  function atualizarTexto(valorTexto) {
    setTextoDigitado(valorTexto);
    aoMudarPendente?.(valorTexto.trim());
  }
  const causaExistente = sugestoes.find((causa) => normalizar(causa) === termo);
  const sugestoesFiltradas = sugestoes.filter((sugestao) => {
    const jaEscolhida = valor.some((v) => normalizar(v) === normalizar(sugestao));
    return !jaEscolhida && termo.length > 0 && normalizar(sugestao).includes(termo);
  });

  function adicionarCausa(causa) {
    const causaLimpa = String(causa ?? "").trim().replace(/\s+/g, " ");
    if (!causaLimpa) return;
    const jaExiste = valor.some((v) => normalizar(v) === normalizar(causaLimpa));
    if (!jaExiste) aoMudar([...valor, causaLimpa]);
    atualizarTexto("");
    setMostrarSugestoes(false);
    setMostrarSolicitacao(false);
    setJustificativa("");
  }

  function removerCausa(causaParaRemover) {
    aoMudar(valor.filter((v) => v !== causaParaRemover));
  }

  function aoPressionarTecla(evento) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      if (causaExistente) adicionarCausa(causaExistente);
      else if (!linkCatalogo && aoSolicitarCausa && termo) setMostrarSolicitacao(true);
    } else if (evento.key === "Backspace" && textoDigitado === "" && valor.length > 0) {
      removerCausa(valor[valor.length - 1]);
    }
  }

  async function enviarSolicitacao() {
    setErroSolicitacao("");
    setEnviandoSolicitacao(true);
    try {
      await aoSolicitarCausa({ descricao: textoDigitado.trim(), justificativa });
      atualizarTexto("");
      setJustificativa("");
      setMostrarSolicitacao(false);
      setMostrarSugestoes(false);
    } catch (error) {
      setErroSolicitacao(error?.message || "Não foi possível enviar a solicitação.");
    } finally {
      setEnviandoSolicitacao(false);
    }
  }

  useEffect(() => {
    function aoClicarFora(evento) {
      if (referenciaCaixa.current && !referenciaCaixa.current.contains(evento.target)) {
        setMostrarSugestoes(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div ref={referenciaCaixa} style={{ position: "relative" }}>
      <div className="sg-tags">
        {valor.map((causa) => (
          <span key={causa} className="sg-tag">
            {causa}
            <button type="button" className="sg-tag__remover" aria-label={`Remover ${causa}`} onClick={() => removerCausa(causa)}>
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          className="sg-tag__input"
          value={textoDigitado}
          id={idCampo}
          onChange={(e) => {
            atualizarTexto(e.target.value);
            setMostrarSugestoes(true);
            setMostrarSolicitacao(false);
            setErroSolicitacao("");
          }}
          onFocus={() => setMostrarSugestoes(true)}
          onKeyDown={aoPressionarTecla}
          placeholder={valor.length === 0 ? "Busque e selecione uma causa" : ""}
          aria-label="Causas"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? mensagemErroId : undefined}
          aria-autocomplete="list"
          aria-expanded={mostrarSugestoes && sugestoesFiltradas.length > 0}
        />
      </div>

      {mostrarSugestoes && sugestoesFiltradas.length > 0 && (
        <div className="sg-tag-sugestoes" role="listbox" aria-label="Causas disponíveis">
          {sugestoesFiltradas.slice(0, 8).map((sugestao) => (
            <button key={sugestao} type="button" role="option" aria-selected="false" className="sg-tag-sugestao" onClick={() => adicionarCausa(sugestao)}>
              {sugestao}
            </button>
          ))}
        </div>
      )}

      {termo && !causaExistente && sugestoesFiltradas.length === 0 && linkCatalogo && (
        <div className="sg-helper mt-2" role="status">
          “{textoDigitado.trim()}” não está no catálogo. Causas novas são cadastradas em{" "}
          <a href="/causas" target="_blank" rel="noopener noreferrer">Gestão de causas</a>
          {" "}(abre em nova aba); depois volte e selecione-a aqui.
        </div>
      )}

      {termo && !causaExistente && !linkCatalogo && aoSolicitarCausa && (
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            aria-expanded={mostrarSolicitacao}
            onClick={() => setMostrarSolicitacao((atual) => !atual)}
          >
            Solicitar análise de “{textoDigitado.trim()}”
          </button>
        </div>
      )}

      {mostrarSolicitacao && aoSolicitarCausa && (
        <div className="border rounded p-3 mt-2" aria-label="Solicitar nova causa">
          <label className="form-label" htmlFor="justificativa-causa">Por que essa causa deve ser incluída?</label>
          <textarea
            id="justificativa-causa"
            className="form-control"
            rows={3}
            maxLength={1000}
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            aria-describedby="ajuda-justificativa-causa"
          />
          <small id="ajuda-justificativa-causa" className="form-text text-muted">
            O administrador avaliará a solicitação. A causa só ficará disponível após aprovação.
          </small>
          {erroSolicitacao && <div className="alert alert-danger mt-2 mb-0" role="alert">{erroSolicitacao}</div>}
          <button
            type="button"
            className="btn btn-primary btn-sm mt-2"
            disabled={enviandoSolicitacao || justificativa.trim().length < 10}
            onClick={enviarSolicitacao}
          >
            {enviandoSolicitacao ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>
      )}

      {erro && <div id={mensagemErroId} className="sg-erro-campo mt-2">{erro}</div>}
    </div>
  );
}
