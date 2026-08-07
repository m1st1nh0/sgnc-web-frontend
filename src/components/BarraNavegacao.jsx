import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Button from "react-bootstrap/Button";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const NOME_PAPEL = {
  adm: "Administrador (Qualidade)",
  supervisor: "Supervisor",
  funcionario: "Funcionário",
};

export default function BarraNavegacao() {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();

  function aoSair() {
    sair();
    navigate("/login");
  }

  return (
    <Navbar bg="dark" variant="dark" className="mb-4">
      <Container>
        <Navbar.Brand href="/">SGNC</Navbar.Brand>
        <Nav className="me-auto">
          <Nav.Link href="/">Não Conformidades</Nav.Link>
          <Nav.Link href="/abrir-nc">Abrir NC</Nav.Link>
          {usuario && (
            <Nav.Link href={`/usuarios/${usuario.id}/estatisticas`}>
              Minhas estatísticas
            </Nav.Link>
          )}
          {usuario?.papel === "adm" && (
            <Nav.Link href="/usuarios">Usuários</Nav.Link>
          )}
        </Nav>
        {usuario && (
          <div className="d-flex align-items-center gap-3">
            <span className="text-light small">
              {usuario.nome} · {NOME_PAPEL[usuario.papel] ?? usuario.papel}
            </span>
            <Button variant="outline-light" size="sm" onClick={aoSair}>
              Sair
            </Button>
          </div>
        )}
      </Container>
    </Navbar>
  );
}
