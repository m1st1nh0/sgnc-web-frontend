import { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";

import { useAuth } from "../../context/AuthContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { apresentacaoDoPapel } from "../../data/onboardingConteudo";
import Botao from "../ui/Botao";

export default function OnboardingInicialModal() {
  const { usuario } = useAuth();
  const {
    modalAberto,
    modoRevisao,
    progresso,
    indisponivel,
    etapaConcluida,
    iniciar,
    concluirEtapa,
    fecharModal,
  } = useOnboarding();
  const [indice, setIndice] = useState(0);
  const [avancando, setAvancando] = useState(false);

  const etapas = useMemo(
    () => apresentacaoDoPapel(usuario?.papel),
    [usuario?.papel]
  );

  useEffect(() => {
    if (!modalAberto) return;
    const primeiraPendente = etapas.findIndex(
      (etapa) => !etapaConcluida(etapa.chave)
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndice(modoRevisao || primeiraPendente < 0 ? 0 : primeiraPendente);
    if (progresso?.status === "nao_iniciado") iniciar();
  }, [
    modalAberto,
    modoRevisao,
    etapas,
    etapaConcluida,
    progresso?.status,
    iniciar,
  ]);

  if (!usuario || usuario.senhaProvisoria || !etapas.length) return null;

  const etapa = etapas[indice];
  const ultima = indice === etapas.length - 1;
  const percentual = Math.round(((indice + 1) / etapas.length) * 100);

  async function avancar() {
    setAvancando(true);
    await concluirEtapa(etapa.chave, "apresentacao", {
      indice: indice + 1,
      total: etapas.length,
    });
    setAvancando(false);

    if (ultima) {
      fecharModal();
      return;
    }
    setIndice((atual) => atual + 1);
  }

  return (
    <Modal
      show={modalAberto}
      onHide={fecharModal}
      centered
      size="lg"
      aria-labelledby="onboarding-titulo"
    >
      <Modal.Header closeButton>
        <div>
          <span className="sg-onboarding__etapa">
            {modoRevisao ? "Revisão do guia" : "Primeiros passos"} · Etapa{" "}
            {indice + 1} de {etapas.length}
          </span>
          <Modal.Title id="onboarding-titulo" className="h4 mt-1">
            {etapa.titulo}
          </Modal.Title>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div
          className="sg-onboarding__progresso"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={percentual}
          aria-label={"Progresso da apresentação: " + percentual + "%"}
        >
          <span style={{ width: percentual + "%" }} />
        </div>

        <p className="sg-onboarding__texto">{etapa.texto}</p>
        <div className="sg-onboarding__destaque">{etapa.destaque}</div>

        {indisponivel && (
          <p className="texto-sm texto-suave mt-3 mb-0" role="status">
            O progresso não pôde ser sincronizado agora. Você pode continuar;
            tentaremos novamente no próximo acesso.
          </p>
        )}
      </Modal.Body>

      <Modal.Footer className="justify-content-between">
        <Botao
          variante="subtle"
          onClick={fecharModal}
          disabled={avancando}
        >
          Continuar depois
        </Botao>
        <div className="d-flex gap-2">
          {indice > 0 && (
            <Botao
              variante="secundario"
              onClick={() => setIndice((atual) => atual - 1)}
              disabled={avancando}
            >
              Voltar
            </Botao>
          )}
          <Botao
            variante="primario"
            onClick={avancar}
            carregando={avancando}
          >
            {ultima ? "Ir para meus primeiros passos" : "Continuar"}
          </Botao>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
