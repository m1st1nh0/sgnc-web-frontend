import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

/**
 * Gráfico de rosca (donut) genérico (Recharts).
 *
 * Props:
 *  - dados: [{ nome, valor, cor }]
 *  - altura: altura do gráfico em px
 */
export default function GraficoDonut({ dados, altura = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="valor"
          nameKey="nome"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
        >
          {dados.map((item, indice) => (
            <Cell key={indice} fill={item.cor} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "var(--sombra-md)",
            fontSize: "0.85rem",
          }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "var(--texto-secundario)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}