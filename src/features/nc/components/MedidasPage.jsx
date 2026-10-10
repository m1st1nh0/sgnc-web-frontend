"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";

import { aplicarMedida, decidirMedida, listarMedidas } from "../client/ncService.js";
import { ROTULO_TIPO_MEDIDA, situacaoDaMedida } from "../client/medidas.js";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarData, formatarDataHora } from "../../../lib/utils/formato.js";
import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import Botao from "../../../components/ui/Botao.jsx";
import CampoTexto from "../../../components/ui/CampoTexto.jsx";
import CampoTextoArea from "../../../components/ui/CampoTextoArea.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";

function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Uma medida com as ações da etapa atual; as ações não aparecem para o próprio colaborador (D19). */
function CartaoMedida({ medida, aoAlterar }) {
  const [modo, setModo] = useState(null); // "reprovar" | "aplicar"
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(hojeEmSaoPaulo());
  const [dias, setDias] = useState("");
  const [observacao, setObservacao] = useState("");
  const [errosCampo, setErrosCampo] = useState({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const situacao = situacaoDaMedida(medida.status);
  const pendente = ["sugerida", "aprovada"].includes(medida.status);
  const semPermissao = pendente && !medida.permissoes?.decidir && !medida.permissoes?.aplicar;

  async function executar(acao) {
    setErro("");
    setErrosCampo({});
    setEnviando(true);
    try {
      await acao();
      setModo(null);
      aoAlterar();
    } catch (e) {
      if (e instanceof ErroApi && e.campo) setErrosCampo({ [e.campo]: e.message });
      else setErro(e instanceof ErroApi ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setEnviando(false);
    }
  }

  function reprovar() {
    if (motivo.trim().length < 10) {
      setErrosCampo({ motivo: "Informe o motivo da reprovação (mínimo de 10 caracteres)." });
      return;
    }
    executar(() => decidirMedida(medida.id, "reprovar", motivo.trim()));
  }

  function aplicar() {
    if (medida.tipo === "suspensao") {
      const numero = Number(dias);
      if (!Number.isInteger(numero) || numero < 1 || numero > 30) {
        setErrosCampo({ dias_suspensao: "A suspensão deve ter entre 1 e 30 dias." });
        return;
      }
    }
    executar(() => aplicarMedida(medida.id, {
      data,
      dias_suspensao: medida.tipo === "suspensao" ? Number(dias) : null,
      observacao: observacao.trim() || null,
    }));
  }

  return (
    <article className="sg-card">
      <div className="sg-card-body p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div>
            <strong>{ROTULO_TIPO_MEDIDA[medida.tipo] ?? medida.tipo}</strong>
            {medida.dias_suspensao && <span className="texto-secundario"> · {medida.dias_suspensao} dia(s)</span>}
            <div className="texto-sm">
              <Link href={`/usuarios/${medida.colaborador_id}/estatisticas`}>{medida.colaborador_nome || "Colaborador"}</Link>
              {medida.colaborador_setor ? ` · ${medida.colaborador_setor}` : ""}
            </div>
          </div>
          <span className={`sg-badge ${situacao.classe}`}>{situacao.rotulo}</span>
        </div>
        <p className="texto-sm texto-secundario mb-2">
          {medida.ocorrencia_gatilho}ª ocorrência de <strong>{medida.causa}</strong> em 12 meses ·{" "}
          <Link href={`/nc/${medida.nc_id}`}>NC #{medida.nc_id}</Link> · sugerida em {formatarDataHora(medida.criado_em)}
        </p>
        {medida.decidida_em && (
          <p className="texto-xs texto-secundario mb-1">
            {medida.status === "reprovada" ? "Reprovada" : "Aprovada"} por {medida.decidida_por_nome || "-"} em {formatarDataHora(medida.decidida_em)}
            {medida.motivo_decisao ? `: ${medida.motivo_decisao}` : ""}
          </p>
        )}
        {medida.status === "aplicada" && (
          <p className="texto-xs texto-secundario mb-1">
            Aplicada em {formatarData(medida.data_aplicacao)} por {medida.aplicada_por_nome || "-"}
            {medida.observacao ? ` · ${medida.observacao}` : ""}
          </p>
        )}

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {semPermissao && (
          <div className="sg-alerta sg-alerta--atencao mt-2 mb-0" role="status">
            Você é o colaborador desta medida. Outra pessoa da Qualidade deve decidir e aplicar.
          </div>
        )}

        {medida.permissoes?.decidir && modo !== "reprovar" && (
          <div className="d-flex gap-2 mt-2">
            <Botao variante="primario" tamanho="sm" carregando={enviando} onClick={() => executar(() => decidirMedida(medida.id, "aprovar"))}>
              Aprovar
            </Botao>
            <Botao variante="secundario" tamanho="sm" disabled={enviando} onClick={() => setModo("reprovar")}>
              Reprovar
            </Botao>
          </div>
        )}
        {medida.permissoes?.decidir && modo === "reprovar" && (
          <div className="mt-2">
            <CampoTextoArea
              id={`motivo-medida-${medida.id}`}
              rotulo="Motivo da reprovação"
              obrigatorio
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              erro={errosCampo.motivo}
              maxLength={1000}
              autoFocus
            />
            <div className="d-flex gap-2">
              <Botao variante="perigo" tamanho="sm" carregando={enviando} onClick={reprovar}>Confirmar reprovação</Botao>
              <Botao variante="secundario" tamanho="sm" disabled={enviando} onClick={() => setModo(null)}>Cancelar</Botao>
            </div>
          </div>
        )}

        {medida.permissoes?.aplicar && modo !== "aplicar" && (
          <div className="mt-2">
            <Botao variante="primario" tamanho="sm" onClick={() => setModo("aplicar")}>Registrar aplicação</Botao>
          </div>
        )}
        {medida.permissoes?.aplicar && modo === "aplicar" && (
          <div className="mt-2">
            <div className="row g-2">
              <div className="col-sm-6">
                <CampoTexto rotulo="Data da aplicação" obrigatorio type="date" max={hojeEmSaoPaulo()} value={data}
                  onChange={(e) => setData(e.target.value)} erro={errosCampo.data} />
              </div>
              {medida.tipo === "suspensao" && (
                <div className="col-sm-6">
                  <CampoTexto rotulo="Dias de suspensão" obrigatorio type="number" min={1} max={30} value={dias}
                    onChange={(e) => setDias(e.target.value)} erro={errosCampo.dias_suspensao} />
                </div>
              )}
            </div>
            <CampoTextoArea rotulo="Observação" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)}
              erro={errosCampo.observacao} helper="Contexto da aplicação (opcional)." maxLength={1000} />
            <div className="d-flex gap-2">
              <Botao variante="primario" tamanho="sm" carregando={enviando} onClick={aplicar}>Confirmar aplicação</Botao>
              <Botao variante="secundario" tamanho="sm" disabled={enviando} onClick={() => setModo(null)}>Cancelar</Botao>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

/** Medidas disciplinares em etapas (sugerida → aprovada/reprovada → aplicada), só para a Qualidade. */
export default function MedidasPage() {
  const [situacao, setSituacao] = useState("pendentes");
  const [medidas, setMedidas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      setMedidas(await listarMedidas(situacao));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar as medidas disciplinares.");
    } finally {
      setCarregando(false);
    }
  }, [situacao]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  return (
    <div>
      <Container className="sg-container" style={{ maxWidth: "900px" }}>
        <CabecalhoPagina
          titulo="Medidas disciplinares"
          subtitulo="A validação sugere a medida quando a reincidência atinge o gatilho. A Qualidade aprova ou reprova e registra a aplicação."
        />
        <div className="d-flex gap-2 mb-3" role="tablist" aria-label="Situação das medidas">
          {[["pendentes", "Pendentes"], ["historico", "Decididas e aplicadas"]].map(([chave, rotulo]) => (
            <button key={chave} type="button" role="tab" aria-selected={situacao === chave}
              className={`sg-btn sg-btn--sm ${situacao === chave ? "sg-btn--primario" : "sg-btn--secundario"}`}
              onClick={() => { setCarregando(true); setSituacao(chave); }}>
              {rotulo}
            </button>
          ))}
        </div>
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        {carregando ? <EstadoCarregamento mensagem="Carregando medidas..." /> : medidas.length === 0 ? (
          <EstadoVazio
            titulo={situacao === "pendentes" ? "Nenhuma medida pendente" : "Nenhuma medida decidida"}
            descricao={situacao === "pendentes" ? "As medidas sugeridas pela reincidência aparecem aqui para decisão." : "As medidas aprovadas, reprovadas e aplicadas aparecem aqui."}
          />
        ) : (
          <div className="d-flex flex-column gap-3">
            {medidas.map((medida) => <CartaoMedida key={medida.id} medida={medida} aoAlterar={carregar} />)}
          </div>
        )}
      </Container>
    </div>
  );
}
