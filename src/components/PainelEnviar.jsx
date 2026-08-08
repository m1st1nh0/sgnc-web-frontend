import { useState } from "react";

import { enviarNc } from "../services/ncService";
import { ErroApi } from "../services/api";
import Botao from "./ui/Botao";
import MensagemErro from "./ui/MensagemErro";

/**
 * Exibido só para o ADM, quando a NC está 'validada'.
 * Ao enviar, o colaborador e o supervisor passam a enxergar a NC.
 */
export default function PainelEnviar({ nc, aoConcluir }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function confirmar() {
    setErro("");
    setEnviando(true);
    try {
      const atualizada = await enviarNc(nc.id);
      aoConcluir(atualizada);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível enviar a NC.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="sg-painel">
      <div className="sg-painel__cabecalho">
        <h2 className="sg-painel__titulo">Enviar ao colaborador</h2>
      </div>
      <div className="sg-painel__corpo">
        <p className="texto-secundario texto-sm mb-3">
          Esta NC foi validada. Ao enviar, o colaborador analisado e seu
          supervisor passam a ter acesso a ela.
        </p>

        {erro && <MensagemErro mensagem={erro} />}

        <Botao variante="primario" carregando={enviando} onClick={confirmar}>
          Enviar
        </Botao>
      </div>
    </div>
  );
}