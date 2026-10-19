import { useState } from "react";

import { registrarAnaliseCausa } from "../client/ncService.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarPrazo } from "../../../lib/utils/formato.js";
import Botao from "../../../components/ui/Botao.jsx";
import CampoTextoArea from "../../../components/ui/CampoTextoArea.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";

/**
 * Análise de causa (Fase 3 do processo): etapa própria, antes do feedback. A Qualidade registra a
 * causa raiz; o feedback usa o mesmo texto. Pode ser revisada enquanto o feedback não é registrado.
 */
export default function PainelAnalise({ nc, aoConcluir }) {
  const registrada = !!nc.analise_registrada_em;
  const [editando, setEditando] = useState(!registrada);
  const [texto, setTexto] = useState(nc.analise_causa || "");
  const [erroCampo, setErroCampo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Momento da abertura da tela: o aviso de prazo vencido não muda a cada renderização.
  const [agora] = useState(() => Date.now());
  const vencida = !registrada && nc.prazo_analise && Date.parse(nc.prazo_analise) < agora;

  async function salvar() {
    setErro("");
    if (!texto.trim()) {
      setErroCampo("Descreva a causa raiz.");
      document.getElementById("analise-causa")?.focus();
      return;
    }
    setEnviando(true);
    try {
      const atualizada = await registrarAnaliseCausa(nc.id, texto);
      setEditando(false);
      aoConcluir(atualizada);
    } catch (e) {
      if (e instanceof ErroApi && e.campo === "analise_causa") setErroCampo(e.message);
      else setErro(e instanceof ErroApi ? e.message : "Não foi possível registrar a análise de causa.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="sg-painel mb-3">
      <div className="sg-painel__cabecalho">
        <h2 className="sg-painel__titulo">Análise de causa</h2>
      </div>
      <div className="sg-painel__corpo">
        {nc.prazo_analise && !registrada && (
          <p className={vencida ? "sg-alerta sg-alerta--atencao mb-3" : "texto-sm texto-secundario mb-3"} role={vencida ? "status" : undefined}>
            {vencida ? "Prazo vencido em " : "Prazo: até "}{formatarPrazo(nc.prazo_analise)}
            {nc.critica ? " (NC crítica: no mesmo dia útil da marcação)." : " (2 dias úteis da validação, em horário de expediente)."}
          </p>
        )}
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        {editando ? (
          <>
            <CampoTextoArea
              id="analise-causa"
              rotulo="Causa raiz"
              obrigatorio
              rows={4}
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setErroCampo(""); }}
              erro={erroCampo}
              helper="Por que a não conformidade aconteceu. Este texto é usado no feedback."
              maxLength={4000}
            />
            <div className="d-flex gap-2">
              <Botao variante="primario" carregando={enviando} onClick={salvar}>
                {registrada ? "Salvar revisão" : "Registrar análise"}
              </Botao>
              {registrada && (
                <Botao variante="secundario" disabled={enviando} onClick={() => { setTexto(nc.analise_causa || ""); setEditando(false); }}>
                  Cancelar
                </Botao>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mb-2" style={{ whiteSpace: "pre-wrap" }}>{nc.analise_causa}</p>
            <p className="texto-xs texto-secundario mb-2">
              Registrada{nc.analise_registrada_por_nome ? ` por ${nc.analise_registrada_por_nome}` : ""}.
            </p>
            <Botao variante="secundario" tamanho="sm" onClick={() => setEditando(true)}>Revisar análise</Botao>
          </>
        )}
      </div>
    </div>
  );
}
