import { useState } from "react";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import Botao from "./ui/Botao";

const NOME_PAPEL = {
  adm: "Administrador (Qualidade)",
  supervisor: "Supervisor",
  funcionario: "Funcionário",
};

function isRotaAtiva({ isActive }) {
  return isActive ? "nav-link active" : "nav-link";
}

export default function BarraNavegacao() {
  const { usuario, sair } = useAuth();
  const navigate = useNavigate();
  const [expandido, setExpandido] = useState(false);

  function aoSair() {
    sair();
    navigate("/login");
  }

  function aoNavegar() {
    setExpandido(false);
  }

  function iniciais(nome) {
    if (!nome) return "?";
    const partes = nome.trim().split(/\s+/);
    if (partes.length >= 2) {
      return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
    }
    return nome[0].toUpperCase();
  }

  return (
    <Navbar
      className="sg-navbar"
      expand="lg"
      expanded={expandido}
    >
      <Container className="sg-navbar__container">
        <Navbar.Brand as={NavLink} to="/" onClick={aoNavegar}>
          <span aria-hidden="true">NC</span>
          SGNC
        </Navbar.Brand>

        <Navbar.Toggle
          aria-controls="sgnc-navbar-nav"
          onClick={() => setExpandido((e) => !e)}
        />

        <Navbar.Collapse id="sgnc-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end onClick={aoNavegar} className={isRotaAtiva}>
              Não Conformidades
            </Nav.Link>
            <Nav.Link as={NavLink} to="/abrir-nc" onClick={aoNavegar} className={isRotaAtiva}>
              Abrir NC
            </Nav.Link>
            {usuario && (
              <Nav.Link
                as={NavLink}
                to={`/usuarios/${usuario.id}/estatisticas`}
                onClick={aoNavegar}
                className={isRotaAtiva}
              >
                Minhas estatísticas
              </Nav.Link>
            )}
            {usuario?.papel === "adm" && (
              <Nav.Link as={NavLink} to="/usuarios" end onClick={aoNavegar} className={isRotaAtiva}>
                Usuários
              </Nav.Link>
            )}
          </Nav>

          {usuario && (
            <div className="sg-navbar__usuario">
              <span className="sg-navbar__avatar" aria-hidden="true">
                {iniciais(usuario.nome)}
              </span>
              <div className="d-none d-md-block">
                <div className="sg-navbar__nome">{usuario.nome}</div>
                <div className="sg-navbar__papel">
                  {NOME_PAPEL[usuario.papel] ?? usuario.papel}
                </div>
              </div>
              <span className="sg-navbar__divider d-none d-md-block" aria-hidden="true" />
              <Botao variante="subtle" tamanho="sm" onClick={aoSair}>
                Sair
              </Botao>
            </div>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
