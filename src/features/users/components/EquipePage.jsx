"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";

import CabecalhoPagina from "../../../components/ui/CabecalhoPagina.jsx";
import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { listarEquipe } from "../client/usuarioService.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { useOnboarding } from "../../onboarding/components/OnboardingContext.jsx";
import { ehQualidade } from "../../../lib/auth/papeis.js";
import Botao from "../../../components/ui/Botao.jsx";
import GestaoEquipes from "./GestaoEquipes.jsx";

const ROTULOS_PAPEL = { supervisor: "Liderança", funcionario: "Funcionário" };

export default function EquipePage() {
  const { usuario } = useAuth();
  const { concluirEtapa } = useOnboarding();
  const gestorEquipes = ehQualidade(usuario?.papel);
  const [visao, setVisao] = useState("equipes");
  const [pessoas, setPessoas] = useState([]);
  const [busca, setBusca] = useState("");
  const [incluirInativos, setIncluirInativos] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativa = true;
    listarEquipe()
      .then((resultado) => { if (ativa) setPessoas(resultado); })
      .catch((falha) => { if (ativa) setErro(falha?.message || "Não foi possível carregar a equipe."); })
      .finally(() => { if (ativa) setCarregando(false); });
    return () => { ativa = false; };
  }, []);

  useEffect(() => {
    if (usuario?.papel === "qualidade") concluirEtapa("checklist_equipes", "checklist")?.catch?.(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.papel]);

  const porId = useMemo(() => new Map(pessoas.map((pessoa) => [pessoa.id, pessoa])), [pessoas]);
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return pessoas.filter((pessoa) => {
      if (!incluirInativos && !pessoa.ativo) return false;
      const supervisor = porId.get(pessoa.supervisor_id)?.nome ?? "";
      return !termo || [pessoa.nome, pessoa.setor, supervisor, ROTULOS_PAPEL[pessoa.papel]]
        .some((valor) => String(valor ?? "").toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [pessoas, busca, incluirInativos, porId]);

  return (
    <div>
      <Container className="sg-container">
        <CabecalhoPagina
          titulo={gestorEquipes ? "Pessoas e equipes" : "Minha equipe"}
          subtitulo={gestorEquipes
            ? "Organize as equipes por liderança e consulte as NCs e o histórico de cada pessoa."
            : "Abra cada liderado para consultar suas NCs, indicadores e histórico autorizado."}
          acoes={gestorEquipes && (
            <div className="d-flex gap-2" role="group" aria-label="Modo de visualização">
              <Botao tamanho="sm" variante={visao === "equipes" ? "primario" : "secundario"} aria-pressed={visao === "equipes"} onClick={() => setVisao("equipes")}>
                Por liderança
              </Botao>
              <Botao tamanho="sm" variante={visao === "lista" ? "primario" : "secundario"} aria-pressed={visao === "lista"} onClick={() => setVisao("lista")}>
                Lista
              </Botao>
            </div>
          )}
        />

        {gestorEquipes && visao === "equipes" ? <GestaoEquipes /> : (<>

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        <div className="sg-card mb-3">
          <div className="sg-card-body d-flex flex-wrap align-items-end gap-3">
            <Form.Group className="flex-grow-1" controlId="busca-equipe">
              <Form.Label>Buscar pessoa, setor ou liderança</Form.Label>
              <Form.Control value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Digite para filtrar a equipe" />
            </Form.Group>
            <Form.Check
              type="switch"
              id="incluir-inativos"
              label="Incluir pessoas inativas"
              checked={incluirInativos}
              onChange={(event) => setIncluirInativos(event.target.checked)}
            />
          </div>
        </div>

        {carregando ? <EstadoCarregamento mensagem="Carregando equipe..." /> : visiveis.length === 0 ? (
          <EstadoVazio
            titulo={pessoas.length ? "Nenhuma pessoa encontrada" : "Nenhum liderado cadastrado"}
            descricao={pessoas.length ? "Ajuste a busca ou os filtros para ver outros resultados." : "Quando houver pessoas associadas à sua hierarquia, elas aparecerão aqui."}
          />
        ) : (
          <div className="sg-tabela-wrap">
            <Table hover responsive className="align-middle">
              <thead><tr><th>Pessoa</th><th>Setor</th><th>Liderança</th><th>Nível</th><th>Situação</th><th>Acesso</th></tr></thead>
              <tbody>{visiveis.map((pessoa) => (
                <tr key={pessoa.id}>
                  <th scope="row">{pessoa.nome}<div className="texto-xs texto-suave fw-normal">{ROTULOS_PAPEL[pessoa.papel] ?? pessoa.papel}</div></th>
                  <td>{pessoa.setor || "—"}</td>
                  <td>{pessoa.supervisor_id === usuario?.id ? usuario.nome : porId.get(pessoa.supervisor_id)?.nome || (gestorEquipes ? "Sem liderança atribuída" : "—")}</td>
                  <td>{pessoa.nivel ? `Nível ${pessoa.nivel}` : "Organização"}</td>
                  <td><span className={`sg-badge ${pessoa.ativo ? "sg-badge--verde" : "sg-badge--cinza"}`}>{pessoa.ativo ? "Ativa" : "Inativa · histórico"}</span></td>
                  <td><Link className="sg-btn sg-btn--secundario sg-btn--sm" href={`/equipe/${pessoa.id}`}>Ver NCs e indicadores</Link></td>
                </tr>
              ))}</tbody>
            </Table>
          </div>
        )}
        <p className="texto-xs texto-suave mt-3 mb-0">Exibindo {visiveis.length} de {pessoas.length} pessoa(s). O acesso segue a liderança atual; após uma transferência, o histórico acompanha a nova cadeia.</p>
        </>)}
      </Container>
    </div>
  );
}
