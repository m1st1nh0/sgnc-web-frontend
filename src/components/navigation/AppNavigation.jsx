"use client";

import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../features/auth/components/AuthContext.jsx";
import { useOnboarding } from "../../features/onboarding/components/OnboardingContext.jsx";
import MarcaSgnc from "../ui/MarcaSgnc.jsx";
import BarraAbas from "./BarraAbas.jsx";
import Icon from "./icones.jsx";
import SinoNotificacoes from "../../features/notificacoes/components/SinoNotificacoes.jsx";
import { ehQualidade, NOME_PAPEL } from "../../lib/auth/papeis.js";

const ROTULO_HOME = { adm: "Gestão de NCs", qualidade: "Gestão de NCs", supervisor: "NCs da equipe", funcionario: "Minhas NCs" };
const MEDIA_MOBILE = "(max-width: 600px)";
const MEDIA_TABLET = "(min-width: 600.01px) and (max-width: 1023.98px)";

function assinarFaixa(aviso) {
  const consultas = [window.matchMedia(MEDIA_MOBILE), window.matchMedia(MEDIA_TABLET)];
  consultas.forEach((consulta) => consulta.addEventListener("change", aviso));
  return () => consultas.forEach((consulta) => consulta.removeEventListener("change", aviso));
}
function faixaAtual() {
  if (window.matchMedia(MEDIA_MOBILE).matches) return "mobile";
  return window.matchMedia(MEDIA_TABLET).matches ? "tablet" : "desktop";
}

