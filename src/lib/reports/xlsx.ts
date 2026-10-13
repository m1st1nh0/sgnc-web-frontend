/**
 * Gerador mínimo de planilha Excel (.xlsx) sem dependência externa: XML do Office Open XML
 * empacotado em zip com o deflate nativo do Node. Cabeçalho congelado, autofiltro, larguras,
 * datas no horário de Brasília e durações em [h]:mm.
 */
import { deflateRawSync } from "node:zlib";

export type TipoColuna = "texto" | "textoLongo" | "numero" | "data" | "dataHora" | "duracao" | "percentual";
export type ColunaPlanilha = { titulo: string; largura?: number; tipo?: TipoColuna };
export type Celula = string | number | null | undefined;
export type Aba = { nome: string; colunas: ColunaPlanilha[]; linhas: Celula[][] };

const FUSO = "America/Sao_Paulo";
// Índices de estilo em styles.xml (cellXfs).
const ESTILO: Record<TipoColuna | "cabecalho", number> = { texto: 0, cabecalho: 1, data: 2, dataHora: 3, duracao: 4, percentual: 5, textoLongo: 6, numero: 0 };

const escapar = (texto: string) => texto
  // Caracteres de controle não são válidos em XML.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function letraDaColuna(indice: number) {
  let n = indice + 1, letras = "";
  while (n > 0) { const resto = (n - 1) % 26; letras = String.fromCharCode(65 + resto) + letras; n = Math.floor((n - 1) / 26); }
  return letras;
}

/** Data/hora ISO para número de série do Excel, já no horário de Brasília. Data pura (aaaa-mm-dd) não passa por fuso. */
export function serialExcel(valor: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return Date.parse(`${valor}T00:00:00Z`) / 86_400_000 + 25_569;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(data).map((parte) => [parte.type, parte.value]));
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return local / 86_400_000 + 25_569;
}

function celula(valor: Celula, tipo: TipoColuna, ref: string) {
  if (valor == null || valor === "") return "";
  const estilo = ESTILO[tipo];
  const s = estilo ? ` s="${estilo}"` : "";
  if (tipo === "data" || tipo === "dataHora") {
    const serial = typeof valor === "number" ? valor : serialExcel(String(valor));
    if (serial != null) return `<c r="${ref}"${s}><v>${serial}</v></c>`;
  }
  if (tipo === "duracao" && typeof valor === "number") return `<c r="${ref}"${s}><v>${valor / 86_400}</v></c>`;
  if ((tipo === "numero" || tipo === "percentual") && typeof valor === "number" && Number.isFinite(valor)) return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  // Texto vai como inlineStr: o Excel não interpreta como fórmula.
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(String(valor))}</t></is></c>`;
}

function planilhaXml(aba: Aba) {
  const ultima = letraDaColuna(Math.max(0, aba.colunas.length - 1));
  const cols = aba.colunas.map((coluna, i) => `<col min="${i + 1}" max="${i + 1}" width="${coluna.largura ?? 14}" customWidth="1"/>`).join("");
  const cabecalho = `<row r="1">${aba.colunas.map((coluna, i) => `<c r="${letraDaColuna(i)}1" s="${ESTILO.cabecalho}" t="inlineStr"><is><t>${escapar(coluna.titulo)}</t></is></c>`).join("")}</row>`;
  const linhas = aba.linhas.map((linha, r) => `<row r="${r + 2}">${aba.colunas.map((coluna, i) => celula(linha[i], coluna.tipo ?? "texto", `${letraDaColuna(i)}${r + 2}`)).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    + `<cols>${cols}</cols><sheetData>${cabecalho}${linhas}</sheetData>`
    + `<autoFilter ref="A1:${ultima}${aba.linhas.length + 1}"/></worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + `<numFmts count="4"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="166" formatCode="[h]:mm"/><numFmt numFmtId="167" formatCode="0.0%"/></numFmts>`
  + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>`
  + `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173350"/><bgColor indexed="64"/></patternFill></fill></fills>`
  + `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
  + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  + `<cellXfs count="7">`
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
  + `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>`
  + `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>`
  + `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Nome de aba válido no Excel: até 31 caracteres, sem : \ / ? * [ ]. */
const nomeDaAba = (nome: string) => nome.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);

export function gerarXlsx(abas: Aba[]) {
  const arquivos: Array<[string, string]> = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((aba, i) => `<sheet name="${escapar(nomeDaAba(aba.nome))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${abas.map((aba, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escapar(nomeDaAba(aba.nome)).replace(/'/g, "''")}'!$A$1:$${letraDaColuna(Math.max(0, aba.colunas.length - 1))}$${aba.linhas.length + 1}</definedName>`).join("")}</definedNames></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", ESTILOS],
    ...abas.map((aba, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, planilhaXml(aba)]),
  ];
  return zip(arquivos.map(([nome, conteudo]) => [nome, Buffer.from(conteudo, "utf8")]));
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(dados: Buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of dados) crc = TABELA_CRC[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Zip com deflate (método 8), suficiente para o pacote do Excel. */
function zip(arquivos: Array<[string, Buffer]>) {
  const partes: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const [nome, dados] of arquivos) {
    const nomeBytes = Buffer.from(nome, "utf8");
    const comprimido = deflateRawSync(dados);
    const crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18); local.writeUInt32LE(dados.length, 22); local.writeUInt16LE(nomeBytes.length, 26); local.writeUInt16LE(0, 28);
    partes.push(local, nomeBytes, comprimido);
    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0); entrada.writeUInt16LE(20, 4); entrada.writeUInt16LE(20, 6); entrada.writeUInt16LE(0x0800, 8); entrada.writeUInt16LE(8, 10);
    entrada.writeUInt16LE(0, 12); entrada.writeUInt16LE(0x21, 14); entrada.writeUInt32LE(crc, 16); entrada.writeUInt32LE(comprimido.length, 20); entrada.writeUInt32LE(dados.length, 24);
    entrada.writeUInt16LE(nomeBytes.length, 28); entrada.writeUInt16LE(0, 30); entrada.writeUInt16LE(0, 32); entrada.writeUInt16LE(0, 34); entrada.writeUInt16LE(0, 36);
    entrada.writeUInt32LE(0, 38); entrada.writeUInt32LE(offset, 42);
    central.push(entrada, nomeBytes);
    offset += local.length + nomeBytes.length + comprimido.length;
  }
  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(0, 4); fim.writeUInt16LE(0, 6); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12); fim.writeUInt32LE(offset, 16); fim.writeUInt16LE(0, 20);
  return new Uint8Array(Buffer.concat([...partes, diretorio, fim]));
}
