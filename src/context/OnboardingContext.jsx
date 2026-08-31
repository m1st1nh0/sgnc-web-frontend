import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import {
  concluirEtapaOnboarding,
  concluirOnboarding as concluirOnboardingApi,
  dispensarOnboarding as dispensarOnboardingApi,
  iniciarOnboarding as iniciarOnboardingApi,
  obterOnboarding,
  restaurarOnboarding as restaurarOnboardingApi,
  revisarOnboarding as revisarOnboardingApi,
} from "../services/onboardingService";

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const { usuario } = useAuth();
  const [progresso, setProgresso] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [modoRevisao, setModoRevisao] = useState(false);

  const carregar = useCallback(async () => {
    if (!usuario || usuario.senhaProvisoria) return;
    setCarregando(true);
    try {
      const dados = await obterOnboarding();
      setProgresso(dados);
      setIndisponivel(false);
      if (dados.deve_exibir_apresentacao) {
        setModoRevisao(false);
        setModalAberto(true);
      }
    } catch {
      // O onboarding é auxiliar e nunca pode bloquear as rotas de negócio.
      setIndisponivel(true);
    } finally {
      setCarregando(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (!usuario || usuario.senhaProvisoria) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgresso(null);
      setModalAberto(false);
      setModoRevisao(false);
      return;
    }
    carregar();
  }, [usuario, carregar]);

  const chavesConcluidas = useMemo(
    () => new Set(progresso?.etapas_concluidas?.map((item) => item.chave) || []),
    [progresso]
  );

  const executar = useCallback(async (operacao) => {
    try {
      const dados = await operacao();
      setProgresso(dados);
      setIndisponivel(false);
      return dados;
    } catch {
      setIndisponivel(true);
      return null;
    }
  }, []);

  const iniciar = useCallback(
    () => executar(iniciarOnboardingApi),
    [executar]
  );

  const concluirEtapa = useCallback(
    async (chave, origem, metadados = {}) => {
      if (chavesConcluidas.has(chave)) return progresso;
      return executar(() =>
        concluirEtapaOnboarding(chave, origem, metadados)
      );
    },
    [chavesConcluidas, executar, progresso]
  );

  const dispensar = useCallback(async () => {
    const dados = await executar(dispensarOnboardingApi);
    if (dados) setModalAberto(false);
    return dados;
  }, [executar]);

  const concluir = useCallback(async () => {
    const dados = await executar(concluirOnboardingApi);
    if (dados) setModalAberto(false);
    return dados;
  }, [executar]);

  const restaurar = useCallback(
    () => executar(restaurarOnboardingApi),
    [executar]
  );

  const abrirRevisao = useCallback(async () => {
    const dados = await executar(revisarOnboardingApi);
    if (dados || progresso) {
      setModoRevisao(true);
      setModalAberto(true);
    }
  }, [executar, progresso]);

  const fecharModal = useCallback(() => {
    setModalAberto(false);
    setModoRevisao(false);
  }, []);

  const etapaConcluida = useCallback(
    (chave) => chavesConcluidas.has(chave),
    [chavesConcluidas]
  );

  const valor = useMemo(
    () => ({
      progresso,
      carregando,
      indisponivel,
      modalAberto,
      modoRevisao,
      chavesConcluidas,
      etapaConcluida,
      carregar,
      iniciar,
      concluirEtapa,
      dispensar,
      concluir,
      restaurar,
      abrirRevisao,
      fecharModal,
    }),
    [
      progresso,
      carregando,
      indisponivel,
      modalAberto,
      modoRevisao,
      chavesConcluidas,
      etapaConcluida,
      carregar,
      iniciar,
      concluirEtapa,
      dispensar,
      concluir,
      restaurar,
      abrirRevisao,
      fecharModal,
    ]
  );

  return (
    <OnboardingContext.Provider value={valor}>
      {children}
    </OnboardingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOnboarding() {
  const contexto = useContext(OnboardingContext);
  if (!contexto) {
    throw new Error(
      "useOnboarding precisa ser usado dentro de um <OnboardingProvider>"
    );
  }
  return contexto;
}
