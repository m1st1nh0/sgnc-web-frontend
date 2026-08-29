import { useEffect, useMemo, useState } from "react";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import BarraNavegacao from "../components/BarraNavegacao";
import CabecalhoPagina from "../components/ui/CabecalhoPagina";
import Botao from "../components/ui/Botao";
import EstadoCarregamento from "../components/ui/EstadoCarregamento";
import MensagemErro from "../components/ui/MensagemErro";
import { useAuth } from "../context/AuthContext";
import { ErroApi } from "../services/api";
import { listarUsuarios } from "../services/usuarioService";
import {
  baixarCsvNcs,
  baixarPdfResumo,
  nomeArquivoRelatorio,
} from "../services/relatoriosService";
import { salvarArquivoLocal } from "../utils/arquivoLocal";

const STATUS = [
  ["", "Todos os status"],
  ["aberta", "Aguardando avaliação"],
  ["aguardando_feedback", "Aguardando feedback"],
  ["aguardando_aceite", "Aguardando aceite"],
  ["concluida", "Concluída"],
  ["invalidada", "Invalidada"],
];

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const [filtros, setFiltros] = useState({
    inicio: "",
    fim: "",
    status: "",
    colaboradorId: "",
    setor: "",
  });
  const [pessoas, setPessoas] = useState([]);
  const [carregandoPessoas, setCarregandoPessoas] = useState(true);
  const [baixando, setBaixando] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setPessoas(await listarUsuarios());
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar os filtros.");
      } finally {
        setCarregandoPessoas(false);
      }
    })();
  }, []);

  const setores = useMemo(
    () => [...new Set(pessoas.map((p) => p.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pessoas]
  );

  function alterar(chave, valor) {
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
  }

  async function gerar(tipo) {
    setErro("");
    setBaixando(tipo);
    try {
      const blob = tipo === "pdf" ? await baixarPdfResumo(filtros) : await baixarCsvNcs(filtros);
      salvarArquivoLocal(blob, nomeArquivoRelatorio(tipo, filtros));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : `Não foi possível gerar o relatório ${tipo.toUpperCase()}.`);
    } finally {
      setBaixando("");
    }
  }

  function limparDetalhes() {
    setFiltros((atual) => ({ ...atual, status: "", colaboradorId: "", setor: "" }));
  }

  const escopo = usuario?.papel === "supervisor" ? "somente sua equipe direta" : "toda a organização";

  return (
    <div>
      <BarraNavegacao />
      <Container className="sg-container" style={{ maxWidth: "1050px" }}>
        <CabecalhoPagina
          titulo="Relatórios"
          subtitulo={`Escopo: ${escopo}. Datas em branco usam os últimos 12 meses.`}
        />

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}

        <div className="sg-card mb-4">
          <div className="sg-card-body p-4">
            <h2 className="h6 mb-3">Período</h2>
            <div className="row g-3">
              <div className="col-sm-6 col-lg-4">
                <Form.Label className="sg-label">Início</Form.Label>
                <Form.Control type="date" className="sg-input" value={filtros.inicio} onChange={(e) => alterar("inicio", e.target.value)} disabled={Boolean(baixando)} />
              </div>
              <div className="col-sm-6 col-lg-4">
                <Form.Label className="sg-label">Fim</Form.Label>
                <Form.Control type="date" className="sg-input" value={filtros.fim} onChange={(e) => alterar("fim", e.target.value)} disabled={Boolean(baixando)} />
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="sg-card h-100">
              <div className="sg-card-body p-4 d-flex flex-column">
                <div className="mb-4">
                  <div className="texto-xs texto-suave text-uppercase fw-semibold mb-2">Visão executiva</div>
                  <h2 className="h5 mb-2">Resumo gerencial em PDF</h2>
                  <p className="texto-sm texto-suave mb-0">
                    Backlog, medianas do ciclo, volume, principais causas e disciplina, diretamente do Insights V2.
                  </p>
                </div>
                <div className="sg-alerta sg-alerta--info mb-4">
                  O PDF usa apenas o período e consolida todo o escopo autorizado.
                </div>
                <div className="mt-auto">
                  <Botao variante="primario" carregando={baixando === "pdf"} disabled={Boolean(baixando) && baixando !== "pdf"} onClick={() => gerar("pdf")}>
                    Gerar PDF gerencial
                  </Botao>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="sg-card h-100">
              <div className="sg-card-body p-4">
                <div className="mb-4">
                  <div className="texto-xs texto-suave text-uppercase fw-semibold mb-2">Base auditável</div>
                  <h2 className="h5 mb-2">NCs detalhadas em CSV</h2>
                  <p className="texto-sm texto-suave mb-0">
                    Registros, causas, ocorrência canônica de 12 meses e tempos do fluxo para análise em planilha.
                  </p>
                </div>

                {carregandoPessoas ? (
                  <EstadoCarregamento mensagem="Carregando filtros..." compacto />
                ) : (
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <Form.Label className="sg-label">Status</Form.Label>
                      <Form.Select className="sg-input" value={filtros.status} onChange={(e) => alterar("status", e.target.value)} disabled={Boolean(baixando)}>
                        {STATUS.map(([valor, rotulo]) => <option value={valor} key={valor || "todos"}>{rotulo}</option>)}
                      </Form.Select>
                    </div>
                    <div className="col-sm-6">
                      <Form.Label className="sg-label">Colaborador</Form.Label>
                      <Form.Select className="sg-input" value={filtros.colaboradorId} onChange={(e) => alterar("colaboradorId", e.target.value)} disabled={Boolean(baixando)}>
                        <option value="">Todos os colaboradores</option>
                        {pessoas.map((pessoa) => <option value={pessoa.id} key={pessoa.id}>{pessoa.nome}</option>)}
                      </Form.Select>
                    </div>
                    <div className="col-sm-6">
                      <Form.Label className="sg-label">Setor</Form.Label>
                      <Form.Select className="sg-input" value={filtros.setor} onChange={(e) => alterar("setor", e.target.value)} disabled={Boolean(baixando)}>
                        <option value="">Todos os setores</option>
                        {setores.map((setor) => <option value={setor} key={setor}>{setor}</option>)}
                      </Form.Select>
                    </div>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 mt-4">
                  <Botao variante="primario" carregando={baixando === "csv"} disabled={Boolean(baixando) && baixando !== "csv"} onClick={() => gerar("csv")}>
                    Exportar CSV detalhado
                  </Botao>
                  <Botao variante="secundario" disabled={Boolean(baixando)} onClick={limparDetalhes}>
                    Limpar filtros detalhados
                  </Botao>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
