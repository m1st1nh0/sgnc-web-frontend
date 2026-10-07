import { useState } from "react";

import { useOnboarding } from "./OnboardingContext.jsx";
import { DICAS_ONBOARDING } from "../onboardingConteudo.js";
import Botao from "../../../components/ui/Botao.jsx";

export default function DicaContextual({ chave, className = "" }) {
  const { progresso, etapaConcluida, concluirEtapa } = useOnboarding();
  const [ocultaLocal, setOcultaLocal] = useState(false);
  const dica = DICAS_ONBOARDING[chave];

  if (
    !dica ||
    !progresso ||
    ocultaLocal ||
    etapaConcluida(chave)
  ) {
    return null;
  }

  async function dispensarDica() {
    setOcultaLocal(true);
    await concluirEtapa(chave, "contextual", {
      pagina: window.location.pathname,
    });
  }

  return (
    <aside
      className={"sg-dica-contextual " + className}
      aria-label={dica.titulo}
    >
      <span className="sg-dica-contextual__icone" aria-hidden="true">
        i
      </span>
      <div>
        <strong>{dica.titulo}</strong>
        <p>{dica.texto}</p>
      </div>
      <Botao variante="subtle" tamanho="sm" onClick={dispensarDica}>
        Entendi
      </Botao>
    </aside>
  );
}
