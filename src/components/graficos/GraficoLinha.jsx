import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TICK = {
  fontFamily: "var(--fonte-sans)",
  fontSize: 12,
  fill: "var(--texto-secundario)",
};

export default function GraficoLinha({ dados, eixoChave, series, altura = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--borda)" />
        <XAxis
          dataKey={eixoChave}
          tick={TICK}
          axisLine={{ stroke: "var(--borda)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={TICK}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--borda-forte)" }}
          contentStyle={{
            borderRadius: 6,
            border: "1px solid var(--borda)",
            boxShadow: "var(--sombra-elevada)",
            fontFamily: "var(--fonte-sans)",
            fontSize: "0.8125rem",
          }}
        />
        <Legend
          iconType="plainline"
          wrapperStyle={{
            paddingTop: 12,
            fontFamily: "var(--fonte-sans)",
            fontSize: 12,
            color: "var(--texto-secundario)",
          }}
        />
        {series.map((serie) => (
          <Line
            key={serie.chave}
            type="monotone"
            dataKey={serie.chave}
            name={serie.nome ?? serie.chave}
            stroke={serie.cor}
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: "var(--fundo-card)" }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
