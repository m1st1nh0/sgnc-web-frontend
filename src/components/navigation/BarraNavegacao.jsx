import { useState } from "react";
import Navbar from "react-bootstrap/Navbar";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "../../features/auth/components/AuthContext.jsx";
import { useOnboarding } from "../../features/onboarding/components/OnboardingContext.jsx";
import Botao from "../ui/Botao.jsx";
import MarcaSgnc from "../ui/MarcaSgnc.jsx";

const NOME_PAPEL = {
  adm: "Administrador (Qualidade)",
  supervisor: "Supervisor",
  funcionario: "Funcionário",
};

const ROTULO_HOME = {
  adm: "Gestão de NCs",
  supervisor: "Minha equipe",
  funcionario: "Minhas NCs",
};

export default function BarraNavegacao() {
  const { usuario, sair } = useAuth();
  const { progresso, restaurar, abrirRevisao } = useOnboarding();
  const pathname = usePathname();
  const [expandido, setExpandido] = useState(false);

  async function aoAbrirGuia() {
    if (progresso?.status === "dispensado") {
      await restaurar();
    }
    await abrirRevisao();
    setExpandido(false);
  }

  async function aoSair() {
    await sair();
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

  const ehGestao = usuario?.papel === "adm" || usuario?.papel === "supervisor";

  return (
    <Navbar className="sg-navbar" expand="lg" expanded={expandido}>
      <Container className="sg-navbar__container">
        <Navbar.Brand as={Link} href="/" onClick={aoNavegar}>
          <MarcaSgnc />
        </Navbar.Brand>

        <Navbar.Toggle
          aria-controls="sgnc-navbar-nav"
          aria-label={expandido ? "Fechar navegação" : "Abrir navegação"}
          onClick={() => setExpandido((e) => !e)}
        />

        <Navbar.Collapse id="sgnc-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} href="/" onClick={aoNavegar} active={pathname === "/"}>
              {ROTULO_HOME[usuario?.papel] || "Não Conformidades"}
            </Nav.Link>
            {usuario && <Nav.Link as={Link} href="/minhas-ncs" onClick={aoNavegar} active={pathname === "/minhas-ncs"}>Acompanhar minhas NCs</Nav.Link>}
            <Nav.Link as={Link} href="/abrir-nc" onClick={aoNavegar} active={pathname === "/abrir-nc"}>
              Abrir NC
            </Nav.Link>
            {ehGestao && (
              <Nav.Link as={Link} href="/equipe" onClick={aoNavegar} active={pathname === "/equipe" || pathname.startsWith("/equipe/")}>
                Pessoas e NCs
              </Nav.Link>
            )}
            {ehGestao && (
              <Nav.Link as={Link} href="/insights" onClick={aoNavegar} active={pathname === "/insights"}>
                Insights
              </Nav.Link>
            )}
            {ehGestao && (
              <Nav.Link as={Link} href="/relatorios" onClick={aoNavegar} active={pathname === "/relatorios"}>
                Relatórios
              </Nav.Link>
            )}
            {usuario && (
              <Nav.Link
                as={Link}
                href={`/usuarios/${usuario.id}/dossie`}
                onClick={aoNavegar}
                active={pathname === `/usuarios/${usuario.id}/dossie`}
              >
                Meu dossiê
              </Nav.Link>
            )}
            {usuario?.papel === "adm" && (
              <Nav.Link as={Link} href="/usuarios" onClick={aoNavegar} active={pathname === "/usuarios"}>
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
              <Botao variante="subtle" tamanho="sm" onClick={aoAbrirGuia}>
                Guia
              </Botao>
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
