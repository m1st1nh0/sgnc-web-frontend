export default function MarcaSgnc({ completa = false }) {
  const src = completa ? "/logo-arquem.png" : "/logo-arquem-symbol.png";
  const textoAlternativo = completa ? "Arquem Automação Corporativa" : "Arquem";

  return (
    <span className={`sg-marca ${completa ? "sg-marca--completa" : "sg-marca--simbolo"}`}>
      <img
        className="sg-marca__imagem"
        src={src}
        alt={textoAlternativo}
      />
    </span>
  );
}
