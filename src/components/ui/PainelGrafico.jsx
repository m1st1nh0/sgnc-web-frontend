import EstadoVazio from "./EstadoVazio";

/**
 * Card padrão que envolve um gráfico na página de Insights.
 *
 * Props:
 *  - titulo: título do painel
 *  - descricao: texto de apoio (opcional)
 *  - vazio: quando true, mostra estado vazio no lugar do gráfico
 *  - children: conteúdo do gráfico
 */
export default function PainelGrafico({ titulo, descricao, vazio = false, children }) {
  return (
    <div className="sg-card h-100">
      <div className="sg-card-body p-4 d-flex flex-column">
        <h3 className="h6 mb-1">{titulo}</h3>
        {descricao && <p className="texto-secundario texto-sm mb-3">{descricao}</p>}
        {vazio ? (
          <EstadoVazio
            titulo="Sem dados no período"
            descricao="Nenhuma ocorrência registrada para este indicador."
          />
        ) : (
          <div className="flex-grow-1">{children}</div>
        )}
      </div>
    </div>
  );
}