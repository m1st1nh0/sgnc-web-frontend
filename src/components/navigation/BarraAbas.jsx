"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Icon from "./icones.jsx";
import ModalConfirmacao from "../ui/ModalConfirmacao.jsx";
import { existeRascunho } from "../../lib/utils/rascunho.js";
import { aplicarRota, escoposDeRascunho, fecharAba, gravarAbas, lerAbas, moduloDaRota, normalizarAbas } from "../../lib/utils/abas.js";

/**
 * Abas internas dos módulos.
 *
 * Abrir um módulo cria (uma única) aba; a aba lembra a última rota visitada
 * dentro dele, então voltar para a aba devolve filtros e paginação, que ficam
 * na URL. As abas são restauradas ao recarregar a página e as de módulos sem
 * permissão são descartadas. Fechar uma aba com formulário em rascunho pede
 * confirmação.
 */
export default function BarraAbas({ modulos, usuarioId }) {
  const pathname = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const [abas, setAbas] = useState([]);
  const [ultimoModulo, setUltimoModulo] = useState(null);
  const [restaurado, setRestaurado] = useState(false);
  const [aFechar, setAFechar] = useState(null);
  // Excesso: quantas abas estão fora da área visível e para que lado dá para rolar.
  const [transbordo, setTransbordo] = useState({ ocultas: 0, inicio: false, fim: false });
  const listaRef = useRef(null);

  const urlAtual = useMemo(() => {
    const query = parametros?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, parametros]);

  const moduloAtual = moduloDaRota(urlAtual, modulos);
  // Em tela de detalhe (sem módulo próprio) a aba de onde o usuário veio segue ativa.
  const ativa = moduloAtual?.href ?? (abas.some((aba) => aba.href === ultimoModulo) ? ultimoModulo : null);

  // Restaura as abas da sessão anterior antes de registrar a rota atual.
  useEffect(() => {
    if (!usuarioId) return;
    // As abas vêm do localStorage, que não existe no servidor: ler no render quebraria a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbas(normalizarAbas(lerAbas(usuarioId), modulos));
     
    setRestaurado(true);
    // Só na montagem (ou na troca de usuário): depois quem manda é a navegação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  useEffect(() => {
    if (!restaurado) return;
    // A navegação é o sistema externo aqui: cada rota nova entra na lista de abas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbas((atuais) => aplicarRota(atuais, { url: urlAtual, modulos }).abas);
     
    if (moduloAtual) setUltimoModulo(moduloAtual.href);
    // `modulos` é recriado a cada render do menu; a rota é o que importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAtual, restaurado]);

  useEffect(() => {
    if (restaurado) gravarAbas(usuarioId, abas);
  }, [abas, restaurado, usuarioId]);

  // Mantém a aba ativa visível quando a barra rola na horizontal.
  useEffect(() => {
    listaRef.current?.querySelector("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [ativa, abas.length]);

  // Conta as abas que não cabem, para mostrar o "+N" e habilitar as setas.
  const medirTransbordo = useCallback(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const inicio = lista.scrollLeft;
    const fim = inicio + lista.clientWidth;
    let ocultas = 0;
    for (const item of lista.children) {
      if (item.offsetLeft < inicio - 1 || item.offsetLeft + item.offsetWidth > fim + 1) ocultas += 1;
    }
    setTransbordo({ ocultas, inicio: inicio > 1, fim: fim < lista.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return undefined;
    medirTransbordo();
    lista.addEventListener("scroll", medirTransbordo, { passive: true });
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medirTransbordo);
    observador?.observe(lista);
    return () => {
      lista.removeEventListener("scroll", medirTransbordo);
      observador?.disconnect();
    };
  }, [medirTransbordo, abas]);

  function rolar(sentido) {
    const lista = listaRef.current;
    if (lista) lista.scrollBy({ left: sentido * Math.max(160, lista.clientWidth * 0.7) });
  }

  function concluirFechamento(href) {
    const resultado = fecharAba(abas, href, ativa);
    setAbas(resultado.abas);
    setAFechar(null);
    if (resultado.destino) router.push(resultado.destino);
  }

  function pedirFechamento(aba) {
    if (escoposDeRascunho(aba.url).some((escopo) => existeRascunho(escopo))) setAFechar(aba);
    else concluirFechamento(aba.href);
  }

  /** Setas movem o foco entre as abas; Home e End vão para as pontas. */
  function aoTeclar(evento) {
    const passos = { ArrowRight: 1, ArrowLeft: -1, Home: "inicio", End: "fim" };
    const acao = passos[evento.key];
    if (acao === undefined) return;
    const focaveis = Array.from(listaRef.current?.querySelectorAll(".sg-barra-abas__link") ?? []);
    if (!focaveis.length) return;
    const atual = focaveis.indexOf(document.activeElement?.closest(".sg-barra-abas__link"));
    let proximo;
    if (acao === "inicio") proximo = 0;
    else if (acao === "fim") proximo = focaveis.length - 1;
    else proximo = (Math.max(0, atual) + acao + focaveis.length) % focaveis.length;
    evento.preventDefault();
    focaveis[proximo]?.focus();
  }

  if (abas.length === 0) return null;

  return (
    <>
      <nav className="sg-barra-abas" aria-label="Abas abertas">
        <ul className="sg-barra-abas__lista" ref={listaRef} onKeyDown={aoTeclar}>
          {abas.map((aba) => {
            const atual = aba.href === ativa;
            return (
              <li key={aba.href} className={`sg-barra-abas__aba${atual ? " is-active" : ""}`}>
                <Link href={aba.url} className="sg-barra-abas__link" aria-current={atual ? "page" : undefined}>
                  <Icon name={aba.icon} />
                  <span>{aba.label}</span>
                </Link>
                <button
                  type="button"
                  className="sg-barra-abas__fechar"
                  onClick={() => pedirFechamento(aba)}
                  aria-label={`Fechar aba ${aba.label}`}
                  title={`Fechar aba ${aba.label}`}
                >
                  <Icon name="close" />
                </button>
              </li>
            );
          })}
        </ul>
        {(transbordo.inicio || transbordo.fim) && (
          <div className="sg-barra-abas__transbordo">
            {transbordo.ocultas > 0 && (
              <span className="sg-barra-abas__contador" aria-label={`${transbordo.ocultas} aba(s) fora da vista`}>+{transbordo.ocultas}</span>
            )}
            <button type="button" className="sg-barra-abas__rolar" onClick={() => rolar(-1)} disabled={!transbordo.inicio} aria-label="Mostrar abas anteriores">
              <Icon name="left" />
            </button>
            <button type="button" className="sg-barra-abas__rolar" onClick={() => rolar(1)} disabled={!transbordo.fim} aria-label="Mostrar próximas abas">
              <Icon name="right" />
            </button>
          </div>
        )}
      </nav>
      <ModalConfirmacao
        visivel={!!aFechar}
        titulo={aFechar ? `Fechar “${aFechar.label}”?` : ""}
        mensagem="Há informações preenchidas e ainda não enviadas nesta tela. Fechar a aba mantém o rascunho, mas você sai do formulário."
        textoConfirmar="Fechar a aba"
        aoFechar={() => setAFechar(null)}
        aoConfirmar={() => concluirFechamento(aFechar.href)}
      />
    </>
  );
}
