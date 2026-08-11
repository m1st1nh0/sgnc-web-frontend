import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráfico de linhas/área genérico para séries temporais (Recharts).
 *
 * Props:
 *  - dados: array de objetos
 *  - eixoChave: chave usada como rótulo do eixo X
 *  - series: [{ chave, cor, nome }]
 *  - altura: altura do gráfico em px
 */
export default function GraficoLinha({ dados, eixoChave, series, altura = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.chave} id={`grad-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.cor} stopOpacity={0.22} />
              <stop offset="95%" stopColor={s.cor} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey={eixoChave}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "var(--sombra-md)",
            fontSize: "0.85rem",
          }}
        />
        {series.map((s) => (
          <Area
            key={s.chave}
            type="monotone"
            dataKey={s.chave}
            name={s.nome ?? s.chave}
            stroke={s.cor}
            strokeWidth={2}
            fill={`url(#grad-${s.chave})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}