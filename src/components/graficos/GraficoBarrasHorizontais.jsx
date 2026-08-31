import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TICK_SECUNDARIO = {
  fontFamily: "var(--fonte-sans)",
  fontSize: 12,
  fill: "var(--texto-secundario)",
};

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
        barCategoryGap={empilhado ? "18%" : "34%"}
      >
        <CartesianGrid horizontal={false} stroke="var(--borda)" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={TICK_SECUNDARIO}
          axisLine={{ stroke: "var(--borda)" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey={categoriaChave}
          width={138}
          tick={{ ...TICK_SECUNDARIO, fill: "var(--texto-primario)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--fundo-hover)" }}
          contentStyle={{
            borderRadius: 6,
            border: "1px solid var(--borda)",
            boxShadow: "var(--sombra-elevada)",
            fontFamily: "var(--fonte-sans)",
            fontSize: "0.8125rem",
          }}
        />
        {series.map((serie, indice) => (
          <Bar
            key={serie.chave}
            dataKey={serie.chave}
            name={serie.nome ?? serie.chave}
            fill={serie.cor}
            stackId={empilhado ? "total" : undefined}
            radius={empilhado && indice === series.length - 1 ? [0, 3, 3, 0] : 0}
            maxBarSize={24}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
