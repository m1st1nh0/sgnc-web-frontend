"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="sg-container container">
      <div className="sg-estado" role="alert">
        <i className="sg-estado__icone" aria-hidden="true">!</i>
        <h1 className="sg-estado__titulo">Não foi possível carregar esta página</h1>
        <p className="sg-estado__descricao">Tente novamente em instantes. Se o problema continuar, informe o suporte.</p>
        <button type="button" className="sg-btn sg-btn--primario" onClick={reset}>Tentar novamente</button>
      </div>
    </div>
  );
}
