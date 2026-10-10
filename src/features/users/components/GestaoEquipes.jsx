"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import Botao from "../../../components/ui/Botao.jsx";
import CardMetrica from "../../../components/ui/CardMetrica.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import { NOME_PAPEL } from "../../../lib/auth/papeis.js";
import { formatarDataHora } from "../../../lib/utils/formato.js";
import { alterarEquipe, listarEquipe, listarHistoricoEquipe, listarLiderancas } from "../client/usuarioService.js";

const SEM_LIDERANCA = "__sem_lideranca__";
const FILTROS_PAPEL = [["", "Todos"], ["supervisor", "Supervisor"], ["funcionario", "Colaborador"]];
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
 * Montagem das equipes (Qualidade e Administrador): árvore de lideranças, transferência
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
  const [filtroPapel, setFiltroPapel] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  // Lideranças recolhidas na árvore; por padrão tudo aberto.
  const [recolhidos, setRecolhidos] = useState(() => new Set());
  const [salvando, setSalvando] = useState("");
  const [historico, setHistorico] = useState(null);
  // Mudança aguardando confirmação: { tipo: "mover" | "papel", pessoa, destino?, papel? }.
  // Os dados ficam guardados depois de fechar, para o modal não perder o conteúdo na animação de saída.
  const [confirmacao, setConfirmacao] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

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

  const arvore = useMemo(() => {
    const idsLideres = new Set(liderancas.map((lider) => lider.id));
    const idsPessoas = new Set(pessoas.map((pessoa) => pessoa.id));
    // Só liderança ativa tem liderados na árvore; os de liderança inativa ficam em "sem liderança ativa".
    const filhosDe = (id) => (idsLideres.has(id) ? porLider.get(id) ?? [] : []);
    // Pessoas sem liderança ou cuja liderança está inativa: precisam de atenção.
    const orfaos = pessoas.filter((pessoa) => !pessoa.supervisor_id || !idsLideres.has(pessoa.supervisor_id));
    // Qualidade e Administrador não respondem a ninguém: são as raízes da árvore.
    const raizes = liderancas.filter((lider) => !idsPessoas.has(lider.id));

    const termo = normalizar(busca.trim());
    const filtrando = Boolean(termo || filtroPapel || filtroSetor);
    const combina = (pessoa) =>
      (!termo || [pessoa.nome, pessoa.setor, NOME_PAPEL[pessoa.papel]].some((v) => normalizar(v).includes(termo)))
      && (!filtroPapel || pessoa.papel === filtroPapel)
      && (!filtroSetor || pessoa.setor === filtroSetor);

    // Nó visível quando combina com os filtros ou tem algum descendente que combina.
    const montar = (pessoa, nivel, vistos) => {
      if (vistos.has(pessoa.id)) return null;
      const proximos = new Set(vistos).add(pessoa.id);
      const total = filhosDe(pessoa.id).length;
      const filhos = filhosDe(pessoa.id).map((filho) => montar(filho, nivel + 1, proximos)).filter(Boolean);
      if (!combina(pessoa) && filhos.length === 0) return null;
      return { pessoa, nivel, total, filhos, lidera: idsLideres.has(pessoa.id) };
    };

    const nos = raizes.map((lider) => montar(lider, 0, new Set())).filter(Boolean);
    return {
      filtrando,
      raizes: nos.filter((no) => no.total > 0),
      // Lideranças sem nenhum liderado viram uma linha compacta, sem nó próprio.
      semEquipe: nos.filter((no) => no.total === 0).map((no) => no.pessoa),
      orfaos: orfaos.map((pessoa) => montar(pessoa, 0, new Set())).filter(Boolean),
      resumo: {
        liderancas: liderancas.length,
        colaboradores: pessoas.filter((pessoa) => pessoa.papel === "funcionario" && pessoa.ativo).length,
        orfaos: orfaos.length,
      },
    };
  }, [liderancas, pessoas, porLider, busca, filtroPapel, filtroSetor]);

  const idsPessoas = useMemo(() => new Set(pessoas.map((pessoa) => pessoa.id)), [pessoas]);

  const setores = useMemo(
    () => [...new Set([...liderancas, ...pessoas].map((pessoa) => pessoa.setor).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [liderancas, pessoas],
  );

  const idsComFilhos = useMemo(
    () => liderancas.filter((lider) => (porLider.get(lider.id) ?? []).length > 0).map((lider) => lider.id),
    [liderancas, porLider],
  );

  function alternar(id) {
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function destinosDe(pessoa) {
    const bloqueados = descendentes(pessoa.id, porLider);
    return liderancas.filter((lider) => lider.id !== pessoa.id && lider.id !== pessoa.supervisor_id && !bloqueados.has(lider.id));
  }

  function abrirConfirmacao(dados) {
    setConfirmacao(dados);
    setConfirmando(true);
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
      setConfirmando(false);
      setAlterado({ id: pessoa.id, mensagem });
    } catch (e) {
      setConfirmando(false);
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

  function acoesPessoa(pessoa) {
    const destinos = destinosDe(pessoa);
    const ocupado = salvando === pessoa.id;
    const temLiderados = (porLider.get(pessoa.id) ?? []).length > 0;
    const ehColaborador = pessoa.papel === "funcionario";
    const novoPapel = ehColaborador ? "supervisor" : "funcionario";
    const motivoPapel = !pessoa.supervisor_id
      ? "Defina uma liderança antes"
      : !ehColaborador && temLiderados ? "Transfira os liderados antes" : "";
    return (
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
              onClick={() => abrirConfirmacao({ tipo: "mover", pessoa, destino: "" })}
            >
              Mover para outra liderança…
              {destinos.length === 0 && <small>Nenhuma liderança disponível</small>}
            </Dropdown.Item>
            <Dropdown.Item
              as="button"
              disabled={Boolean(motivoPapel)}
              onClick={() => abrirConfirmacao({ tipo: "papel", pessoa, papel: novoPapel })}
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
    );
  }

  function renderNo(no) {
    const { pessoa, nivel, total, filhos, lidera } = no;
    // Qualidade e Administrador não estão na lista de pessoas: sem ações nem ficha aqui.
    const gerenciavel = idsPessoas.has(pessoa.id);
    // Com filtro ativo a árvore fica aberta, para os resultados não sumirem num ramo recolhido.
    const aberto = arvore.filtrando || !recolhidos.has(pessoa.id);
    const inativa = gerenciavel && !pessoa.ativo;
    return (
      <li key={pessoa.id}>
        <div className={`sg-equipe-no${inativa ? " sg-equipe-membro--inativo" : ""}`} style={{ "--nivel": nivel }}>
          {filhos.length > 0 ? (
            <button
              type="button"
              className="sg-equipe-no__alternar"
              aria-expanded={aberto}
              aria-label={`${aberto ? "Recolher" : "Expandir"} equipe de ${pessoa.nome}`}
              onClick={() => alternar(pessoa.id)}
              disabled={arvore.filtrando}
            >
              {aberto ? "▾" : "▸"}
            </button>
          ) : (
            <span className="sg-equipe-no__alternar" aria-hidden="true" />
          )}
          <div className="sg-equipe-membro__info">
            {gerenciavel
              ? <Link href={`/equipe/${pessoa.id}`} className="fw-semibold">{pessoa.nome}</Link>
              : <span className="fw-semibold">{pessoa.nome}</span>}
            <div className="texto-xs texto-suave">
              <span className={`sg-badge ${COR_PAPEL[pessoa.papel] ?? "sg-badge--cinza"} me-1`}>{NOME_PAPEL[pessoa.papel] ?? pessoa.papel}</span>
              {pessoa.setor || "Sem setor"}{inativa ? " · inativa" : ""}
            </div>
          </div>
          {lidera && <span className="sg-equipe-no__total texto-xs texto-suave">{contarPessoas(total)}</span>}
          {gerenciavel && acoesPessoa(pessoa)}
        </div>
        {aberto && filhos.length > 0 && <ul className="sg-equipe-arvore">{filhos.map(renderNo)}</ul>}
      </li>
    );
  }

  if (carregando) return <EstadoCarregamento mensagem="Carregando equipes..." />;

  return (
    <div className="d-flex flex-column gap-3">
      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

      <div className="sg-equipe-resumo">
        <CardMetrica rotulo="Lideranças" valor={arvore.resumo.liderancas} cor="azul" />
        <CardMetrica rotulo="Colaboradores" valor={arvore.resumo.colaboradores} cor="cinza" />
        <CardMetrica
          rotulo="Sem liderança ativa"
          valor={arvore.resumo.orfaos}
          cor={arvore.resumo.orfaos > 0 ? "vermelha" : "verde"}
        />
      </div>

      <div className="sg-card">
        <div className="sg-card-body">
          <div className="sg-equipe-filtros">
            <Form.Group controlId="busca-gestao-equipes" className="sg-equipe-filtros__busca">
              <Form.Label>Buscar pessoa, liderança ou setor</Form.Label>
              <Form.Control value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para filtrar as equipes" />
            </Form.Group>
            <div>
              <span className="form-label d-block" id="filtro-papel-equipes">Perfil</span>
              <div className="d-flex gap-2" role="group" aria-labelledby="filtro-papel-equipes">
                {FILTROS_PAPEL.map(([valor, rotulo]) => (
                  <Botao
                    key={rotulo}
                    tamanho="sm"
                    variante={filtroPapel === valor ? "primario" : "secundario"}
                    aria-pressed={filtroPapel === valor}
                    onClick={() => setFiltroPapel(valor)}
                  >
                    {rotulo}
                  </Botao>
                ))}
              </div>
            </div>
            <Form.Group controlId="filtro-setor-equipes">
              <Form.Label>Setor</Form.Label>
              <Form.Select className="sg-input" value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
                <option value="">Todos os setores</option>
                {setores.map((setor) => <option key={setor} value={setor}>{setor}</option>)}
              </Form.Select>
            </Form.Group>
          </div>
          <p className="texto-xs texto-suave mt-2 mb-0">
            Toda transferência e mudança de perfil fica registrada no histórico da pessoa. Qualidade e
            Administrador podem liderar equipes, mas não respondem a uma liderança; o perfil deles é alterado em Usuários.
          </p>
        </div>
      </div>

      {arvore.orfaos.length > 0 && (
        <section className="sg-card sg-equipe-grupo sg-equipe-grupo--alerta" aria-label="Pessoas sem liderança ativa">
          <div className="sg-card-body">
            <h2 className="h6 mb-1">Sem liderança ativa ({arvore.orfaos.length})</h2>
            <p className="texto-xs texto-suave">Estas pessoas não têm liderança ou respondem a alguém inativo. Mova-as para uma liderança ativa.</p>
            <ul className="sg-equipe-arvore">{arvore.orfaos.map(renderNo)}</ul>
          </div>
        </section>
      )}

      {arvore.raizes.length === 0 && arvore.orfaos.length === 0 && arvore.semEquipe.length === 0 ? (
        <EstadoVazio titulo="Nenhuma equipe encontrada" descricao="Ajuste a busca ou os filtros para ver outras equipes." />
      ) : arvore.raizes.length > 0 && (
        <section className="sg-card sg-equipe-grupo" aria-label="Estrutura das equipes">
          <div className="sg-equipe-arvore__cabecalho">
            <h2 className="h6 mb-0">Estrutura das equipes</h2>
            {!arvore.filtrando && (
              <div className="d-flex gap-1">
                <Botao variante="subtle" tamanho="sm" onClick={() => setRecolhidos(new Set())}>Expandir tudo</Botao>
                <Botao variante="subtle" tamanho="sm" onClick={() => setRecolhidos(new Set(idsComFilhos))}>Recolher tudo</Botao>
              </div>
            )}
          </div>
          <ul className="sg-equipe-arvore sg-equipe-arvore--raiz">{arvore.raizes.map(renderNo)}</ul>
        </section>
      )}

      {arvore.semEquipe.length > 0 && (
        <section className="sg-card" aria-label="Lideranças sem equipe">
          <div className="sg-card-body">
            <h2 className="h6 mb-2">Lideranças sem equipe ({arvore.semEquipe.length})</h2>
            <ul className="sg-equipe-sem-equipe">
              {arvore.semEquipe.map((lider) => (
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

      <Modal show={confirmando} onHide={() => !salvando && setConfirmando(false)} centered>
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
          <Botao variante="secundario" onClick={() => setConfirmando(false)} disabled={!!salvando}>Cancelar</Botao>
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
