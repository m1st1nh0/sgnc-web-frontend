/**
 * Card de indicador/métrica para dashboards.
 * Props:
 *  - rotulo: título da métrica
 *  - valor: número ou texto principal
 *  - descricao: texto de apoio (opcional)
 *  - cor: "azul" | "verde" | "amarela" | "vermelha" | "cinza"
 */
export default function CardMetrica({ rotulo, valor, descricao, cor = "azul" }) {
    const faixaCor = {
        azul: "sg-metrica__faixa--azul",
        verde: "sg-metrica__faixa--verde",
        amarela: "sg-metrica__faixa--amarela",
        laranja: "sg-metrica__faixa--laranja",
        vermelha: "sg-metrica__faixa--vermelha",
        cinza: "sg-metrica__faixa--cinza",
    }[cor];

    return (
        <div className="sg-metrica">
            <span className={`sg-metrica__faixa ${faixaCor}`} aria-hidden="true" />
            <span className="sg-metrica__rotulo">{rotulo}</span>
            <span className="sg-metrica__valor">{valor}</span>
            {descricao && <span className="sg-metrica__descricao">{descricao}</span>}
        </div>
    );
}