export default function AppNavigation({ children, compactaInicial = true }) {
  const { usuario, sair } = useAuth();
  const { progresso, restaurar, abrirRevisao } = useOnboarding();
  const pathname = usePathname();
  // Desktop e iPad paisagem: menu recolhido por padrão; a escolha do usuário fica em cookie.
  const [compacta, setCompacta] = useState(compactaInicial);
  // iPad retrato: trilho de ícones que expande sobre o conteúdo.
  const [overlayAberta, setOverlayAberta] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const faixa = useSyncExternalStore(assinarFaixa, faixaAtual, () => "desktop");
  const botaoMenuRef = useRef(null);
  const botaoFecharRef = useRef(null);
  const botaoAlternarRef = useRef(null);
  const menuSobreposto = (faixa === "mobile" && mobileOpen) || (faixa === "tablet" && overlayAberta);
  const ehGestao = ehQualidade(usuario?.papel) || usuario?.papel === "supervisor";
  const ehQ = ehQualidade(usuario?.papel);
  const rotuloHome = ROTULO_HOME[usuario?.papel] || "Gestão de NCs";
  // Visibilidade por perfil igual à anterior; só a ordem e o agrupamento mudaram (redesign 10/2026).
  const grupos = [
    { titulo: "Operação", links: [
      { label: rotuloHome, href: "/", icon: "home", show: true, active: pathname === "/" },
      // O colaborador já tem "Minhas NCs" como início; o rótulo antigo evita dois itens com o mesmo nome.
      { label: rotuloHome === "Minhas NCs" ? "Acompanhar minhas NCs" : "Minhas NCs", href: "/minhas-ncs", icon: "eye", show: !!usuario, active: pathname === "/minhas-ncs" },
      { label: "Abrir NC", href: "/abrir-nc", icon: "add", show: true, active: pathname === "/abrir-nc" },
    ] },
    { titulo: "Análise", links: [
      { label: "Insights", href: "/insights", icon: "chart", show: ehGestao, active: pathname === "/insights" },
      { label: "Relatórios", href: "/relatorios", icon: "report", show: ehGestao, active: pathname === "/relatorios" },
    ] },
    { titulo: "Cadastros", links: [
      { label: ehQ ? "Pessoas e equipes" : "Minha equipe", href: "/equipe", icon: "people", show: ehGestao, active: pathname === "/equipe" || pathname.startsWith("/equipe/") },
      { label: "Causas", href: "/causas", icon: "cause", show: ehQ, active: pathname === "/causas" },
      { label: "Medidas disciplinares", href: "/medidas", icon: "shield", show: ehQ, active: pathname === "/medidas" },
      { label: "Meu dossiê", href: `/usuarios/${usuario?.id}/dossie`, icon: "folder", show: !!usuario, active: pathname === `/usuarios/${usuario?.id}/dossie` },
    ] },
  ].map((grupo) => ({ ...grupo, links: grupo.links.filter((link) => link.show) })).filter((grupo) => grupo.links.length > 0);

  // Módulos que podem virar aba interna: exatamente os links visíveis para o perfil.
  const chaveModulos = grupos.flatMap((grupo) => grupo.links.map((link) => `${link.href}|${link.label}|${link.icon}`)).join(",");
   
  const modulos = useMemo(() => chaveModulos.split(",").filter(Boolean).map((item) => {
    const [href, label, icon] = item.split("|");
    return { href, label, icon };
  }), [chaveModulos]);

  useEffect(() => {
    document.body.classList.toggle("sg-mobile-menu-open", mobileOpen);
    return () => document.body.classList.remove("sg-mobile-menu-open");
  }, [mobileOpen]);

  useEffect(() => {
    if (!menuSobreposto) return undefined;
    function aoTeclar(evento) {
      if (evento.key !== "Escape") return;
      setMobileOpen(false);
      setOverlayAberta(false);
      (faixa === "mobile" ? botaoMenuRef : botaoAlternarRef).current?.focus();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [menuSobreposto, faixa]);

  function abrirMenuMobile() {
    setMobileOpen(true);
    requestAnimationFrame(() => botaoFecharRef.current?.focus());
  }
  function alternarMenu() {
    if (faixa === "tablet") {
      setOverlayAberta((valor) => !valor);
      return;
    }
    setCompacta((valor) => {
      document.cookie = `sg-nav=${valor ? "expandida" : "compacta"}; path=/; max-age=31536000; samesite=lax`;
      return !valor;
    });
  }
  function fecharMenuNavegacao() {
    if (faixa === "mobile" && mobileOpen) requestAnimationFrame(() => botaoMenuRef.current?.focus());
    setMobileOpen(false);
    setOverlayAberta(false);
  }
  async function guia() {
    if (progresso?.status === "dispensado") await restaurar();
    await abrirRevisao();
    setMobileOpen(false);
  }
  function iniciais(nome = "?") { return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase(); }
  const classes = `sg-app-nav${compacta ? " is-compact" : ""}${mobileOpen ? " is-mobile-open" : ""}`;
  const recolhida = faixa === "tablet" ? !overlayAberta : compacta;
  const rotuloAlternar = recolhida ? "Expandir menu" : "Recolher menu";
  const mostrarDicas = recolhida && faixa !== "mobile";

  return <div className={`sg-app-shell${compacta ? " sg-app-shell--compact" : ""}${overlayAberta ? " sg-app-shell--overlay-open" : ""}`}>
    <header className="sg-mobile-bar">
      <button ref={botaoMenuRef} className="sg-mobile-toggle" type="button" onClick={abrirMenuMobile} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls="sg-app-nav"><Icon name="menu" /></button>
      <Link href="/" className="sg-mobile-brand" aria-label="SGNC - início"><MarcaSgnc /><strong>SGNC</strong></Link>
      {usuario && faixa === "mobile" && <SinoNotificacoes variante="barra" />}
      <span className="sg-mobile-avatar" role="img" aria-label={usuario?.nome}>{iniciais(usuario?.nome)}</span>
    </header>
    <button className={`sg-nav-scrim${mobileOpen ? " is-visible" : ""}`} onClick={fecharMenuNavegacao} aria-label="Fechar menu" tabIndex={-1} />
    <aside id="sg-app-nav" className={classes} aria-label="Navegação principal" inert={faixa === "mobile" && !mobileOpen}>
      <div className="sg-app-nav__brand-row">
        <Link href="/" className="sg-app-nav__brand" aria-label="SGNC - início" onClick={fecharMenuNavegacao}><MarcaSgnc /><strong className="sg-app-nav__brand-name">SGNC</strong></Link>
        <button ref={botaoAlternarRef} type="button" className="sg-app-nav__toggle" onClick={alternarMenu} aria-label={rotuloAlternar} aria-expanded={!recolhida} aria-controls="sg-app-nav" title={rotuloAlternar}><Icon name={recolhida ? "right" : "left"} /></button>
        <button ref={botaoFecharRef} type="button" className="sg-app-nav__close" onClick={fecharMenuNavegacao} aria-label="Fechar menu"><Icon name="close" /></button>
      </div>
      <nav className="sg-app-nav__links" aria-label="Menu principal">{grupos.map((grupo, indice) => <div key={grupo.titulo} className="sg-app-nav__grupo" role="group" aria-labelledby={`sg-nav-grupo-${indice}`}>
        <p id={`sg-nav-grupo-${indice}`} className="sg-app-nav__grupo-titulo">{grupo.titulo}</p>
        {grupo.links.map((link) => <Link key={link.href} href={link.href} className={`sg-app-nav__link${link.active ? " is-active" : ""}`} onClick={fecharMenuNavegacao} aria-current={link.active ? "page" : undefined} title={mostrarDicas ? link.label : undefined}><Icon name={link.icon} /><span>{link.label}</span></Link>)}
      </div>)}</nav>
      <div className="sg-app-nav__footer">
        {usuario && faixa !== "mobile" && <SinoNotificacoes variante="menu" mostrarDica={mostrarDicas} />}
        <button type="button" className="sg-app-nav__link" onClick={guia} title={mostrarDicas ? "Guia" : undefined}><Icon name="guide"/><span>Guia</span></button>
        <div className="sg-app-nav__profile">
          <span className="sg-app-nav__avatar" aria-hidden="true">{iniciais(usuario?.nome)}</span>
          <div className="sg-app-nav__profile-copy"><strong>{usuario?.nome}</strong><small>{NOME_PAPEL[usuario?.papel] ?? usuario?.papel}</small></div>
          <button type="button" className="sg-app-nav__sair" onClick={() => sair()} aria-label="Sair" title="Sair"><Icon name="exit"/></button>
        </div>
      </div>
    </aside>
    <main id="sg-main-content" className="sg-app-main">
      <Suspense fallback={null}><BarraAbas modulos={modulos} usuarioId={usuario?.id} /></Suspense>
      {children}
    </main>
  </div>;
}
