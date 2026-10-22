"use client";

import { useEffect, useMemo, useState } from "react";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

import Botao from "../../../components/ui/Botao.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import { NOME_PAPEL } from "../../../lib/auth/papeis.js";
import { caminhoDepartamento, temCicloDepartamento } from "../../../lib/estrutura/departamentos.js";
import { limparRascunho, useRascunho } from "../../../lib/utils/rascunho.js";
import { listarEstrutura, listarLiderancas, salvarCargo, salvarDepartamento } from "../client/usuarioService.js";

function contarPessoas(total) {
  if (!total) return "Nenhuma pessoa";
  return total === 1 ? "1 pessoa" : `${total} pessoas`;
}

/**
 * Aba "Estrutura" (Qualidade e Administrador): departamentos, com área-mãe e responsável,
 * e cargos. A empresa está em expansão (E12): tudo é criado e alterado por aqui, e desativar
 * mantém o histórico.
 */
export default function EstruturaOrganizacional() {
  const [estrutura, setEstrutura] = useState({ departamentos: [], cargos: [] });
  const [liderancas, setLiderancas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  // Formulário aberto: { tipo: "departamento" | "cargo", item?: existente }.
  const [formulario, setFormulario] = useRascunho("estrutura", "formulario", null);
  const [aberto, setAberto] = useRascunho("estrutura", "aberto", false);

  async function carregar() {
    const [dados, lideres] = await Promise.all([listarEstrutura(), listarLiderancas()]);
    setEstrutura(dados);
    setLiderancas(lideres);
  }

  useEffect(() => {
    let ativo = true;
    Promise.all([listarEstrutura(), listarLiderancas()])
      .then(([dados, lideres]) => {
        if (!ativo) return;
        setEstrutura(dados);
        setLiderancas(lideres);
      })
      .catch((e) => { if (ativo) setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar a estrutura."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  const nomes = useMemo(() => new Map(liderancas.map((pessoa) => [pessoa.id, pessoa.nome])), [liderancas]);
  const cargosVisiveis = estrutura.cargos.filter((item) => mostrarInativos || item.ativo);

  // Árvore de departamentos: raízes são os sem área-mãe (ou com área-mãe fora da lista visível).
  const arvore = useMemo(() => {
    const departamentosVisiveis = estrutura.departamentos.filter((item) => mostrarInativos || item.ativo);
    const ids = new Set(departamentosVisiveis.map((item) => item.id));
    const filhos = new Map();
    for (const item of departamentosVisiveis) {
      const pai = item.departamento_pai_id && ids.has(item.departamento_pai_id) ? item.departamento_pai_id : null;
      filhos.set(pai, [...(filhos.get(pai) ?? []), item]);
    }
    const linhas = [];
    const visitar = (pai, nivel, vistos) => {
      for (const item of filhos.get(pai) ?? []) {
        if (vistos.has(item.id)) continue;
        linhas.push({ item, nivel });
        visitar(item.id, nivel + 1, new Set(vistos).add(item.id));
      }
    };
    visitar(null, 0, new Set());
    return linhas;
  }, [estrutura.departamentos, mostrarInativos]);

  function abrir(dados) {
    setFormulario(dados);
    setAberto(true);
  }

  // Cancelar ou salvar descarta o que foi digitado no modal.
  function fechar() {
    setAberto(false);
    limparRascunho("estrutura");
  }

  async function alternarAtivo(tipo, item) {
    setErro("");
    try {
      if (tipo === "departamento") await salvarDepartamento(item.id, { ativo: !item.ativo });
      else await salvarCargo(item.id, { ativo: !item.ativo });
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível alterar a estrutura.");
    }
  }

  if (carregando) return <EstadoCarregamento mensagem="Carregando estrutura..." />;

  return (
    <div className="d-flex flex-column gap-3">
      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <p className="texto-sm texto-suave mb-0">
          Departamentos e cargos da empresa. O departamento sugere a liderança de quem entra nele; o cargo descreve a
          função e não muda o perfil de acesso.
        </p>
        <Form.Check
          type="switch"
          id="estrutura-inativos"
          label="Mostrar desativados"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.target.checked)}
        />
      </div>

      <section className="sg-card sg-equipe-grupo" aria-label="Departamentos">
        <div className="sg-equipe-arvore__cabecalho">
          <h2 className="h6 mb-0">Departamentos</h2>
          <Botao tamanho="sm" onClick={() => abrir({ tipo: "departamento" })}>+ Novo departamento</Botao>
        </div>
        {arvore.length === 0 ? (
          <div className="sg-card-body">
            <EstadoVazio titulo="Nenhum departamento" descricao="Cadastre o primeiro departamento para organizar as pessoas por área." />
          </div>
        ) : (
          <ul className="sg-equipe-arvore sg-equipe-arvore--raiz">
            {arvore.map(({ item, nivel }) => (
              <li key={item.id}>
                <div className={`sg-equipe-no${item.ativo ? "" : " sg-equipe-membro--inativo"}`} style={{ "--nivel": nivel }}>
                  <div className="sg-equipe-membro__info">
                    <span className="fw-semibold">{item.nome}</span>
                    <div className="texto-xs texto-suave">
                      Responsável: {item.responsavel_id ? nomes.get(item.responsavel_id) ?? "—" : "não definido"}
                      {item.ativo ? "" : " · desativado"}
                    </div>
                  </div>
                  <span className="sg-equipe-no__total texto-xs texto-suave">{contarPessoas(item.pessoas)}</span>
                  <div className="sg-equipe-membro__acoes">
                    <Botao variante="secundario" tamanho="sm" onClick={() => abrir({ tipo: "departamento", item })}>Editar</Botao>
                    <Botao variante="subtle" tamanho="sm" onClick={() => alternarAtivo("departamento", item)}>
                      {item.ativo ? "Desativar" : "Reativar"}
                    </Botao>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sg-card sg-equipe-grupo" aria-label="Cargos">
        <div className="sg-equipe-arvore__cabecalho">
          <h2 className="h6 mb-0">Cargos</h2>
          <Botao tamanho="sm" onClick={() => abrir({ tipo: "cargo" })}>+ Novo cargo</Botao>
        </div>
        {cargosVisiveis.length === 0 ? (
          <div className="sg-card-body">
            <EstadoVazio titulo="Nenhum cargo" descricao="Cadastre cargos como CEO, Supervisor do suporte ou Desenvolvedor." />
          </div>
        ) : (
          <ul className="sg-equipe-arvore sg-equipe-arvore--raiz">
            {cargosVisiveis.map((item) => (
              <li key={item.id}>
                <div className={`sg-equipe-no${item.ativo ? "" : " sg-equipe-membro--inativo"}`}>
                  <div className="sg-equipe-membro__info">
                    <span className="fw-semibold">{item.nome}</span>
                    <div className="texto-xs texto-suave">
                      {item.lideranca && <span className="sg-badge sg-badge--azul me-1">Liderança</span>}
                      {item.departamento_id ? caminhoDepartamento(estrutura.departamentos, item.departamento_id) : "Todos os departamentos"}
                      {item.ativo ? "" : " · desativado"}
                    </div>
                  </div>
                  <span className="sg-equipe-no__total texto-xs texto-suave">{contarPessoas(item.pessoas)}</span>
                  <div className="sg-equipe-membro__acoes">
                    <Botao variante="secundario" tamanho="sm" onClick={() => abrir({ tipo: "cargo", item })}>Editar</Botao>
                    <Botao variante="subtle" tamanho="sm" onClick={() => alternarAtivo("cargo", item)}>
                      {item.ativo ? "Desativar" : "Reativar"}
                    </Botao>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal show={aberto} onHide={fechar} centered>
        {formulario && (
          <FormularioEstrutura
            key={`${formulario.tipo}-${formulario.item?.id ?? "novo"}`}
            formulario={formulario}
            departamentos={estrutura.departamentos}
            liderancas={liderancas}
            aoFechar={fechar}
            aoSalvar={async () => {
              fechar();
              await carregar();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FormularioEstrutura({ formulario, departamentos, liderancas, aoFechar, aoSalvar }) {
  const { tipo, item } = formulario;
  const ehDepartamento = tipo === "departamento";
  const escopo = `estrutura:form:${tipo}:${item?.id ?? "novo"}`;
  const [nome, setNome] = useRascunho(escopo, "nome", item?.nome ?? "");
  const [paiId, setPaiId] = useRascunho(escopo, "paiId", item?.departamento_pai_id ?? "");
  const [responsavelId, setResponsavelId] = useRascunho(escopo, "responsavelId", item?.responsavel_id ?? "");
  const [departamentoId, setDepartamentoId] = useRascunho(escopo, "departamentoId", item?.departamento_id ?? "");
  const [lideranca, setLideranca] = useRascunho(escopo, "lideranca", item?.lideranca ?? false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // Área-mãe: ativa, e nunca o próprio departamento nem algo abaixo dele.
  const areasMae = departamentos.filter((d) => d.ativo && (!item || !temCicloDepartamento(departamentos, item.id, d.id)));
  const ativos = departamentos.filter((d) => d.ativo);

  async function enviar(evento) {
    evento.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      if (ehDepartamento) {
        await salvarDepartamento(item?.id, { nome, departamento_pai_id: paiId || null, responsavel_id: responsavelId || null });
      } else {
        await salvarCargo(item?.id, { nome, departamento_id: departamentoId || null, lideranca });
      }
      await aoSalvar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Form onSubmit={enviar}>
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          {item ? "Editar" : "Novo"} {ehDepartamento ? "departamento" : "cargo"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        {erro && <MensagemErro mensagem={erro} />}
        <Form.Group controlId="estrutura-nome">
          <Form.Label>Nome</Form.Label>
          <Form.Control value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        </Form.Group>
        {ehDepartamento ? (
          <>
            <Form.Group controlId="estrutura-pai">
              <Form.Label>Área-mãe</Form.Label>
              <Form.Select className="sg-input" value={paiId} onChange={(e) => setPaiId(e.target.value)}>
                <option value="">Nenhuma (área principal)</option>
                {areasMae.map((d) => <option key={d.id} value={d.id}>{caminhoDepartamento(departamentos, d.id)}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="estrutura-responsavel">
              <Form.Label>Responsável</Form.Label>
              <Form.Select className="sg-input" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                <option value="">Não definido</option>
                {liderancas.map((p) => <option key={p.id} value={p.id}>{p.nome} ({NOME_PAPEL[p.papel]})</option>)}
              </Form.Select>
              <Form.Text>É a liderança sugerida para quem entra no departamento.</Form.Text>
            </Form.Group>
          </>
        ) : (
          <>
            <Form.Group controlId="estrutura-departamento">
              <Form.Label>Departamento</Form.Label>
              <Form.Select className="sg-input" value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
                <option value="">Todos os departamentos</option>
                {ativos.map((d) => <option key={d.id} value={d.id}>{caminhoDepartamento(departamentos, d.id)}</option>)}
              </Form.Select>
            </Form.Group>
            <Form.Check
              type="switch"
              id="estrutura-lideranca"
              label="Cargo de liderança (sugere o perfil Supervisor, sem trocá-lo sozinho)"
              checked={lideranca}
              onChange={(e) => setLideranca(e.target.checked)}
            />
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Botao variante="secundario" onClick={aoFechar} disabled={enviando}>Cancelar</Botao>
        <Botao type="submit" carregando={enviando}>Salvar</Botao>
      </Modal.Footer>
    </Form>
  );
}
