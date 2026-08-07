import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Table from "react-bootstrap/Table";
import Badge from "react-bootstrap/Badge";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Nav from "react-bootstrap/Nav";
import Button from "react-bootstrap/Button";

import BarraNavegacao from "../components/BarraNavegacao";
import { listarNcs } from "../services/ncService";
import { infoDoStatus } from "../services/statusNc";
import { ErroApi } from "../services/api";
import { listarUsuarios } from "../services/usuarioService";

const ABAS_FILTRO = [
  { chave: "todas", rotulo: "Todas", status: null },
  { chave: "aberta", rotulo: "Abertas", status: "aberta" },
  {
    chave: "em_andamento",
    rotulo: "Em andamento",
    status: ["validada", "aguardando_analise", "aguardando_aceite"],
  },
  { chave: "concluida", rotulo: "Concluídas", status: "concluida" },
  { chave: "invalidada", rotulo: "Invalidadas", status: "invalidada" },
];

function formatarData(dataIso) {
  if (!dataIso) return "-";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function HomePage() {
  const navigate = useNavigate();

  const [ncs, setNcs] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("todas");

  useEffect(() => {
    async function carregar() {
      try {
        const [listaNcs, listaUsuarios] = await Promise.all([
          listarNcs(),
          listarUsuarios(),
        ]);
        setNcs(listaNcs);
        setUsuarios(listaUsuarios);
      } catch (e) {
        setErro(
          e instanceof ErroApi
            ? e.message
            : "Não foi possível carregar as Não Conformidades."
        );
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  const ncsFiltradas = useMemo(() => {
    const filtro = ABAS_FILTRO.find((a) => a.chave === abaAtiva);
    if (!filtro || !filtro.status) return ncs;

    const statusAlvo = Array.isArray(filtro.status)
      ? filtro.status
      : [filtro.status];
    return ncs.filter((nc) => statusAlvo.includes(nc.status));
  }, [ncs, abaAtiva]);

  function obterNomeAbertoPor(nc) {
    if (!nc.aberto_por) return "-";
    const usuario = usuarios.find((u) => u.id === nc.aberto_por);
    return usuario?.nome || nc.aberto_por || "-";
  }

  return (
    <div>
      <BarraNavegacao />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="h4 mb-0">Não Conformidades</h1>
          <Button as={Link} to="/abrir-nc" variant="primary">
            + Abrir NC
          </Button>
        </div>

        <Nav
          variant="tabs"
          activeKey={abaAtiva}
          onSelect={setAbaAtiva}
          className="mb-3"
        >
          {ABAS_FILTRO.map((aba) => (
            <Nav.Item key={aba.chave}>
              <Nav.Link eventKey={aba.chave}>{aba.rotulo}</Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        {erro && <Alert variant="danger">{erro}</Alert>}

        {carregando ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
          </div>
        ) : ncsFiltradas.length === 0 ? (
          <Alert
            variant="light"
            className="border text-center text-muted"
          >
            Nenhuma Não Conformidade encontrada.
          </Alert>
        ) : (
          <Table hover responsive className="bg-white shadow-sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Colaborador analisado</th>
                <th>Aberto por</th>
                <th>Criticidade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ncsFiltradas.map((nc) => {
                const { rotulo, cor } = infoDoStatus(nc.status);
                const abertoPorNome = obterNomeAbertoPor(nc);

                return (
                  <tr
                    key={nc.id}
                    style={{ cursor: "pointer" }}
                    onDoubleClick={() => navigate(`/nc/${nc.id}`)}
                  >
                    <td>{formatarData(nc.data)}</td>
                    <td>{nc.colaborador || "-"}</td>
                    <td>{abertoPorNome}</td>
                    <td>{nc.criticidade}</td>
                    <td>
                      <Badge bg={cor}>{rotulo}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Container>
    </div>
  );
}