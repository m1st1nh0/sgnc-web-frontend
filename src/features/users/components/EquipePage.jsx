"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import EstadoCarregamento from "../../../components/ui/EstadoCarregamento.jsx";
import EstadoVazio from "../../../components/ui/EstadoVazio.jsx";
import MensagemErro from "../../../components/ui/MensagemErro.jsx";
import { listarEquipe } from "../client/usuarioService.js";
import { useAuth } from "../../auth/components/AuthContext.jsx";
import { useOnboarding } from "../../onboarding/components/OnboardingContext.jsx";
import { ehAdminSistema, ehQualidade, NOME_PAPEL } from "../../../lib/auth/papeis.js";
import GestaoEquipes from "./GestaoEquipes.jsx";
import EstruturaOrganizacional from "./EstruturaOrganizacional.jsx";
import UsuariosPage from "./UsuariosPage.jsx";
import { useRascunho } from "../../../lib/utils/rascunho.js";

const ROTULOS_PAPEL = { ...NOME_PAPEL, supervisor: "Liderança" };

export default function EquipePage({ abaInicial }) {
  const { usuario } = useAuth();
  const { concluirEtapa } = useOnboarding();
  const gestorEquipes = ehQualidade(usuario?.papel);
  // "Acessos" (contas, senha e status) é só do Administrador do sistema.
  const abas = [
    ["equipes", "Equipes"],
    ["lista", "Lista"],
    ["estrutura", "Estrutura"],
    ...(ehAdminSistema(usuario?.papel) ? [["acessos", "Acessos"]] : []),
  ];
  const [abaEscolhida, setAbaEscolhida] = useState(abaInicial || "equipes");
  // Aba de um perfil sem acesso a ela cai em "Equipes".
  const visao = abas.some(([valor]) => valor === abaEscolhida) ? abaEscolhida : "equipes";

  function trocarAba(valor) {
    setAbaEscolhida(valor);
    // Só atualiza o endereço (para favoritos e o "Voltar"), sem nova ida ao servidor.
    window.history.replaceState(null, "", valor === "equipes" ? "/equipe" : `/equipe?aba=${valor}`);
  }
  const [pessoas, setPessoas] = useState([]);
  const [busca, setBusca] = useRascunho("equipe-acessos", "busca", "");
  const [incluirInativos, setIncluirInativos] = useRascunho("equipe-acessos", "incluirInativos", true);
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
        <header className="sg-pagina-cabecalho">
          <div className="sg-pagina-cabecalho__texto">
            <h1>{gestorEquipes ? "Pessoas e equipes" : "Minha equipe"}</h1>
            <p>{gestorEquipes
              ? "Organize as equipes por liderança e consulte as NCs e o histórico de cada pessoa."
              : "Abra cada liderado para consultar suas NCs, indicadores e histórico autorizado."}</p>
          </div>
        </header>

        {gestorEquipes && (
          <div className="sg-relatorio__abas mb-4" role="tablist" aria-label="Pessoas e equipes">
            {abas.map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={visao === valor}
                className="sg-relatorio__aba"
                onClick={() => trocarAba(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {gestorEquipes && visao === "acessos" ? <UsuariosPage /> : gestorEquipes && visao === "estrutura" ? <EstruturaOrganizacional /> : gestorEquipes && visao === "equipes" ? <GestaoEquipes /> : (<>

        {erro && <MensagemErro mensagem={erro} onFechar={() => setErro("")} />}
        <div className="sg-cartao sg-equipe-lista__filtros mb-3">
          <div className="d-flex flex-wrap align-items-end gap-3">
            <Form.Group className="flex-grow-1" controlId="busca-equipe">
              <Form.Label className="sg-label">Buscar pessoa, setor ou liderança</Form.Label>
              <Form.Control className="sg-input" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Digite para filtrar a equipe" />
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
          <div className="sg-tabela-caixa">
            <table className="sg-tabela">
              <thead><tr><th scope="col">Pessoa</th><th scope="col">Setor</th><th scope="col">Liderança</th><th scope="col">Nível</th><th scope="col">Situação</th><th scope="col"><span className="visually-hidden">Acesso</span></th></tr></thead>
              <tbody>{visiveis.map((pessoa) => (
                <tr key={pessoa.id}>
                  <th scope="row">{pessoa.nome}<div className="texto-xs texto-suave fw-normal">{ROTULOS_PAPEL[pessoa.papel] ?? pessoa.papel}</div></th>
                  <td>{pessoa.setor || "—"}</td>
                  <td>{pessoa.supervisor_id === usuario?.id ? usuario.nome : porId.get(pessoa.supervisor_id)?.nome || (pessoa.diretoria ? "Diretoria (topo)" : gestorEquipes ? "Sem liderança atribuída" : "—")}</td>
                  <td>{pessoa.nivel ? `Nível ${pessoa.nivel}` : "Organização"}</td>
                  <td><span className={`sg-badge ${pessoa.ativo ? "sg-badge--verde" : "sg-badge--cinza"}`}>{pessoa.ativo ? "Ativa" : "Inativa · histórico"}</span></td>
                  <td className="text-end"><Link className="sg-tabela__link" href={`/equipe/${pessoa.id}`}>Ver NCs e indicadores</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="texto-xs texto-suave mt-3 mb-0">Exibindo {visiveis.length} de {pessoas.length} pessoa(s). O acesso segue a liderança atual; após uma transferência, o histórico acompanha a nova cadeia.</p>
        </>)}
      </Container>
    </div>
  );
}
