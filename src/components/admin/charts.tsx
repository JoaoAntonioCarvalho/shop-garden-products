"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const MOSS = "#4D5236";
const MOSS_LIGHT = "#6E7552";
const axis = { fontSize: 12, fill: "#5F624F" };
const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const tooltipStyle = { borderRadius: 6, border: "1px solid #DDD6C6", fontSize: 13 };

/** Tabela equivalente ao gráfico, para leitores de tela. */
function DataFallback({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RevenueLineChart({
  data,
}: {
  data: Array<{ day: string; atual: number; anterior: number }>;
}) {
  return (
    <figure>
      <div aria-hidden="true" inert className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#DDD6C6" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tick={axis}
              tickLine={false}
              axisLine={{ stroke: "#DDD6C6" }}
              minTickGap={24}
            />
            <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={brl} width={78} />
            <Tooltip formatter={(value) => brl(Number(value))} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Line
              type="monotone"
              dataKey="atual"
              name="Período atual"
              stroke={MOSS}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="anterior"
              name="Período anterior"
              stroke={MOSS_LIGHT}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataFallback
        caption="Faturamento por dia"
        headers={["Dia", "Período atual", "Período anterior"]}
        rows={data.map((d) => [d.day, brl(d.atual), brl(d.anterior)])}
      />
    </figure>
  );
}

type BarDatum = { name: string; pedidos: number; faturamento: number };

export function SimpleBarChart({
  data,
  dataKey,
  caption,
  horizontal = false,
  money = false,
}: {
  data: BarDatum[];
  dataKey: "pedidos" | "faturamento";
  caption: string;
  horizontal?: boolean;
  money?: boolean;
}) {
  const format = (value: number) => (money ? brl(value) : String(value));
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">Sem vendas no período.</p>;
  return (
    <figure>
      <div
        aria-hidden="true"
        // inert: o gráfico é decorativo para leitores de tela (há a tabela equivalente) e não recebe foco.
        inert
        style={{ height: horizontal ? Math.max(160, data.length * 38) : 220 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#DDD6C6"
              strokeDasharray="3 3"
              vertical={horizontal}
              horizontal={!horizontal}
            />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={format}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                  width={150}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={axis}
                  tickLine={false}
                  axisLine={{ stroke: "#DDD6C6" }}
                />
                <YAxis
                  tick={axis}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={format}
                  width={money ? 78 : 32}
                  allowDecimals={false}
                />
              </>
            )}
            <Tooltip
              formatter={(value) => format(Number(value))}
              contentStyle={tooltipStyle}
              cursor={{ fill: "#E7E8DC" }}
            />
            <Bar
              dataKey={dataKey}
              name={dataKey === "pedidos" ? "Pedidos" : "Faturamento"}
              fill={MOSS}
              radius={2}
              maxBarSize={36}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataFallback
        caption={caption}
        headers={["Item", dataKey === "pedidos" ? "Pedidos" : "Faturamento"]}
        rows={data.map((d) => [d.name, format(d[dataKey])])}
      />
    </figure>
  );
}
