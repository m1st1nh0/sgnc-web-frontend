"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const [sucesso, setSucesso] = useState("");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState("");
  const [historico, setHistorico] = useState(null);

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
      .map((grupo) => ({ ...grupo, membros: grupo.membros.filter(combina), liderCombina: combina(grupo.lider) }))
      .filter((grupo) => grupo.liderCombina || grupo.membros.length > 0);
    return { lista: filtrados, orfaos: orfaos.filter(combina) };
  }, [liderancas, pessoas, porLider, busca]);

  async function aplicar(pessoa, dados, mensagem) {
    setErro("");
    setSucesso("");
    setSalvando(pessoa.id);
    try {
      await alterarEquipe(pessoa.id, dados);
      await carregar();
      setSucesso(mensagem);
    } catch (e) {
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
    const bloqueados = descendentes(pessoa.id, porLider);
    const destinos = liderancas.filter((lider) => lider.id !== pessoa.id && !bloqueados.has(lider.id));
    const ocupado = salvando === pessoa.id;
    const temLiderados = (porLider.get(pessoa.id) ?? []).length > 0;
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
          <Form.Select
            size="sm"
            className="sg-input"
            aria-label={`Mover ${pessoa.nome} para outra liderança`}
            value=""
            disabled={ocupado}
            onChange={(e) => {
              const destino = e.target.value;
              if (destino) aplicar(pessoa, { supervisor_id: destino }, `${pessoa.nome} agora responde a ${nomes.get(destino) ?? "nova liderança"}.`);
            }}
          >
            <option value="">Mover para…</option>
            {destinos.filter((lider) => lider.id !== pessoa.supervisor_id).map((lider) => (
              <option key={lider.id} value={lider.id}>{lider.nome} ({NOME_PAPEL[lider.papel]})</option>
            ))}
          </Form.Select>
          {pessoa.papel === "funcionario" ? (
            <Botao
              variante="secundario"
              tamanho="sm"
              disabled={ocupado || !pessoa.supervisor_id}
              onClick={() => aplicar(pessoa, { papel: "supervisor" }, `${pessoa.nome} agora é liderança.`)}
            >
              Tornar liderança
            </Botao>
          ) : (
            <Botao
              variante="secundario"
              tamanho="sm"
              disabled={ocupado || temLiderados || !pessoa.supervisor_id}
              title={temLiderados ? "Transfira os liderados antes" : undefined}
              onClick={() => aplicar(pessoa, { papel: "funcionario" }, `${pessoa.nome} agora é colaborador.`)}
            >
              Tornar colaborador
            </Botao>
          )}
          <Botao variante="subtle" tamanho="sm" onClick={() => abrirHistorico(pessoa)}>Histórico</Botao>
        </div>
      </li>
    );
  }

  if (carregando) return <EstadoCarregamento mensagem="Carregando equipes..." />;

  return (
    <div className="d-flex flex-column gap-3">
      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
      {sucesso && <div className="sg-alerta sg-alerta--sucesso mb-0" role="status">{sucesso}</div>}

      <div className="sg-card">
        <div className="sg-card-body">
          <Form.Group controlId="busca-gestao-equipes">
            <Form.Label>Buscar pessoa, liderança ou setor</Form.Label>
            <Form.Control value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para filtrar as equipes" />
          </Form.Group>
          <p className="texto-xs texto-suave mt-2 mb-0">
            Toda transferência e mudança de perfil fica registrada no histórico da pessoa. Perfis de Qualidade e
            Administrador ficam fora das equipes e são gerenciados em Usuários.
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

      {grupos.lista.length === 0 && grupos.orfaos.length === 0 ? (
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
                  <span className="sg-badge sg-badge--cinza">{(porLider.get(lider.id) ?? []).length} pessoa(s)</span>
                </div>
                {membros.length === 0 ? (
                  <p className="texto-sm texto-suave mb-0">Nenhum liderado direto.</p>
                ) : (
                  <ul className="sg-equipe-membros">{membros.map(linhaPessoa)}</ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

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
