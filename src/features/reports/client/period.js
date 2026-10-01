function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function periodoPadraoRelatorio(referenceDate = new Date()) {
  const fim = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - 29);
  return { inicio: isoDate(inicio), fim: isoDate(fim) };
}
