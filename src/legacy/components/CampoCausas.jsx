import { useState, useEffect, useRef } from "react";

/**
 * Campo de "tags": mostra as causas já escolhidas como badges
 * removíveis, e um campo de texto com sugestões (autocomplete) das
 * causas conhecidas. Ao digitar uma causa nova (que não existe na
 * lista sugerida) e apertar Enter, ela também é aceita como tag -
 * a API se encarrega de criá-la de fato quando a NC for salva.
 *
 * Props:
 *  - valor: array de strings (causas já selecionadas)
 *  - aoMudar: function(novoArray)
 *  - sugestoes: array de strings (causas já conhecidas, para autocomplete)
 */
export default function CampoCausas({ valor, aoMudar, sugestoes = [] }) {
  const [textoDigitado, setTextoDigitado] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const referenciaCaixa = useRef(null);

  const sugestoesFiltradas = sugestoes.filter((sugestao) => {
    const jaEscolhida = valor.some((v) => v.toLowerCase() === sugestao.toLowerCase());
    const combinaComTexto =
      textoDigitado.trim().length > 0 &&
      sugestao.toLowerCase().includes(textoDigitado.trim().toLowerCase());
    return !jaEscolhida && combinaComTexto;
  });

  function adicionarCausa(causa) {
    const causaLimpa = causa.trim();
    if (!causaLimpa) return;

    const jaExiste = valor.some((v) => v.toLowerCase() === causaLimpa.toLowerCase());
    if (!jaExiste) {
      aoMudar([...valor, causaLimpa]);
    }
    setTextoDigitado("");
    setMostrarSugestoes(false);
  }

  function removerCausa(causaParaRemover) {
    aoMudar(valor.filter((v) => v !== causaParaRemover));
  }

  function aoPressionarTecla(evento) {
    if (evento.key === "Enter") {
      evento.preventDefault(); // evita enviar o formulário sem querer
      adicionarCausa(textoDigitado);
    } else if (evento.key === "Backspace" && textoDigitado === "" && valor.length > 0) {
      // apagar com o campo vazio remove a última tag, como em apps conhecidos
      removerCausa(valor[valor.length - 1]);
    }
  }

  // Fecha a lista de sugestões ao clicar fora do componente
  useEffect(() => {
    function aoClicarFora(evento) {
      if (referenciaCaixa.current && !referenciaCaixa.current.contains(evento.target)) {
        setMostrarSugestoes(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div ref={referenciaCaixa} style={{ position: "relative" }}>
      <div className="sg-tags">
        {valor.map((causa) => (
          <span key={causa} className="sg-tag">
            {causa}
            <button
              type="button"
              className="sg-tag__remover"
              aria-label={`Remover ${causa}`}
              onClick={() => removerCausa(causa)}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          className="sg-tag__input"
          value={textoDigitado}
          onChange={(e) => {
            setTextoDigitado(e.target.value);
            setMostrarSugestoes(true);
          }}
          onFocus={() => setMostrarSugestoes(true)}
          onKeyDown={aoPressionarTecla}
          placeholder={valor.length === 0 ? "Digite uma causa e pressione Enter" : ""}
          aria-label="Causas"
        />
      </div>

      {mostrarSugestoes && sugestoesFiltradas.length > 0 && (
        <div className="sg-tag-sugestoes">
          {sugestoesFiltradas.slice(0, 8).map((sugestao) => (
            <button
              key={sugestao}
              type="button"
              className="sg-tag-sugestao"
              onClick={() => adicionarCausa(sugestao)}
            >
              {sugestao}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}