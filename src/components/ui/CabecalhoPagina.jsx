/**
 * Cabeçalho padronizado de página.
 * Props:
 *  - titulo: título principal
 *  - subtitulo: texto abaixo do título (opcional)
 *  - acoes: elementos React renderizados à direita (opcional)
 */
export default function CabecalhoPagina({ titulo, subtitulo, acoes }) {
    return (
        <div className="sg-cabecalho">
            <div>
                <h1 className="sg-cabecalho__titulo">{titulo}</h1>
                {subtitulo && <p className="sg-cabecalho__subtitulo">{subtitulo}</p>}
            </div>
            {acoes && <div className="sg-cabecalho__acoes">{acoes}</div>}
        </div>
    );
}