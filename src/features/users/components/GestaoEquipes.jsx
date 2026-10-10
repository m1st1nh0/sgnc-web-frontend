"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import Botao from "../../../components/ui/Botao.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import { NOME_PAPEL } from "../../../lib/auth/papeis.js";
import { formatarDataHora } from "../../../lib/utils/formato.js";
import { alterarEquipe, listarEquipe, listarHistoricoEquipe, listarLiderancas } from "../client/usuarioService.js";

const SEM_LIDERANCA = "__sem_lideranca__";
const COR_PAPEL = { adm: "sg-badge--escuro", qualidade: "sg-badge--verde", supervisor: "sg-badge--azul", funcionario: "sg-badge--cinza" };

function contarPessoas(total) {
  if (total === 0) return "Nenhuma pessoa";
  return total === 1 ? "1 pessoa" : `${total} pessoas`;
}

function normalizar(texto) {
  return String(texto ?? "").toLocaleLowerCase("pt-BR");
}

/** Descendentes de uma pessoa, para não oferecer destinos que criariam ciclo. */
function descendentes(id, porLider) {
  const vistos = new Set();
  const fila = [id];
  while (fila.length) {
    for (const filho of porLider.get(fila.shift()) ?? []) {
      if (vistos.has(filho.id)) continue;
      vistos.add(filho.id);
      fila.push(filho.id);
    }
  }
  return vistos;
}

/**
 * Montagem das equipes (Qualidade e Administrador): visão por liderança, transferência
 * entre lideranças e alternância entre Supervisor e Colaborador, com histórico auditável.
 */
