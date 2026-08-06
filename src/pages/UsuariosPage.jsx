import { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import BarraNavegacao from "../components/BarraNavegacao";
import {
  listarUsuarios,
  cadastrarUsuario,
  editarUsuario,
  desativarUsuario,
  reativarUsuario,
} from "../services/usuarioService";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";

const NOME_PAPEL = { adm: "Administrador", supervisor: "Supervisor", funcionario: "Funcionário" };
const COR_PAPEL = { adm: "dark", supervisor: "primary", funcionario: "secondary" };
const PAPEIS_OPCOES = [
  { value: "funcionario", label: "Funcionário" },
  { value: "supervisor", label: "Supervisor" },
  { value: "adm", label: "Administrador (Qualidade)" },
];

// ─── Formulário reutilizado para cadastro e edição ───────────────────────────
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
    (u) => (u.papel === "supervisor" || u.papel === "adm") && u.id !== usuario?.id
  );

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");

    if (papel !== "adm" && !supervisorId) {
      setErro("Selecione o supervisor.");
      return;
    }
    if (!editando && senhaInicial.length < 6) {
      setErro("Senha inicial deve ter ao menos 6 caracteres.");
      return;
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
      {erro && <Alert variant="danger">{erro}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Nome *</Form.Label>
        <Form.Control value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
      </Form.Group>

      {!editando && (
        <Form.Group className="mb-3">
          <Form.Label>Email *</Form.Label>
          <Form.Control
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Form.Group>
      )}

      <Form.Group className="mb-3">
        <Form.Label>Setor</Form.Label>
        <Form.Control value={setor} onChange={(e) => setSetor(e.target.value)} />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Papel *</Form.Label>
        <Form.Select value={papel} onChange={(e) => setPapel(e.target.value)}>
          {PAPEIS_OPCOES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Form.Select>
      </Form.Group>

      {papel !== "adm" && (
        <Form.Group className="mb-3">
          <Form.Label>Supervisor *</Form.Label>
          <Form.Select
            value={supervisorId}
            onChange={(e) => setSupervisorId(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {supervisoresDisponiveis.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </Form.Select>
        </Form.Group>
      )}

      {!editando && (
        <Form.Group className="mb-4">
          <Form.Label>Senha inicial (provisória) *</Form.Label>
          <Form.Control
            type="text"
            value={senhaInicial}
            onChange={(e) => setSenhaInicial(e.target.value)}
            placeholder="Ao menos 6 caracteres"
            required
          />
          <Form.Text className="text-muted">
            O usuário será obrigado a trocar no primeiro acesso.
          </Form.Text>
        </Form.Group>
      )}

      <div className="d-flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar"}
        </Button>
        <Button variant="outline-secondary" onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </Form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const { usuario: usuarioLogado } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // Modal: "novo" | {usuario} para editar | null
  const [modal, setModal] = useState(null);

  async function carregar() {
    setCarregando(true);
    try {
      setUsuarios(await listarUsuarios());
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar os usuários.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function toggleAtivo(usuario) {
    try {
      if (usuario.ativo) {
        await desativarUsuario(usuario.id);
      } else {
        await reativarUsuario(usuario.id);
      }
      carregar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível alterar o status do usuário.");
    }
  }

  function aoSalvarComSucesso() {
    setModal(null);
    carregar();
  }

  const tituloModal = modal === "novo"
    ? "Novo usuário"
    : modal ? "Editar usuário" : "";

  return (
    <div>
      <BarraNavegacao />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="h4 mb-0">Usuários</h1>
          <Button variant="primary" onClick={() => setModal("novo")}>+ Novo usuário</Button>
        </div>

        {erro && <Alert variant="danger" dismissible onClose={() => setErro("")}>{erro}</Alert>}

        {carregando ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : (
          <Table hover responsive className="bg-white shadow-sm align-middle">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Setor</th>
                <th>Papel</th>
                <th>Senha</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={u.ativo ? "" : "table-secondary text-muted"}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.setor || "-"}</td>
                  <td>
                    <Badge bg={COR_PAPEL[u.papel] ?? "secondary"}>
                      {NOME_PAPEL[u.papel] ?? u.papel}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg={u.senha_provisoria ? "warning" : "success"} text={u.senha_provisoria ? "dark" : undefined}>
                      {u.senha_provisoria ? "Provisória" : "Definitiva"}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg={u.ativo ? "success" : "danger"}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td>
                    <ButtonGroup size="sm">
                      <Button
                        variant="outline-secondary"
                        onClick={() => setModal(u)}
                      >
                        Editar
                      </Button>
                      {u.id !== usuarioLogado?.id && (
                        <Button
                          variant={u.ativo ? "outline-danger" : "outline-success"}
                          onClick={() => toggleAtivo(u)}
                        >
                          {u.ativo ? "Desativar" : "Reativar"}
                        </Button>
                      )}
                    </ButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
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
