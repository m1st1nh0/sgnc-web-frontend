export default function MarcaSgnc({ completa = false, clara = false }) {
  return (
    <span className={`sg-marca ${clara ? "sg-marca--clara" : ""}`}>
      <svg className="sg-marca__simbolo" viewBox="0 0 36 36" aria-hidden="true">
        <path d="M5 4h20l6 6v22H5z" className="sg-marca__folha" />
        <path d="M25 4v7h6M11 15h14M11 21h14M11 27h8" className="sg-marca__linhas" />
        <path d="m11 9 2 2 4-4" className="sg-marca__check" />
      </svg>
      {completa && (
        <span className="sg-marca__texto">
          <strong>SGNC</strong>
          <small>Gestão de conformidade</small>
        </span>
      )}
    </span>
  );
}
