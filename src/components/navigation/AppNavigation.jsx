"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../features/auth/components/AuthContext.jsx";
import { useOnboarding } from "../../features/onboarding/components/OnboardingContext.jsx";
import MarcaSgnc from "../ui/MarcaSgnc.jsx";
import { ehAdminSistema, ehQualidade, NOME_PAPEL } from "../../lib/auth/papeis.js";

const ROTULO_HOME = { adm: "Gestão de NCs", qualidade: "Gestão de NCs", supervisor: "Minha equipe", funcionario: "Minhas NCs" };
const ICONS = {
  home: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  add: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  chart: <><path d="M3 3v18h18M8 16v-4M13 16V7M18 16v-7"/></>,
  report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
  folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></>,
  cause: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.6 1.3c-.9 1.2-2.2 1.4-2.2 3M12 17h.01"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  guide: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20"/></>,
  exit: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  left: <><path d="m14 18-6-6 6-6"/></>,
  right: <><path d="m10 18 6-6-6-6"/></>,
};
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

function Icon({ name }) { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>; }

export default function AppNavigation({ children, compactaInicial = false }) {
  const { usuario, sair } = useAuth();
  const { progresso, restaurar, abrirRevisao } = useOnboarding();
  const pathname = usePathname();
  // Desktop e iPad paisagem: menu aberto por padrão; a escolha do usuário fica em cookie.
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
  const links = [
    { label: ROTULO_HOME[usuario?.papel] || "Gestão de NCs", href: "/", icon: "home", show: true, active: pathname === "/" },
    { label: "Acompanhar minhas NCs", href: "/minhas-ncs", icon: "eye", show: !!usuario, active: pathname === "/minhas-ncs" },
    { label: "Abrir NC", href: "/abrir-nc", icon: "add", show: true, active: pathname === "/abrir-nc" },
    { label: ehQualidade(usuario?.papel) ? "Pessoas e equipes" : "Minha equipe", href: "/equipe", icon: "people", show: ehGestao, active: pathname === "/equipe" || pathname.startsWith("/equipe/") },
    { label: "Insights", href: "/insights", icon: "chart", show: ehGestao, active: pathname === "/insights" },
    { label: "Relatórios", href: "/relatorios", icon: "report", show: ehGestao, active: pathname === "/relatorios" },
    { label: "Meu dossiê", href: `/usuarios/${usuario?.id}/dossie`, icon: "folder", show: !!usuario, active: pathname === `/usuarios/${usuario?.id}/dossie` },
    { label: "Causas", href: "/causas", icon: "cause", show: ehQualidade(usuario?.papel), active: pathname === "/causas" },
    { label: "Medidas disciplinares", href: "/medidas", icon: "report", show: ehQualidade(usuario?.papel), active: pathname === "/medidas" },
    { label: "Usuários", href: "/usuarios", icon: "user", show: ehAdminSistema(usuario?.papel), active: pathname === "/usuarios" },
  ].filter((link) => link.show);

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
      <span className="sg-mobile-avatar" role="img" aria-label={usuario?.nome}>{iniciais(usuario?.nome)}</span>
    </header>
    <button className={`sg-nav-scrim${mobileOpen ? " is-visible" : ""}`} onClick={fecharMenuNavegacao} aria-label="Fechar menu" tabIndex={-1} />
    <aside id="sg-app-nav" className={classes} aria-label="Navegação principal" inert={faixa === "mobile" && !mobileOpen}>
      <div className="sg-app-nav__brand-row">
        <Link href="/" className="sg-app-nav__brand" aria-label="SGNC - início" onClick={fecharMenuNavegacao}><MarcaSgnc /><strong className="sg-app-nav__brand-name">SGNC</strong></Link>
        <button ref={botaoAlternarRef} type="button" className="sg-app-nav__toggle" onClick={alternarMenu} aria-label={rotuloAlternar} aria-expanded={!recolhida} aria-controls="sg-app-nav" title={rotuloAlternar}><Icon name={recolhida ? "right" : "left"} /></button>
        <button ref={botaoFecharRef} type="button" className="sg-app-nav__close" onClick={fecharMenuNavegacao} aria-label="Fechar menu"><Icon name="close" /></button>
      </div>
      <nav className="sg-app-nav__links">{links.map((link) => <Link key={link.href} href={link.href} className={`sg-app-nav__link${link.active ? " is-active" : ""}`} onClick={fecharMenuNavegacao} aria-current={link.active ? "page" : undefined} title={mostrarDicas ? link.label : undefined}><Icon name={link.icon} /><span>{link.label}</span></Link>)}</nav>
      <div className="sg-app-nav__footer">
        <div className="sg-app-nav__profile"><span className="sg-app-nav__avatar">{iniciais(usuario?.nome)}</span><div className="sg-app-nav__profile-copy"><strong>{usuario?.nome}</strong><small>{NOME_PAPEL[usuario?.papel] ?? usuario?.papel}</small></div></div>
        <button type="button" className="sg-app-nav__link" onClick={guia} title={mostrarDicas ? "Guia" : undefined}><Icon name="guide"/><span>Guia</span></button>
        <button type="button" className="sg-app-nav__link" onClick={() => sair()} title={mostrarDicas ? "Sair" : undefined}><Icon name="exit"/><span>Sair</span></button>
      </div>
    </aside>
    <main id="sg-main-content" className="sg-app-main">{children}</main>
  </div>;
}
