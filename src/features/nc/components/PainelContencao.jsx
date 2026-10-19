import { useEffect, useState } from "react";

import { atualizarContencao } from "../client/ncService.js";
import { listarOpcoesNc } from "../../users/client/usuarioService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarDataHora, formatarPrazo } from "../../../lib/utils/formato.js";
import Botao from "../../../components/ui/Botao.jsx";
import CampoSelecao from "../../../components/ui/CampoSelecao.jsx";
import CampoTextoArea from "../../../components/ui/CampoTextoArea.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";

/**
 * Contenção da NC crítica (Fase 3 do processo): até 24 h corridas da marcação. Quem marcou a NC
 * (ou outra pessoa da Qualidade sem conflito) designa o responsável; o responsável ou a Qualidade registra.
 * As permissões são conferidas no banco; aqui só decidimos o que mostrar.
 */
export default function PainelContencao({ nc, usuario, podeConduzir, aoConcluir }) {
  const registrada = !!nc.contencao_registrada_em;
  const ehResponsavel = nc.contencao_responsavel_id === usuario?.id;
  const ehColaborador = nc.colaborador_id === usuario?.id;
  const podeDesignar = !registrada && !ehColaborador && (podeConduzir || nc.critica_marcada_por === usuario?.id);
  const podeRegistrar = !registrada && !ehColaborador && (podeConduzir || ehResponsavel);
  // Momento da abertura da tela: o aviso de prazo vencido não muda a cada renderização.
  const [agora] = useState(() => Date.now());
  const vencida = !registrada && Date.parse(nc.prazo_contencao) < agora;

  const [pessoas, setPessoas] = useState([]);
  const [responsavel, setResponsavel] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState("");

  useEffect(() => {
    if (!podeDesignar) return;
    let ativo = true;
    listarOpcoesNc().then((lista) => { if (ativo) setPessoas(lista); }).catch(() => {});
    return () => { ativo = false; };
  }, [podeDesignar]);

  async function enviar(acao) {
    setErro("");
    setErros({});
    if (acao === "designar" && !responsavel) { setErros({ responsavel: "Escolha o responsável." }); return; }
    if (acao === "registrar" && descricao.trim().length < 10) {
      setErros({ contencao_descricao: "Descreva a contenção (mínimo de 10 caracteres)." });
      return;
    }
    setEnviando(acao);
    try {
      const dados = acao === "designar" ? { acao, responsavel_id: responsavel } : { acao, descricao };
      const atualizada = await atualizarContencao(nc.id, dados);
      setResponsavel("");
      setDescricao("");
      aoConcluir(atualizada);
    } catch (e) {
      if (e instanceof ErroApi && e.campo) setErros({ [e.campo]: e.message });
      else setErro(e instanceof ErroApi ? e.message : "Não foi possível atualizar a contenção.");
    } finally {
      setEnviando("");
    }
  }

  return (
    <div className="sg-painel mb-3">
      <div className="sg-painel__cabecalho">
        <h2 className="sg-painel__titulo">Contenção da NC crítica</h2>
      </div>
      <div className="sg-painel__corpo">
        {registrada ? (
          <>
            <p className="mb-2" style={{ whiteSpace: "pre-wrap" }}>{nc.contencao_descricao || "Contenção registrada."}</p>
            <p className="texto-xs texto-secundario mb-0">
              Registrada{nc.contencao_registrada_por_nome ? ` por ${nc.contencao_registrada_por_nome}` : ""} em {formatarDataHora(nc.contencao_registrada_em)}
              {Date.parse(nc.contencao_registrada_em) > Date.parse(nc.prazo_contencao) ? " (fora do prazo)." : "."}
            </p>
          </>
        ) : (
          <>
            <p className={vencida ? "sg-alerta sg-alerta--atencao mb-3" : "texto-sm texto-secundario mb-3"} role={vencida ? "status" : undefined}>
              {ehResponsavel ? "Você é o responsável" : `Responsável: ${nc.contencao_responsavel_nome || "não definido"}`}
              {" · "}{vencida ? "prazo vencido em " : "até "}{formatarPrazo(nc.prazo_contencao)} (24 h corridas da marcação).
            </p>
            {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
            {podeRegistrar && (
              <>
                <CampoTextoArea
                  id="contencao-descricao"
                  rotulo="O que foi feito para conter"
                  obrigatorio
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  erro={erros.contencao_descricao}
                  helper="Ação imediata para evitar que a falha continue enquanto a causa é tratada."
                  maxLength={4000}
                />
                <Botao variante="primario" carregando={enviando === "registrar"} disabled={!!enviando} onClick={() => enviar("registrar")}>
                  Registrar contenção
                </Botao>
              </>
            )}
            {podeDesignar && (
              <div className={podeRegistrar ? "mt-3 pt-3 border-top" : ""}>
                <CampoSelecao
                  id="contencao-responsavel"
                  rotulo="Designar outro responsável"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  erro={erros.responsavel}
                >
                  <option value="">Selecione um usuário ativo</option>
                  {pessoas
                    .filter((pessoa) => pessoa.id !== nc.colaborador_id && pessoa.id !== nc.contencao_responsavel_id)
                    .map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>{pessoa.nome}{pessoa.setor ? ` (${pessoa.setor})` : ""}</option>
                    ))}
                </CampoSelecao>
                <Botao variante="secundario" carregando={enviando === "designar"} disabled={!!enviando} onClick={() => enviar("designar")}>
                  Designar
                </Botao>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
