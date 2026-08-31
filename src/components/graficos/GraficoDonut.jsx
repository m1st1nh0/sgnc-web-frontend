import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const ESTILO_TOOLTIP = {
  borderRadius: 6,
  border: "1px solid var(--borda)",
  boxShadow: "var(--sombra-elevada)",
  fontFamily: "var(--fonte-sans)",
  fontSize: "0.8125rem",
  color: "var(--texto-primario)",
};

export default function GraficoDonut({ dados, altura = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="valor"
          nameKey="nome"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={1}
          stroke="var(--fundo-card)"
          strokeWidth={3}
        >
          {dados.map((item) => (
            <Cell key={item.nome} fill={item.cor} />
          ))}
        </Pie>
        <Tooltip contentStyle={ESTILO_TOOLTIP} />
        <Legend
          verticalAlign="bottom"
          iconType="square"
          iconSize={8}
          wrapperStyle={{
            fontFamily: "var(--fonte-sans)",
            fontSize: 12,
            color: "var(--texto-secundario)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
