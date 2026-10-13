import { useEffect, useState } from "react";

import { obterTimeline } from "../client/ncService.js";
import { infoDoStatus } from "../client/statusNc.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarDataHora } from "../../../lib/utils/formato.js";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";

/**
 * Linha do tempo das transições da NC (mais recente primeiro): data/hora, autor, de → para e observação.
 * `compacta`: sem cartão próprio, para o painel de detalhe da Gestão de NCs.
 */
export default function HistoricoNc({ ncId, versao, compacta = false }) {
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    obterTimeline(ncId)
      .then((dados) => { if (ativo) { setEventos(dados.eventos ?? []); setErro(""); } })
      .catch((e) => { if (ativo) setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar o histórico."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [ncId, versao]);

  const idTitulo = `historico-nc-${ncId}-titulo`;
  const conteudo = (
    <>
      <h2 id={idTitulo} className="sg-secao-titulo">Linha do tempo</h2>
      {carregando && <EstadoCarregamento mensagem="Carregando histórico..." compacto />}
      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
      {!carregando && !erro && eventos.length === 0 && (
        <p className="sg-texto-apoio mb-0">Nenhuma transição registrada.</p>
      )}
      {!carregando && eventos.length > 0 && (
        <ol className="sg-historico">
          {[...eventos].reverse().map((evento) => (
            <li key={evento.id} className={`sg-historico__item sg-historico__item--${infoDoStatus(evento.status_novo).etapa}`}>
              <span className="sg-historico__transicao">
                {evento.status_anterior
                  ? <>{infoDoStatus(evento.status_anterior).rotulo} <span aria-label="para">→</span> {infoDoStatus(evento.status_novo).rotulo}</>
                  : <>Registrada como {infoDoStatus(evento.status_novo).rotulo}</>}
              </span>
              <span className="sg-historico__cabecalho">
                <time dateTime={evento.criado_em}>{formatarDataHora(evento.criado_em)}</time>
                {evento.autor_nome && <> · <span className="sg-historico__autor">{evento.autor_nome}</span></>}
              </span>
              {evento.observacao && <p className="sg-historico__observacao mb-0">{evento.observacao}</p>}
            </li>
          ))}
        </ol>
      )}
    </>
  );

  if (compacta) return <section className="sg-historico-bloco" aria-labelledby={idTitulo}>{conteudo}</section>;
  return <section className="sg-cartao sg-historico-bloco" aria-labelledby={idTitulo}>{conteudo}</section>;
}
