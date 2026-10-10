import { useEffect, useState } from "react";

import { obterTimeline } from "../client/ncService.js";
import { infoDoStatus } from "../client/statusNc.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarDataHora } from "../../../lib/utils/formato.js";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";

/** Linha do tempo das transições da NC: data/hora, autor, de → para e observação. */
export default function HistoricoNc({ ncId, versao }) {
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

  return (
    <section className="sg-card" aria-labelledby="historico-nc-titulo">
      <div className="sg-card-body p-4">
        <h2 id="historico-nc-titulo" className="h5 mb-3">Histórico</h2>
        {carregando && <EstadoCarregamento mensagem="Carregando histórico..." />}
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        {!carregando && !erro && eventos.length === 0 && (
          <p className="texto-secundario mb-0">Nenhuma transição registrada.</p>
        )}
        {eventos.length > 0 && (
          <ol className="sg-historico">
            {eventos.map((evento) => (
              <li key={evento.id} className="sg-historico__item">
                <div className="sg-historico__cabecalho">
                  <time dateTime={evento.criado_em}>{formatarDataHora(evento.criado_em)}</time>
                  <span className="sg-historico__autor">{evento.autor_nome}</span>
                </div>
                <div className="sg-historico__transicao">
                  {evento.status_anterior
                    ? <>{infoDoStatus(evento.status_anterior).rotulo} <span aria-label="para">→</span> {infoDoStatus(evento.status_novo).rotulo}</>
                    : <>Registrada como {infoDoStatus(evento.status_novo).rotulo}</>}
                </div>
                {evento.observacao && <p className="sg-historico__observacao mb-0">{evento.observacao}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
