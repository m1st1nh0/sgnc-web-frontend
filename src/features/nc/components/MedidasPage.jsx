"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import { aplicarMedida, decidirMedida, listarMedidas } from "../client/ncService.js";
import { ROTULO_TIPO_MEDIDA, situacaoDaMedida } from "../client/medidas.js";
import { erroComprovante } from "../../../lib/nc/comprovante";
import { ErroApi } from "../../../lib/api/client/api.js";
import { formatarData, formatarDataHora } from "../../../lib/utils/formato.js";
import Botao from "../../../components/ui/Botao.jsx";
import CampoSelecao from "../../../components/ui/CampoSelecao.jsx";
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
  const [modo, setModo] = useState(null); // "aprovar" | "reprovar" | "aplicar"
  const [motivo, setMotivo] = useState("");
  const [tipo, setTipo] = useState(medida.tipo);
  const tipoSugerido = medida.tipo_sugerido || medida.tipo;
  const trocouTipo = tipo !== tipoSugerido;
  const [data, setData] = useState(hojeEmSaoPaulo());
  const [dias, setDias] = useState("");
  const [observacao, setObservacao] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [previa, setPrevia] = useState("");
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  function selecionarArquivo(event) {
    const foto = event.target.files?.[0] ?? null;
    const mensagem = erroComprovante(foto);
    setErrosCampo((anteriores) => ({ ...anteriores, arquivo: mensagem }));
    setArquivo(mensagem ? null : foto);
    setPrevia(mensagem ? "" : URL.createObjectURL(foto));
    event.target.value = "";
  }
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

  function aprovar() {
    // Trocar o tipo sugerido exige justificativa (decisão de 10/10).
    if (trocouTipo && motivo.trim().length < 10) {
      setErrosCampo({ motivo: "Justifique a troca do tipo sugerido (mínimo de 10 caracteres)." });
      return;
    }
    executar(() => decidirMedida(medida.id, "aprovar", motivo.trim() || null, tipo));
  }

  function reprovar() {
    if (motivo.trim().length < 10) {
      setErrosCampo({ motivo: "Informe o motivo da reprovação (mínimo de 10 caracteres)." });
      return;
    }
    executar(() => decidirMedida(medida.id, "reprovar", motivo.trim()));
  }

  function aplicar() {
    if (enviando) return;
    if (!data) { setErrosCampo({ data: "Informe a data da aplicação." }); return; }
    const mensagem = erroComprovante(arquivo);
    if (mensagem) { setErrosCampo({ arquivo: mensagem }); return; }
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
    }, arquivo));
  }

  return (
    <article className="sg-card sg-medida">
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
          {medida.origem === "nc_critica"
            ? <>NC crítica, causa <strong>{medida.causa}</strong> ·{" "}</>
            : <>{medida.ocorrencia_gatilho}ª NC de <strong>{medida.causa}</strong> no ciclo de 12 meses{medida.origem === "reincidencia_e_critica" ? " e NC crítica" : ""} ·{" "}</>}
          <Link href={`/nc/${medida.nc_id}`}>NC #{medida.nc_id}</Link> · passível desde {formatarDataHora(medida.criado_em)}
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

        {medida.status === "aplicada" && (
          medida.comprovante_nome ? (
            <div className="d-flex flex-wrap gap-3 texto-sm mt-2">
              <a href={`/api/nc/medidas-disciplinares/${medida.id}/comprovante`} target="_blank" rel="noopener noreferrer">Ver medida assinada</a>
              <a href={`/api/nc/medidas-disciplinares/${medida.id}/comprovante?download=1`} target="_blank" rel="noopener noreferrer">Baixar foto</a>
            </div>
          ) : <p className="texto-xs texto-secundario mb-1">Sem comprovante anexado (registro anterior).</p>
        )}

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        {semPermissao && (
          <div className="sg-alerta sg-alerta--atencao mt-2 mb-0" role="status">
            Você é o colaborador desta medida. Outra pessoa da Qualidade deve decidir e aplicar.
          </div>
        )}

        {medida.tipo_sugerido && medida.tipo !== medida.tipo_sugerido && (
          <p className="texto-xs texto-secundario mb-1">
            Tipo sugerido pelo sistema: {ROTULO_TIPO_MEDIDA[medida.tipo_sugerido]} (trocado na aprovação).
          </p>
        )}
        {medida.permissoes?.decidir && !modo && (
          <div className="d-flex gap-2 mt-2">
            <Botao variante="primario" tamanho="sm" disabled={enviando} onClick={() => setModo("aprovar")}>
              Aprovar
            </Botao>
            <Botao variante="secundario" tamanho="sm" disabled={enviando} onClick={() => setModo("reprovar")}>
              Reprovar
            </Botao>
          </div>
        )}
        {medida.permissoes?.decidir && modo === "aprovar" && (
          <div className="mt-2">
            <CampoSelecao
              id={`tipo-medida-${medida.id}`}
              rotulo="Medida aprovada"
              obrigatorio
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              erro={errosCampo.tipo}
              helper={`Indicada pela escada da causa: ${ROTULO_TIPO_MEDIDA[tipoSugerido]}. A aplicação é feita pelo RH, presencialmente.`}
            >
              {Object.entries(ROTULO_TIPO_MEDIDA).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </CampoSelecao>
            <CampoTextoArea
              id={`justificativa-medida-${medida.id}`}
              rotulo={trocouTipo ? "Justificativa da troca" : "Observação da decisão"}
              obrigatorio={trocouTipo}
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              erro={errosCampo.motivo}
              helper={trocouTipo ? "Obrigatória ao trocar o tipo sugerido." : "Opcional."}
              maxLength={1000}
            />
            <div className="d-flex gap-2">
              <Botao variante="primario" tamanho="sm" carregando={enviando} onClick={aprovar}>Confirmar aprovação</Botao>
              <Botao variante="secundario" tamanho="sm" disabled={enviando} onClick={() => { setModo(null); setTipo(medida.tipo); }}>Cancelar</Botao>
            </div>
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
            <Form.Group className="mb-3" controlId={`comprovante-${medida.id}`}>
              <Form.Label className="sg-label">Foto da medida assinada <span aria-hidden="true">*</span></Form.Label>
              <Form.Control type="file" accept="image/jpeg,image/png,image/webp" required={!arquivo} disabled={enviando}
                onChange={selecionarArquivo} isInvalid={Boolean(errosCampo.arquivo)}
                aria-describedby={`comprovante-ajuda-${medida.id} comprovante-erro-${medida.id}`} />
              <Form.Text id={`comprovante-ajuda-${medida.id}`}>Anexe uma foto legível do documento assinado. JPG, PNG ou WebP, até 4 MB.</Form.Text>
              <Form.Control.Feedback type="invalid" id={`comprovante-erro-${medida.id}`} role="alert">{errosCampo.arquivo}</Form.Control.Feedback>
              {previa && (
                <div className="mt-2">
                  <img src={previa} alt="Prévia da medida assinada selecionada" style={{ display: "block", maxWidth: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 8 }} />
                  <p className="texto-xs texto-secundario mt-1 mb-1" style={{ overflowWrap: "anywhere" }}>{arquivo?.name}</p>
                  <Botao variante="secundario" tamanho="sm" disabled={enviando} onClick={() => { setArquivo(null); setPrevia(""); }}>Remover foto</Botao>
                </div>
              )}
            </Form.Group>
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
// Etapas da medida (4B): sugerida → aprovada/reprovada → aplicada. Reprovadas e canceladas ficam fora do quadro.
const COLUNAS = [
  { status: "sugerida", titulo: "1 · Passíveis de medida", apoio: "aguardam decisão", vazio: "Nenhuma medida aguardando decisão." },
  { status: "aprovada", titulo: "2 · Aprovadas", apoio: "aguardam aplicação", vazio: "Nenhuma medida aprovada a aplicar." },
  { status: "aplicada", titulo: "3 · Aplicadas", apoio: "mais recentes", vazio: "Nenhuma medida aplicada." },
];

export default function MedidasPage() {
  const [medidas, setMedidas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [colaborador, setColaborador] = useState("");
  const [verEncerradas, setVerEncerradas] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      // Pendentes (sugeridas e aprovadas) e histórico (aplicadas, reprovadas, canceladas) pelas consultas que já existem.
      const [pendentes, historico] = await Promise.all([listarMedidas("pendentes"), listarMedidas("historico")]);
      setMedidas([...pendentes, ...historico]);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar as medidas disciplinares.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const colaboradores = [...new Map(medidas.map((m) => [m.colaborador_id, m.colaborador_nome || "Colaborador"])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const filtradas = medidas.filter((m) => !colaborador || m.colaborador_id === colaborador);
  const encerradas = filtradas.filter((m) => ["reprovada", "cancelada"].includes(m.status));

  return (
    <div>
      <Container className="sg-container sg-medidas">
        <header className="sg-pagina-cabecalho">
          <div className="sg-pagina-cabecalho__texto">
            <h1>Medidas disciplinares</h1>
            <p>A cada 3 NCs da mesma causa no ciclo de 12 meses, ou numa NC crítica, o colaborador fica passível de medida. A Qualidade aprova ou reprova e registra a aplicação feita pelo RH.</p>
          </div>
          <div className="sg-pagina-cabecalho__acoes">
            <Form.Group controlId="medidas-colaborador" className="sg-medidas__filtro">
              <Form.Label className="sg-label">Colaborador</Form.Label>
              <Form.Select className="sg-input" value={colaborador} onChange={(e) => setColaborador(e.target.value)}>
                <option value="">Todos</option>
                {colaboradores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </Form.Select>
            </Form.Group>
            <button type="button" className="sg-btn sg-btn--secundario" aria-pressed={verEncerradas} onClick={() => setVerEncerradas((v) => !v)}>
              {verEncerradas ? "Ocultar reprovadas" : `Reprovadas (${encerradas.length})`}
            </button>
          </div>
        </header>
        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        {carregando ? <EstadoCarregamento mensagem="Carregando medidas..." /> : (
          <>
            <div className="sg-medidas__quadro">
              {COLUNAS.map((coluna) => {
                const itens = filtradas.filter((m) => m.status === coluna.status);
                return (
                  <section key={coluna.status} className="sg-medidas__coluna" aria-labelledby={`coluna-${coluna.status}`}>
                    <h2 id={`coluna-${coluna.status}`} className="sg-medidas__coluna-titulo">
                      <span>{coluna.titulo}</span>
                      <span className="sg-texto-apoio">{coluna.apoio} · {itens.length}</span>
                    </h2>
                    {itens.length === 0
                      ? <p className="sg-medidas__vazio">{coluna.vazio}</p>
                      : itens.map((medida) => <CartaoMedida key={medida.id} medida={medida} aoAlterar={carregar} />)}
                  </section>
                );
              })}
            </div>
            {verEncerradas && (
              <section className="sg-medidas__encerradas" aria-labelledby="medidas-reprovadas">
                <h2 id="medidas-reprovadas" className="sg-secao-titulo">Reprovadas e canceladas</h2>
                {encerradas.length === 0
                  ? <EstadoVazio titulo="Nenhuma medida reprovada" descricao="As medidas reprovadas pela Qualidade aparecem aqui." />
                  : <div className="sg-medidas__grade">{encerradas.map((medida) => <CartaoMedida key={medida.id} medida={medida} aoAlterar={carregar} />)}</div>}
              </section>
            )}
            <p className="sg-texto-apoio mt-4 mb-0">Só a Qualidade decide e aplica, e nunca em medida de NC em que ela própria é a colaboradora analisada.</p>
          </>
        )}
      </Container>
    </div>
  );
}