export default function GestaoEquipes() {
  const [pessoas, setPessoas] = useState([]);
  const [liderancas, setLiderancas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  // Confirmação de mudança aparece na linha da pessoa alterada, não no topo da página.
  const [alterado, setAlterado] = useState(null);
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState("");
  const [historico, setHistorico] = useState(null);
  // Mudança aguardando confirmação: { tipo: "mover" | "papel", pessoa, destino?, papel? }.
  const [confirmacao, setConfirmacao] = useState(null);

  useEffect(() => {
    if (!alterado) return undefined;
    const timer = setTimeout(() => setAlterado(null), 8000);
    return () => clearTimeout(timer);
  }, [alterado]);

  async function carregar() {
    const [equipe, lideres] = await Promise.all([listarEquipe(), listarLiderancas()]);
    setPessoas(equipe);
    setLiderancas(lideres);
  }

  useEffect(() => {
    let ativo = true;
    Promise.all([listarEquipe(), listarLiderancas()])
      .then(([equipe, lideres]) => {
        if (!ativo) return;
        setPessoas(equipe);
        setLiderancas(lideres);
      })
      .catch((e) => { if (ativo) setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar as equipes."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const porLider = useMemo(() => {
    const mapa = new Map();
    for (const pessoa of pessoas) {
      const chave = pessoa.supervisor_id || SEM_LIDERANCA;
      mapa.set(chave, [...(mapa.get(chave) ?? []), pessoa]);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return mapa;
  }, [pessoas]);

  const nomes = useMemo(
    () => new Map([...liderancas, ...pessoas].map((pessoa) => [pessoa.id, pessoa.nome])),
    [liderancas, pessoas],
  );

  const grupos = useMemo(() => {
    const idsLideres = new Set(liderancas.map((lider) => lider.id));
    const lista = liderancas.map((lider) => ({ lider, membros: porLider.get(lider.id) ?? [] }));
    // Pessoas sem liderança ou cuja liderança está inativa: precisam de atenção.
    const orfaos = pessoas.filter((pessoa) => !pessoa.supervisor_id || !idsLideres.has(pessoa.supervisor_id));
    const termo = normalizar(busca.trim());
    const combina = (pessoa) => !termo || [pessoa.nome, pessoa.setor, NOME_PAPEL[pessoa.papel]].some((v) => normalizar(v).includes(termo));
    const filtrados = lista
      .map((grupo) => ({ ...grupo, total: grupo.membros.length, membros: grupo.membros.filter(combina), liderCombina: combina(grupo.lider) }))
      .filter((grupo) => grupo.liderCombina || grupo.membros.length > 0);
    return {
      lista: filtrados.filter((grupo) => grupo.total > 0),
      // Lideranças sem nenhum liderado viram uma linha compacta, sem card próprio.
      semEquipe: filtrados.filter((grupo) => grupo.total === 0).map((grupo) => grupo.lider),
      orfaos: orfaos.filter(combina),
    };
  }, [liderancas, pessoas, porLider, busca]);

  function destinosDe(pessoa) {
    const bloqueados = descendentes(pessoa.id, porLider);
    return liderancas.filter((lider) => lider.id !== pessoa.id && lider.id !== pessoa.supervisor_id && !bloqueados.has(lider.id));
  }

  async function confirmar() {
    const { tipo, pessoa, destino, papel } = confirmacao;
    const dados = tipo === "mover" ? { supervisor_id: destino } : { papel };
    const mensagem = tipo === "mover"
      ? `Movido para ${nomes.get(destino) ?? "nova liderança"}`
      : `Agora é ${NOME_PAPEL[papel].toLocaleLowerCase("pt-BR")}`;
    setErro("");
    setAlterado(null);
    setSalvando(pessoa.id);
    try {
      await alterarEquipe(pessoa.id, dados);
      await carregar();
      setConfirmacao(null);
      setAlterado({ id: pessoa.id, mensagem });
    } catch (e) {
      setConfirmacao(null);
      setErro(e instanceof ErroApi ? e.message : "Não foi possível alterar a equipe.");
    } finally {
      setSalvando("");
    }
  }

  async function abrirHistorico(pessoa) {
    setHistorico({ pessoa, registros: null });
    try {
      setHistorico({ pessoa, registros: await listarHistoricoEquipe(pessoa.id) });
    } catch (e) {
      setHistorico(null);
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar o histórico.");
    }
  }

  function linhaPessoa(pessoa) {
    const destinos = destinosDe(pessoa);
    const ocupado = salvando === pessoa.id;
    const temLiderados = (porLider.get(pessoa.id) ?? []).length > 0;
    const ehColaborador = pessoa.papel === "funcionario";
    const novoPapel = ehColaborador ? "supervisor" : "funcionario";
    const motivoPapel = !pessoa.supervisor_id
      ? "Defina uma liderança antes"
      : !ehColaborador && temLiderados ? "Transfira os liderados antes" : "";
    return (
      <li key={pessoa.id} className={`sg-equipe-membro${pessoa.ativo ? "" : " sg-equipe-membro--inativo"}`}>
        <div className="sg-equipe-membro__info">
          <Link href={`/equipe/${pessoa.id}`} className="fw-semibold">{pessoa.nome}</Link>
          <div className="texto-xs texto-suave">
            <span className={`sg-badge ${COR_PAPEL[pessoa.papel] ?? "sg-badge--cinza"} me-1`}>{NOME_PAPEL[pessoa.papel] ?? pessoa.papel}</span>
            {pessoa.setor || "Sem setor"}{pessoa.ativo ? "" : " · inativa"}
          </div>
        </div>
        <div className="sg-equipe-membro__acoes">
          {alterado?.id === pessoa.id && (
            <span className="sg-equipe-membro__alterado" role="status">✓ {alterado.mensagem}</span>
          )}
          <Dropdown align="end">
            <Dropdown.Toggle
              size="sm"
              variant="light"
              className="sg-btn sg-btn--secundario sg-btn--sm"
              disabled={ocupado}
              aria-label={`Ações para ${pessoa.nome}`}
            >
              Ações
            </Dropdown.Toggle>
            <Dropdown.Menu className="sg-equipe-menu">
              <Dropdown.Item
                as="button"
                disabled={destinos.length === 0}
                onClick={() => setConfirmacao({ tipo: "mover", pessoa, destino: "" })}
              >
                Mover para outra liderança…
                {destinos.length === 0 && <small>Nenhuma liderança disponível</small>}
              </Dropdown.Item>
              <Dropdown.Item
                as="button"
                disabled={Boolean(motivoPapel)}
                onClick={() => setConfirmacao({ tipo: "papel", pessoa, papel: novoPapel })}
              >
                {ehColaborador ? "Tornar liderança" : "Tornar colaborador"}
                {motivoPapel && <small>{motivoPapel}</small>}
              </Dropdown.Item>
              <Dropdown.Item as="button" onClick={() => abrirHistorico(pessoa)}>Ver histórico</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item as={Link} href={`/equipe/${pessoa.id}`}>Abrir ficha da pessoa</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </li>
    );
  }

  if (carregando) return <EstadoCarregamento mensagem="Carregando equipes..." />;

  return (
    <div className="d-flex flex-column gap-3">
      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

      <div className="sg-card">
        <div className="sg-card-body">
          <Form.Group controlId="busca-gestao-equipes">
            <Form.Label>Buscar pessoa, liderança ou setor</Form.Label>
            <Form.Control value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para filtrar as equipes" />
          </Form.Group>
          <p className="texto-xs texto-suave mt-2 mb-0">
            Toda transferência e mudança de perfil fica registrada no histórico da pessoa. Qualidade e
            Administrador podem liderar equipes, mas não respondem a uma liderança; o perfil deles é alterado em Usuários.
          </p>
        </div>
      </div>

      {grupos.orfaos.length > 0 && (
        <section className="sg-card sg-equipe-grupo sg-equipe-grupo--alerta" aria-label="Pessoas sem liderança ativa">
          <div className="sg-card-body">
            <h2 className="h6 mb-1">Sem liderança ativa ({grupos.orfaos.length})</h2>
            <p className="texto-xs texto-suave">Estas pessoas não têm liderança ou respondem a alguém inativo. Mova-as para uma liderança ativa.</p>
            <ul className="sg-equipe-membros">{grupos.orfaos.map(linhaPessoa)}</ul>
          </div>
        </section>
      )}

      {grupos.lista.length === 0 && grupos.orfaos.length === 0 && grupos.semEquipe.length === 0 ? (
        <EstadoVazio titulo="Nenhuma equipe encontrada" descricao="Ajuste a busca para ver outras equipes." />
      ) : (
        <div className="sg-equipes-grade">
          {grupos.lista.map(({ lider, membros }) => (
            <section key={lider.id} className="sg-card sg-equipe-grupo" aria-label={`Equipe de ${lider.nome}`}>
              <div className="sg-card-body">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <h2 className="h6 mb-0">{lider.nome}</h2>
                    <div className="texto-xs texto-suave">
                      <span className={`sg-badge ${COR_PAPEL[lider.papel] ?? "sg-badge--cinza"} me-1`}>{NOME_PAPEL[lider.papel]}</span>
                      {lider.setor || "Sem setor"}
                      {lider.supervisor_id ? ` · responde a ${nomes.get(lider.supervisor_id) ?? "—"}` : ""}
                    </div>
                  </div>
                  <span className="sg-badge sg-badge--cinza">{contarPessoas((porLider.get(lider.id) ?? []).length)}</span>
                </div>
                {membros.length === 0 ? (
                  <p className="texto-sm texto-suave mb-0">Nenhum liderado corresponde à busca.</p>
                ) : (
                  <ul className="sg-equipe-membros">{membros.map(linhaPessoa)}</ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {grupos.semEquipe.length > 0 && (
        <section className="sg-card" aria-label="Lideranças sem equipe">
          <div className="sg-card-body">
            <h2 className="h6 mb-2">Lideranças sem equipe ({grupos.semEquipe.length})</h2>
            <ul className="sg-equipe-sem-equipe">
              {grupos.semEquipe.map((lider) => (
                <li key={lider.id}>
                  {lider.nome}{" "}
                  <span className="texto-suave">
                    · {NOME_PAPEL[lider.papel] ?? lider.papel}
                    {lider.setor && lider.setor !== NOME_PAPEL[lider.papel] ? ` · ${lider.setor}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Modal show={!!confirmacao} onHide={() => !salvando && setConfirmacao(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">
            {confirmacao?.tipo === "mover"
              ? `Mover ${confirmacao.pessoa.nome}?`
              : `Tornar ${confirmacao?.pessoa.nome} ${confirmacao?.papel === "supervisor" ? "liderança" : "colaborador"}?`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          {confirmacao?.tipo === "mover" ? (
            <div className="sg-equipe-de-para">
              <div>
                <div className="texto-xs texto-suave">Liderança atual</div>
                <strong>{nomes.get(confirmacao.pessoa.supervisor_id) ?? "Sem liderança"}</strong>
              </div>
              <span aria-hidden="true" className="texto-suave">→</span>
              <Form.Group controlId="destino-equipe">
                <Form.Label className="texto-xs texto-suave mb-1">Nova liderança</Form.Label>
                <Form.Select
                  className="sg-input"
                  value={confirmacao.destino}
                  disabled={!!salvando}
                  onChange={(e) => setConfirmacao({ ...confirmacao, destino: e.target.value })}
                >
                  <option value="">Escolha…</option>
                  {destinosDe(confirmacao.pessoa).map((lider) => (
                    <option key={lider.id} value={lider.id}>{lider.nome} ({NOME_PAPEL[lider.papel]})</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          ) : confirmacao && (
            <p className="mb-0">
              Perfil: {NOME_PAPEL[confirmacao.pessoa.papel]} → <strong>{NOME_PAPEL[confirmacao.papel]}</strong>
            </p>
          )}
          <p className="texto-sm texto-suave mb-0">A mudança vale a partir de agora e fica registrada no histórico.</p>
        </Modal.Body>
        <Modal.Footer>
          <Botao variante="secundario" onClick={() => setConfirmacao(null)} disabled={!!salvando}>Cancelar</Botao>
          <Botao
            onClick={confirmar}
            carregando={!!salvando}
            disabled={confirmacao?.tipo === "mover" && !confirmacao.destino}
          >
            Confirmar mudança
          </Botao>
        </Modal.Footer>
      </Modal>

      <Modal show={!!historico} onHide={() => setHistorico(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">Histórico de equipe · {historico?.pessoa.nome}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!historico?.registros ? (
            <EstadoCarregamento mensagem="Carregando histórico..." compacto />
          ) : historico.registros.length === 0 ? (
            <p className="mb-0 texto-suave">Nenhuma alteração registrada.</p>
          ) : (
            <ol className="list-unstyled d-flex flex-column gap-2 mb-0">
              {historico.registros.map((item) => (
                <li key={item.id} className="texto-sm">
                  <div className="texto-xs texto-suave">
                    {formatarDataHora(item.criado_em)} · {item.alterado_por_nome} · {item.origem === "cadastro" ? "Cadastro de usuários" : "Gestão de equipes"}
                  </div>
                  {item.supervisor_anterior !== item.supervisor_novo && (
                    <div>Liderança: {item.supervisor_anterior_nome ?? "—"} → {item.supervisor_novo_nome ?? "—"}</div>
                  )}
                  {item.papel_anterior !== item.papel_novo && (
                    <div>Perfil: {NOME_PAPEL[item.papel_anterior] ?? "—"} → {NOME_PAPEL[item.papel_novo] ?? "—"}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
