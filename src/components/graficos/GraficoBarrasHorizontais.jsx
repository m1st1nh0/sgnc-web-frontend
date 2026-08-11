import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráfico de barras horizontais genérico (Recharts).
 *
 * Props:
 *  - dados: array de objetos com os valores
 *  - categoriaChave: chave usada como rótulo da categoria (eixo Y)
 *  - series: [{ chave, cor, nome }] — uma ou mais séries
 *  - empilhado: se true, as séries ficam empilhadas uma sobre a outra
 *  - altura: altura do gráfico em px
 */
export default function GraficoBarrasHorizontais({
  dados,
  categoriaChave,
  series,
  empilhado = false,
  altura = 320,
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart
        data={dados}
        layout="vertical"
        margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
        barCategoryGap={empilhado ? "16%" : "30%"}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey={categoriaChave}
          width={138}
          tick={{ fontSize: 12, fill: "#0f172a" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "#f1f5f9" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "var(--sombra-md)",
            fontSize: "0.85rem",
          }}
        />
        {series.map((s, indice) => (
          <Bar
            key={s.chave}
            dataKey={s.chave}
            name={s.nome ?? s.chave}
            fill={s.cor}
            stackId={empilhado ? "total" : undefined}
            radius={
              empilhado && indice === series.length - 1 ? [0, 6, 6, 0] : [0, 0, 0, 0]
            }
            maxBarSize={26}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}