import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

import BarraNavegacao from "../components/BarraNavegacao";
import {
  listarUsuarios,
  cadastrarUsuario,
  editarUsuario,
  desativarUsuario,
  reativarUsuario,
} from "../services/usuarioService";
import { AJUDA_SENHA_FORTE, erroSenhaForte } from "../services/senhaPolicy";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import Botao from "../components/ui/Botao";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import EstadoVazio from "../components/ui/EstadoVazio";
import MensagemErro from "../components/ui/MensagemErro";
import CampoTexto from "../components/ui/CampoTexto";
import CampoSelecao from "../components/ui/CampoSelecao";

const NOME_PAPEL = {
  adm: "Administrador",
  supervisor: "Supervisor",
  funcionario: "Funcionário",
};

const COR_PAPEL = {
  adm: "sg-badge--escuro",
  supervisor: "sg-badge--azul",
  funcionario: "sg-badge--cinza",
};

const PAPEIS_OPCOES = [
  { value: "funcionario", label: "Funcionário" },
  { value: "supervisor", label: "Supervisor" },
  { value: "adm", label: "Administrador (Qualidade)" },
];

function FormularioUsuario({ usuario, usuarios, aoSalvar, aoFechar }) {
  const editando = !!usuario;

  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [papel, setPapel] = useState(usuario?.papel ?? "funcionario");
  const [setor, setSetor] = useState(usuario?.setor ?? "");
  const [supervisorId, setSupervisorId] = useState(usuario?.supervisor_id ?? "");
  const [senhaInicial, setSenhaInicial] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const supervisoresDisponiveis = usuarios.filter(
    (u) =>
      (u.papel === "supervisor" || u.papel === "adm") &&
      u.id !== usuario?.id
  );

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");

    if (papel !== "adm" && !supervisorId) {
      setErro("Selecione o supervisor.");
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
          setor: setor || null,
          supervisor_id: papel === "adm" ? null : supervisorId,
        });
      } else {
        await cadastrarUsuario({
          nome,
          email,
          papel,
          setor: setor || null,
          supervisor_id: papel === "adm" ? null : supervisorId,
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

      <CampoTexto
        rotulo="Setor"
        value={setor}
        onChange={(e) => setSetor(e.target.value)}
      />

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

      {papel !== "adm" && (
        <CampoSelecao
          rotulo="Supervisor"
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

export default function UsuariosPage() {
  const { usuario: usuarioLogado } = useAuth();
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setUsuarios(await listarUsuarios());
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? e.message
          : "Não foi possível carregar os usuários."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

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

    const ehAdm = usuarioLogado.papel === "adm";
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
      <BarraNavegacao />
      <Container className="sg-container">
        <CabecalhoPagina
          titulo="Usuários"
          subtitulo="Gerencie os usuários e permissões do sistema"
          acoes={
            <Botao variante="primario" onClick={() => setModal("novo")}>
              + Novo usuário
            </Botao>
          }
        />

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
                              navigate(`/usuarios/${u.id}/dossie`)
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
      </Container>

      <Modal show={modal !== null} onHide={() => setModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">{tituloModal}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modal !== null && (
            <FormularioUsuario
              usuario={modal === "novo" ? null : modal}
              usuarios={usuarios}
              aoSalvar={aoSalvarComSucesso}
              aoFechar={() => setModal(null)}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
