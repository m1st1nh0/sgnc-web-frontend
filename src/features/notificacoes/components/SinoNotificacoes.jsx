"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { listarNotificacoes, marcarNotificacaoLida, marcarTodasLidas } from "../client/notificacoesService.js";
import { formatarDataHora } from "../../../lib/utils/formato.js";

const INTERVALO_MS = 60_000;
const ROTULO_NIVEL = { normal: "", atencao: "Atenção", urgente: "Urgente", critica: "Crítica" };

/**
 * Sino de notificações (Fase 5): contador de não lidas, cor pelo maior nível pendente e lista
 * com link para a NC. Atualiza ao carregar, ao voltar o foco para a aba e a cada 60 s com a aba visível.
 */
/** `variante`: "menu" (rodapé do menu lateral, com rótulo) ou "barra" (barra superior no celular). */
export default function SinoNotificacoes({ variante = "menu", mostrarDica = false }) {
  const router = useRouter();
  const [dados, setDados] = useState({ itens: [], nao_lidas: 0, maior_nivel: null });
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState(false);
  const painelRef = useRef(null);
  const botaoRef = useRef(null);

  const atualizar = useCallback(async () => {
    try {
      setDados(await listarNotificacoes());
      setErro(false);
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    atualizar();
    const aoFocar = () => { if (document.visibilityState === "visible") atualizar(); };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") atualizar(); }, INTERVALO_MS);
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoFocar);
    };
  }, [atualizar]);

  useEffect(() => {
    if (!aberto) return undefined;
    function fecharFora(evento) {
      if (painelRef.current?.contains(evento.target) || botaoRef.current?.contains(evento.target)) return;
      setAberto(false);
    }
    function fecharEsc(evento) {
      if (evento.key === "Escape") { setAberto(false); botaoRef.current?.focus(); }
    }
    document.addEventListener("mousedown", fecharFora);
    document.addEventListener("keydown", fecharEsc);
    return () => {
      document.removeEventListener("mousedown", fecharFora);
      document.removeEventListener("keydown", fecharEsc);
    };
  }, [aberto]);

  async function abrirNotificacao(item) {
    setAberto(false);
    if (!item.lida_em) {
      try { await marcarNotificacaoLida(item.id); } catch { /* segue para o destino mesmo assim */ }
      atualizar();
    }
    if (item.link) router.push(item.link);
  }

  async function lerTodas() {
    try { await marcarTodasLidas(); } finally { atualizar(); }
  }

  const nivel = dados.maior_nivel || "normal";
  const rotulo = dados.nao_lidas > 0 ? `Notificações: ${dados.nao_lidas} não lida(s)` : "Notificações";

  return (
    <div className={`sg-sino sg-sino--${variante}`}>
      <button
        ref={botaoRef}
        type="button"
        title={mostrarDica ? rotulo : undefined}
        className={`${variante === "menu" ? "sg-app-nav__link " : ""}sg-sino__botao sg-sino__botao--${dados.nao_lidas > 0 ? nivel : "vazio"}`}
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        onClick={() => { setAberto((valor) => !valor); if (!aberto) atualizar(); }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {variante === "menu" && <span>Notificações</span>}
        {dados.nao_lidas > 0 && <b className="sg-sino__contador">{dados.nao_lidas > 99 ? "99+" : dados.nao_lidas}</b>}
      </button>
      {aberto && (
        <div ref={painelRef} className="sg-sino__painel" role="dialog" aria-label="Notificações">
          <div className="sg-sino__cabecalho">
            <strong>Notificações</strong>
            {dados.nao_lidas > 0 && <button type="button" className="sg-sino__ler-todas" onClick={lerTodas}>Marcar todas como lidas</button>}
          </div>
          {erro && <p className="sg-sino__vazio">Não foi possível carregar as notificações.</p>}
          {!erro && dados.itens.length === 0 && <p className="sg-sino__vazio">Nenhuma notificação por enquanto.</p>}
          <ul className="sg-sino__lista">
            {dados.itens.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sg-sino__item${!item.lida_em && !item.resolvida_em ? " is-nao-lida" : ""}${item.resolvida_em ? " is-resolvida" : ""} sg-sino__item--${item.nivel}`}
                  onClick={() => abrirNotificacao(item)}
                >
                  <span className="sg-sino__titulo">
                    {ROTULO_NIVEL[item.nivel] && <span className="sg-sino__nivel">{ROTULO_NIVEL[item.nivel]}</span>}
                    {item.titulo}
                  </span>
                  <span className="sg-sino__mensagem">{item.mensagem}</span>
                  <span className="sg-sino__data">
                    {formatarDataHora(item.atualizada_em || item.criada_em)}{item.resolvida_em ? " · resolvida" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
