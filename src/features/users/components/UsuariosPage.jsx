"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Table from "react-bootstrap/Table";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

import {
  listarUsuarios,
  listarEstrutura,
  cadastrarUsuario,
  editarUsuario,
  desativarUsuario,
  reativarUsuario,
} from "../client/usuarioService.js";
import { AJUDA_SENHA_FORTE, erroSenhaForte } from "../../auth/client/senhaPolicy.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { useOnboarding } from "../../onboarding/components/OnboardingContext.jsx";
import DicaContextual from "../../onboarding/components/DicaContextual.jsx";
import { ErroApi } from "../../../lib/api/client/api.js";
import Botao from "../../../components/ui/Botao.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import CampoTexto from "../../../components/ui/CampoTexto.jsx";
import CampoSelecao from "../../../components/ui/CampoSelecao.jsx";
import { caminhoDepartamento } from "../../../lib/estrutura/departamentos.js";
import { ehQualidade, NOME_PAPEL, podeLiderar } from "../../../lib/auth/papeis.js";

const COR_PAPEL = {
  adm: "sg-badge--escuro",
  qualidade: "sg-badge--verde",
  supervisor: "sg-badge--azul",
  funcionario: "sg-badge--cinza",
};

const PAPEIS_OPCOES = [
  { value: "funcionario", label: "Colaborador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "qualidade", label: "Qualidade" },
  { value: "adm", label: "Administrador do sistema (inclui Qualidade)" },
];

function FormularioUsuario({ usuario, usuarios, estrutura, aoSalvar, aoFechar }) {
  const editando = !!usuario;

  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [papel, setPapel] = useState(usuario?.papel ?? "funcionario");
  const [departamentoId, setDepartamentoId] = useState(usuario?.departamento_id ?? "");
  const [cargoId, setCargoId] = useState(usuario?.cargo_id ?? "");
  const [supervisorId, setSupervisorId] = useState(usuario?.supervisor_id ?? "");
  const [diretoria, setDiretoria] = useState(usuario?.diretoria ?? false);
  const [senhaInicial, setSenhaInicial] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const supervisoresDisponiveis = usuarios.filter(
    (u) =>
      u.ativo !== false &&
      podeLiderar(u.papel) &&
      u.id !== usuario?.id
  );

  // Só a Diretoria fica sem liderança. Na edição, a liderança só é escolhida por quem ainda
  // não tem uma; trocar de liderança é feito na aba Equipes, com confirmação e histórico.
  const escolheLideranca = !diretoria && (!editando || !usuario.supervisor_id);
  const lideranca = usuarios.find((u) => u.id === usuario?.supervisor_id);
  const departamentosAtivos = estrutura.departamentos.filter((d) => d.ativo);
  const cargosDoDepartamento = estrutura.cargos.filter((c) => c.ativo && (!c.departamento_id || c.departamento_id === departamentoId));
  const nomeDe = (lista, id) => lista.find((item) => item.id === id)?.nome;

  // O responsável pelo departamento é a liderança sugerida para quem entra nele (E9).
  function escolherDepartamento(id) {
    setDepartamentoId(id);
    const cargo = estrutura.cargos.find((c) => c.id === cargoId);
    if (cargo?.departamento_id && cargo.departamento_id !== id) setCargoId("");
    const responsavel = estrutura.departamentos.find((d) => d.id === id)?.responsavel_id;
    if (responsavel && !supervisorId && supervisoresDisponiveis.some((s) => s.id === responsavel)) setSupervisorId(responsavel);
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");

    if (escolheLideranca && !supervisorId) {
      setErro("Selecione a liderança. Só membros da Diretoria ficam sem liderança.");
      return;
    }

    if (!editando) {
      const erroPolitica = erroSenhaForte(senhaInicial);
      if (erroPolitica) {
        setErro(erroPolitica);
        return;
      }
    }

    setEnviando(true);

    try {
      if (editando) {
        await editarUsuario(usuario.id, {
          nome,
          papel,
          diretoria,
          supervisor_id: escolheLideranca ? supervisorId : null,
        });
      } else {
        await cadastrarUsuario({
          nome,
          email,
          papel,
          departamento_id: departamentoId || null,
          cargo_id: cargoId || null,
          diretoria,
          supervisor_id: diretoria ? null : supervisorId,
          senha_inicial: senhaInicial,
        });
      }

      aoSalvar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Form onSubmit={aoEnviar}>
      {erro && <MensagemErro mensagem={erro} />}

      <CampoTexto
        rotulo="Nome"
        obrigatorio
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        autoFocus
      />

      {!editando && (
        <CampoTexto
          rotulo="Email"
          obrigatorio
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}

      {editando ? (
        <p className="texto-sm mb-3">
          <span className="texto-suave">Departamento:</span>{" "}
          <strong>{usuario.departamento_id ? caminhoDepartamento(estrutura.departamentos, usuario.departamento_id) : usuario.setor || "—"}</strong>
          {usuario.cargo_id && <> · <span className="texto-suave">Cargo:</span> <strong>{nomeDe(estrutura.cargos, usuario.cargo_id)}</strong></>}
          <span className="d-block texto-xs texto-suave">Departamento e cargo são alterados na aba Equipes.</span>
        </p>
      ) : (
        <>
          <CampoSelecao rotulo="Departamento" value={departamentoId} onChange={(e) => escolherDepartamento(e.target.value)}>
            <option value="">Sem departamento</option>
            {departamentosAtivos.map((d) => (
              <option key={d.id} value={d.id}>{caminhoDepartamento(estrutura.departamentos, d.id)}</option>
            ))}
          </CampoSelecao>
          <CampoSelecao rotulo="Cargo" value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
            <option value="">Sem cargo</option>
            {cargosDoDepartamento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </CampoSelecao>
        </>
      )}

      <CampoSelecao
        rotulo="Papel"
        obrigatorio
        value={papel}
        onChange={(e) => setPapel(e.target.value)}
      >
        {PAPEIS_OPCOES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </CampoSelecao>

      <Form.Check
        type="switch"
        id="usuario-diretoria"
        className="mb-3"
        label="Membro da Diretoria (fica no topo da estrutura, sem liderança)"
        checked={diretoria}
        onChange={(e) => setDiretoria(e.target.checked)}
      />

      {editando && !escolheLideranca && !diretoria && (
        <p className="texto-sm mb-3">
          <span className="texto-suave">Liderança:</span> <strong>{lideranca?.nome ?? "—"}</strong>
          <span className="d-block texto-xs texto-suave">Para transferir esta pessoa, use a aba Equipes.</span>
        </p>
      )}

      {escolheLideranca && (
        <CampoSelecao
          rotulo="Liderança"
          obrigatorio
          value={supervisorId}
          onChange={(e) => setSupervisorId(e.target.value)}
        >
          <option value="">Selecione...</option>
          {supervisoresDisponiveis.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </CampoSelecao>
      )}

      {editando && escolheLideranca && supervisorId && (
        <p className="texto-xs texto-suave" role="status">
          Ao salvar a transferência, o acesso ao histórico de NCs passa a seguir a liderança atual: a nova cadeia poderá consultar o histórico; a anterior deixa de vê-lo. A Qualidade mantém a visão organizacional.
        </p>
      )}

      {!editando && (
        <CampoTexto
          rotulo="Senha inicial (provisória)"
          obrigatorio
          type="password"
          value={senhaInicial}
          onChange={(e) => setSenhaInicial(e.target.value)}
          placeholder="Senha forte provisória"
          helper={`${AJUDA_SENHA_FORTE} O usuário deverá trocá-la no primeiro acesso.`}
          autoComplete="new-password"
        />
      )}

      <div className="d-flex gap-2">
        <Botao type="submit" variante="primario" carregando={enviando}>
          {editando ? "Salvar alterações" : "Cadastrar"}
        </Botao>
        <Botao variante="secundario" onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Botao>
      </div>
    </Form>
  );
}

/**
 * Aba "Acessos" de Pessoas e equipes (só Administrador): contas, perfis, senha e status.
 */
export default function UsuariosPage() {
  const { usuario: usuarioLogado } = useAuth();
  const { concluirEtapa } = useOnboarding();
  const router = useRouter();

  const [usuarios, setUsuarios] = useState([]);
  const [estrutura, setEstrutura] = useState({ departamentos: [], cargos: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, dadosEstrutura] = await Promise.all([
        listarUsuarios(),
        // Sem a estrutura, o cadastro segue funcionando, só sem departamento e cargo.
        listarEstrutura().catch(() => ({ departamentos: [], cargos: [] })),
      ]);
      setUsuarios(lista);
      setEstrutura(dadosEstrutura);
      await concluirEtapa("checklist_usuarios", "checklist", {
        pagina: "usuarios",
      });
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível carregar os usuários."
      );
    } finally {
      setCarregando(false);
    }
  }, [concluirEtapa]);

  useEffect(() => {
    (async () => {
      await carregar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleAtivo(usuario) {
    try {
      if (usuario.ativo) {
        await desativarUsuario(usuario.id);
      } else {
        await reativarUsuario(usuario.id);
      }
      await carregar();
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível alterar o status do usuário."
      );
    }
  }

  function aoSalvarComSucesso() {
    setModal(null);
    carregar();
  }

  function podeVerEstatisticasDoUsuario(usuario) {
    if (!usuarioLogado) return false;

    const ehAdm = ehQualidade(usuarioLogado.papel);
    const ehProprioUsuario = usuarioLogado.id === usuario.id;
    const ehSupervisorDireto =
      usuarioLogado.papel === "supervisor" &&
      usuario.supervisor_id === usuarioLogado.id;

    return ehAdm || ehProprioUsuario || ehSupervisorDireto;
  }

  const tituloModal =
    modal === "novo"
      ? "Novo usuário"
      : modal
        ? "Editar usuário"
        : "";

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <p className="texto-sm texto-suave mb-0">Contas, perfis de acesso, senha e status de todas as pessoas.</p>
        <Botao variante="primario" onClick={() => setModal("novo")}>
          + Novo usuário
        </Botao>
      </div>

      <DicaContextual chave="dica_gestao_usuarios" className="mb-3" />

      {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

      {carregando ? (
        <EstadoCarregamento mensagem="Carregando usuários..." />
      ) : usuarios.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum usuário cadastrado"
          descricao="Cadastre o primeiro usuário para começar."
        />
      ) : (
        <div className="sg-tabela-wrap">
          <Table hover responsive className="align-middle">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Setor</th>
                <th>Papel</th>
                <th>Senha</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  className={u.ativo ? "" : "table-secondary text-muted"}
                >
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.setor || "-"}</td>
                  <td>
                    <span className={`sg-badge ${COR_PAPEL[u.papel] ?? "sg-badge--cinza"}`}>
                      {NOME_PAPEL[u.papel] ?? u.papel}
                    </span>
                    {u.diretoria && <span className="sg-badge sg-badge--escuro ms-1">Diretoria</span>}
                  </td>
                  <td>
                    <span
                      className={`sg-badge ${u.senha_provisoria ? "sg-badge--amarelo" : "sg-badge--verde"}`}
                    >
                      {u.senha_provisoria ? "Provisória" : "Definitiva"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`sg-badge ${u.ativo ? "sg-badge--verde" : "sg-badge--vermelho"}`}
                    >
                      {u.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      {podeVerEstatisticasDoUsuario(u) && (
                        <Botao
                          variante="secundario"
                          tamanho="sm"
                          onClick={() =>
                            router.push(`/usuarios/${u.id}/dossie?retorno=${encodeURIComponent("/equipe?aba=acessos")}`)
                          }
                        >
                          Dossiê
                        </Botao>
                      )}

                      <ButtonGroup size="sm">
                        <Button
                          variant="outline-secondary"
                          className="sg-btn sg-btn--subtle sg-btn--sm"
                          onClick={() => setModal(u)}
                        >
                          Editar
                        </Button>

                        {u.id !== usuarioLogado?.id && (
                          <Button
                            variant={u.ativo ? "outline-danger" : "outline-success"}
                            className={`sg-btn sg-btn--sm ${u.ativo ? "sg-btn--perigo" : "sg-btn--sucesso"}`}
                            onClick={() => toggleAtivo(u)}
                          >
                            {u.ativo ? "Desativar" : "Reativar"}
                          </Button>
                        )}
                      </ButtonGroup>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Modal show={modal !== null} onHide={() => setModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">{tituloModal}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modal !== null && (
            <FormularioUsuario
              usuario={modal === "novo" ? null : modal}
              usuarios={usuarios}
              estrutura={estrutura}
              aoSalvar={aoSalvarComSucesso}
              aoFechar={() => setModal(null)}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
