export default function Loading() {
  return (
    <div className="sg-route-loading" role="status" aria-live="polite" aria-label="Carregando módulo">
      <div className="sg-route-loading__indicator" aria-hidden="true" />
      <span>Carregando módulo...</span>
    </div>
  );
}
