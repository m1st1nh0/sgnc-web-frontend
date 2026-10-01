const APRESENTACAO_COMUM = {
  boasVindas: {
    chave: "apresentacao_boas_vindas",
    titulo: "Bem-vindo ao SGNC",
    texto:
      "O sistema organiza não conformidades, responsabilidades e evidências para que cada etapa fique clara e rastreável.",
    destaque: "Seu progresso será salvo e poderá ser retomado em outro acesso.",
  },
  fluxo: {
    chave: "apresentacao_fluxo_nc",
    titulo: "Entenda o fluxo da NC",
    texto:
      "Uma NC nasce aberta, passa pela avaliação da Qualidade, recebe feedback e segue para o aceite do colaborador antes da conclusão.",
    destaque: "O status mostra exatamente qual é o próximo responsável.",
  },
  documentos: {
    chave: "apresentacao_documentos",
    titulo: "Documentos oficiais em PDF",
    texto:
      "O relatório da NC e o dossiê do colaborador são exportados em PDF. Quando precisar imprimir, utilize o próprio PDF.",
    destaque: "As imagens anexadas à NC acompanham o relatório quando disponíveis.",
  },
};

const PAPEL = {
  adm: {
    chave: "apresentacao_papel_adm",
    titulo: "Sua jornada na Qualidade",
    texto:
      "Você administra usuários, avalia NCs, registra feedbacks e acompanha os indicadores de toda a operação.",
    destaque: "A validação envia a NC diretamente para a etapa de feedback.",
  },
  supervisor: {
    chave: "apresentacao_papel_supervisor",
    titulo: "Sua jornada como supervisor",
    texto:
      "Você acompanha apenas sua equipe direta, consulta dossiês e monitora os próximos passos das NCs dos seus colaboradores.",
    destaque: "Dados de pessoas fora da sua equipe não aparecem nas telas de gestão.",
  },
  funcionario: {
    chave: "apresentacao_papel_funcionario",
    titulo: "Sua jornada como colaborador",
    texto:
      "Você pode abrir NCs, anexar evidências, acompanhar registros autorizados e formalizar o aceite quando houver feedback.",
    destaque: "Seu dossiê reúne seu histórico e pode ser baixado em PDF.",
  },
};

const CHECKLIST_COMUM = [
  {
    chave: "checklist_conhecer_painel",
    titulo: "Conheça seu painel",
    descricao: "Veja prioridades, indicadores e atalhos do seu papel.",
    destino: "/",
    concluirAoAbrir: true,
  },
  {
    chave: "checklist_abrir_nc",
    titulo: "Conheça a abertura de NC",
    descricao: "Veja como selecionar o colaborador e anexar evidências.",
    destino: "/abrir-nc",
    concluirAoAbrir: true,
  },
  {
    chave: "checklist_visualizar_nc",
    titulo: "Visualize os detalhes de uma NC",
    descricao: "Entenda status, histórico, responsáveis e evidências.",
    destino: "/#prioridades",
  },
  {
    chave: "checklist_dossie",
    titulo: "Consulte o dossiê",
    descricao: "Acesse o histórico consolidado do colaborador.",
    destino: ({ usuarioId }) => `/usuarios/${usuarioId}/dossie`,
  },
  {
    chave: "checklist_baixar_pdf",
    titulo: "Baixe um documento em PDF",
    descricao: "Gere o relatório oficial da NC ou o resumo do dossiê.",
    destino: ({ usuarioId }) => `/usuarios/${usuarioId}/dossie`,
  },
];

