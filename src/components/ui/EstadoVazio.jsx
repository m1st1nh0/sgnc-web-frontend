/**
 * Estado vazio padronizado.
 * Props:
 *  - titulo: título principal (opcional)
 *  - descricao: texto explicativo (opcional)
 */
export default function EstadoVazio({ titulo = "Nenhum registro encontrado", descricao }) {
    return (
        <div className="sg-estado">
            <i className="sg-estado__icone" aria-hidden="true">!</i>
            <h3 className="sg-estado__titulo">{titulo}</h3>
            {descricao && <p className="sg-estado__descricao">{descricao}</p>}
        </div>
    );
}