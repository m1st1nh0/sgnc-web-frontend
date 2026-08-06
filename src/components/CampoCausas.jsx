import { useState, useEffect, useRef } from "react";
import Form from "react-bootstrap/Form";
import Badge from "react-bootstrap/Badge";

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
      <div className="d-flex flex-wrap gap-2 border rounded p-2">
        {valor.map((causa) => (
          <Badge key={causa} bg="secondary" className="d-flex align-items-center gap-1">
            {causa}
            <span
              role="button"
              aria-label={`Remover ${causa}`}
              onClick={() => removerCausa(causa)}
              style={{ cursor: "pointer" }}
            >
              &times;
            </span>
          </Badge>
        ))}
        <Form.Control
          type="text"
          value={textoDigitado}
          onChange={(e) => {
            setTextoDigitado(e.target.value);
            setMostrarSugestoes(true);
          }}
          onFocus={() => setMostrarSugestoes(true)}
          onKeyDown={aoPressionarTecla}
          placeholder={valor.length === 0 ? "Digite uma causa e pressione Enter" : ""}
          className="border-0 shadow-none flex-grow-1"
          style={{ minWidth: "160px", width: "auto" }}
        />
      </div>

      {mostrarSugestoes && sugestoesFiltradas.length > 0 && (
        <div
          className="list-group position-absolute w-100 shadow-sm"
          style={{ zIndex: 10, maxHeight: "180px", overflowY: "auto" }}
        >
          {sugestoesFiltradas.slice(0, 8).map((sugestao) => (
            <button
              key={sugestao}
              type="button"
              className="list-group-item list-group-item-action"
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
