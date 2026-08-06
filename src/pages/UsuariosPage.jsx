import { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import BarraNavegacao from "../components/BarraNavegacao";
import { listarUsuarios, cadastrarUsuario } from "../services/usuarioService";
import { ErroApi } from "../services/api";

const NOME_PAPEL = {
  adm: "Administrador",
  supervisor: "Supervisor",
  funcionario: "Funcionário",
};

const COR_PAPEL = {
  adm: "dark",
  supervisor: "primary",
  funcionario: "secondary",
};

function FormularioNovoUsuario({ usuarios, aoCriar, aoFechar }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("funcionario");
  const [setor, setSetor] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [senhaInicial, setSenhaInicial] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const supervisoresDisponiveis = usuarios.filter(
    (u) => u.papel === "supervisor" || u.papel === "adm"
  );

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro("");

    if (papel !== "adm" && !supervisorId) {
      setErro("Selecione o supervisor deste usuário.");
      return;
    }
    if (senhaInicial.length < 6) {
      setErro("Senha inicial deve ter ao menos 6 caracteres.");
      return;
    }

    setEnviando(true);
    try {
      await cadastrarUsuario({
        nome,
        email,
        papel,
        setor: setor || null,
        supervisor_id: papel === "adm" ? null : supervisorId,
        senha_inicial: senhaInicial,
      });
      aoCriar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível cadastrar o usuário.");
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

      <Form.Group className="mb-3">
        <Form.Label>Email *</Form.Label>
        <Form.Control
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Setor</Form.Label>
        <Form.Control value={setor} onChange={(e) => setSetor(e.target.value)} />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Papel *</Form.Label>
        <Form.Select value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="funcionario">Funcionário</option>
          <option value="supervisor">Supervisor</option>
          <option value="adm">Administrador (Qualidade)</option>
        </Form.Select>
      </Form.Group>

      {papel !== "adm" && (
        <Form.Group className="mb-3">
          <Form.Label>Supervisor *</Form.Label>
          <Form.Select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} required>
            <option value="">Selecione...</option>
            {supervisoresDisponiveis.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      )}

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
          O usuário será obrigado a trocar essa senha no primeiro acesso.
        </Form.Text>
      </Form.Group>

      <div className="d-flex gap-2">
        <Button type="submit" variant="primary" disabled={enviando}>
          {enviando ? "Cadastrando..." : "Cadastrar"}
        </Button>
        <Button variant="outline-secondary" onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </Form>
  );
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

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

  useEffect(() => {
    carregar();
  }, []);

  function aoCriarComSucesso() {
    setMostrarModal(false);
    carregar();
  }

  return (
    <div>
      <BarraNavegacao />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="h4 mb-0">Usuários</h1>
          <Button variant="primary" onClick={() => setMostrarModal(true)}>
            + Novo usuário
          </Button>
        </div>

        {erro && <Alert variant="danger">{erro}</Alert>}

        {carregando ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : (
          <Table hover responsive className="bg-white shadow-sm">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Setor</th>
                <th>Papel</th>
                <th>Senha</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.setor || "-"}</td>
                  <td>
                    <Badge bg={COR_PAPEL[u.papel] ?? "secondary"}>
                      {NOME_PAPEL[u.papel] ?? u.papel}
                    </Badge>
                  </td>
                  <td>
                    {u.senha_provisoria ? (
                      <Badge bg="warning" text="dark">
                        Provisória
                      </Badge>
                    ) : (
                      <Badge bg="success">Definitiva</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Container>

      <Modal show={mostrarModal} onHide={() => setMostrarModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">Novo usuário</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FormularioNovoUsuario
            usuarios={usuarios}
            aoCriar={aoCriarComSucesso}
            aoFechar={() => setMostrarModal(false)}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