const CHECKLIST_ESPECIFICO = {
  adm: [
    {
      chave: "checklist_avaliar_nc",
      titulo: "Conheça a avaliação de NC",
      descricao: "Valide ou invalide um registro aberto.",
      destino: "/#prioridades",
      concluirAoAbrir: true,
    },
    {
      chave: "checklist_feedback",
      titulo: "Conheça o registro de feedback",
      descricao: "Veja como formalizar o combinado com o colaborador.",
      destino: "/#prioridades",
      concluirAoAbrir: true,
    },
    {
      chave: "checklist_insights",
      titulo: "Acesse os indicadores",
      descricao: "Acompanhe backlog, tempos e reincidências.",
      destino: "/insights",
    },
    {
      chave: "checklist_usuarios",
      titulo: "Conheça a gestão de usuários",
      descricao: "Cadastre, edite e gerencie acessos.",
      destino: "/usuarios",
    },
  ],
  supervisor: [
    {
      chave: "checklist_equipe",
      titulo: "Conheça sua equipe direta",
      descricao: "Veja os colaboradores sob sua supervisão.",
      destino: "/",
    },
    {
      chave: "checklist_acompanhar_nc",
      titulo: "Acompanhe uma NC da equipe",
      descricao: "Consulte o status e os próximos responsáveis.",
      destino: "/#prioridades",
    },
    {
      chave: "checklist_insights",
      titulo: "Acesse os indicadores da equipe",
      descricao: "Analise o desempenho somente da sua equipe direta.",
      destino: "/insights",
    },
  ],
  funcionario: [
    {
      chave: "checklist_evidencias",
      titulo: "Conheça as evidências",
      descricao: "Veja como anexar e visualizar arquivos.",
      destino: "/abrir-nc",
      concluirAoAbrir: true,
    },
    {
      chave: "checklist_aceite",
      titulo: "Conheça o processo de aceite",
      descricao: "Entenda como confirmar o feedback recebido.",
      destino: "/#prioridades",
      concluirAoAbrir: true,
    },
  ],
};

export const DICAS_ONBOARDING = {
  dica_abertura_colaborador: {
    titulo: "Seleção do colaborador",
    texto: "A busca filtra a lista; clique na pessoa correta para selecioná-la.",
  },
  dica_abertura_evidencias: {
    titulo: "Múltiplas evidências",
    texto: "Você pode selecionar vários arquivos ou acrescentar novas seleções antes de abrir a NC.",
  },
  dica_nc_pdf: {
    titulo: "Relatório oficial",
    texto: "Baixe o PDF para compartilhar ou imprimir a NC com o formato padronizado.",
  },
  dica_nc_avaliacao: {
    titulo: "Avaliação da Qualidade",
    texto: "Ao validar, a NC segue diretamente para o registro de feedback.",
  },
  dica_nc_feedback: {
    titulo: "Feedback rastreável",
    texto: "Registre o combinado de forma objetiva; ele será apresentado ao colaborador no aceite.",
  },
  dica_gestao_usuarios: {
    titulo: "Papéis e acessos",
    texto: "O papel define as telas disponíveis. Supervisores enxergam apenas a própria equipe.",
  },
  dica_equipe_direta: {
    titulo: "Escopo da equipe",
    texto: "As prioridades e os indicadores exibidos aqui consideram somente seus subordinados diretos.",
  },
  dica_dossie_equipe: {
    titulo: "Dossiê da equipe",
    texto: "Use o dossiê para consultar o histórico consolidado de um colaborador sob sua supervisão.",
  },
  dica_nc_aceite: {
    titulo: "Aceite formal",
    texto: "Leia o feedback e registre a confirmação solicitada para concluir o fluxo.",
  },
  dica_dossie_pessoal: {
    titulo: "Seu histórico",
    texto: "O dossiê reúne recorrências, causas e medidas registradas no período.",
  },
};

export function apresentacaoDoPapel(papel) {
  const etapaPapel = PAPEL[papel] || PAPEL.funcionario;
  return [
    APRESENTACAO_COMUM.boasVindas,
    etapaPapel,
    APRESENTACAO_COMUM.fluxo,
    APRESENTACAO_COMUM.documentos,
  ];
}

export function checklistDoPapel(papel, usuarioId) {
  const contexto = { usuarioId };
  return [...CHECKLIST_COMUM, ...(CHECKLIST_ESPECIFICO[papel] || [])].map(
    (item) => ({
      ...item,
      destino:
        typeof item.destino === "function"
          ? item.destino(contexto)
          : item.destino,
    })
  );
}
