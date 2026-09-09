// O conteúdo define ferramentas e objetivos de uma simulação contínua.
// Não há perguntas, gabaritos ou votação.
export const CARDS = [
  {
    id: "builder",
    name: "Construtor",
    model: "Barbarian",
    icon: "tools",
    color: "#edba80",
    cost: 3,
    description:
      "Sozinho leva 36 s. Cada canteiro isolado soma uma frente de trabalho.",
    lesson:
      "Delegação: cada agente recebe uma frente concreta. Dois Construtores isolados constroem em metade do tempo; sem canteiro livre eles disputam o mesmo checkout.",
  },
  {
    id: "worktree",
    name: "Worktree",
    model: "Rogue_Hooded",
    icon: "branch",
    color: "#83dbb1",
    cost: 2,
    description:
      "Abre um canteiro isolado nesta frente. Até 2 por frente, e duram a partida.",
    lesson:
      "Uma worktree é um diretório de trabalho, e cabe um agente em cada. Abrir um canteiro libera mais um Construtor em paralelo; sem canteiro livre eles voltam ao mesmo checkout. Worktree não substitui sandbox.",
  },
  {
    id: "reviewer",
    name: "Revisor",
    model: "Mage",
    icon: "mage",
    color: "#c9a2fa",
    cost: 2,
    description:
      "Valida e integra a obra. 9 s, +3 s por falha e +5 s por frente extra.",
    lesson:
      "Revisão acontece sobre uma entrega concreta. Falhas custam tempo, e cada frente paralela precisa ser convergida: paralelismo compra latência pagando coordenação.",
  },
  {
    id: "harness",
    name: "Harness",
    model: "Knight",
    icon: "shield",
    color: "#79bfff",
    cost: 2,
    description: "Bloqueia entrega sem revisão e comandos do caos neste alvo.",
    lesson:
      "O harness aplica permissões e bloqueia ações fora das regras. Dar uma instrução não é o mesmo que restringir a ferramenta.",
  },
];
export const SITES = [
  {
    id: 0,
    name: "Portal",
    icon: "crown",
    purpose: "Reconecte as rotas do reino.",
    x: -5.6,
    z: -8.4,
  },
  {
    id: 1,
    name: "Forja",
    icon: "tools",
    purpose: "Restaure a fonte de energia.",
    x: 0,
    z: 10.4,
  },
  {
    id: 2,
    name: "Muralha",
    icon: "shield",
    purpose: "Erga a defesa da Cidadela.",
    x: 5.6,
    z: -8.4,
  },
];
export const STORY = {
  title: "Reconstrua antes da tempestade",
  description:
    "O caos rompeu o Portal, apagou a Forja e derrubou a Muralha. Mobilize sua guilda: construa, revise e entregue três níveis em cada frente.",
  maxLevel: 3,
  // Um Construtor sozinho leva a obra inteira. Cada canteiro isolado acrescenta
  // uma frente de trabalho, e a revisão cobra a convergência depois.
  buildSeconds: 36,
  reviewSeconds: 9,
  integrationSeconds: 5,
  conflictRate: 0.5,
  maxWorktrees: 2,
  maxEnergy: 12,
  regen: 0.65,
  scoreSafe: 100,
  scoreUnsafe: 40,
};
// Parâmetros do estudo em campo. O acerto corta metade do tempo que falta na
// tarefa e soma pontos: entregar rápido deixa de ser suficiente para vencer.
export const STUDY = {
  bonus: 20,
  speedup: 0.5,
  revealSeconds: 4.5,
};
// Perguntas tiradas da apresentação. O índice correto e a explicação vivem só
// aqui: missions.mjs não é servido ao navegador e o snapshot só revela os dois
// depois que a pessoa responde.
export const QUESTIONS = [
  {
    id: "harness",
    topic: "Harness",
    prompt: "O que o harness faz, além de chamar o modelo?",
    options: [
      "Treina o modelo com os arquivos do repositório",
      "Monta contexto, roda ferramentas, aplica sandbox e estado",
      "Troca de fornecedor quando o modelo erra",
    ],
    answer: 1,
    why: "O harness é a camada que faz o modelo trabalhar: contexto, modelo, ferramentas, sandbox e aprovação, estado entre turnos.",
  },
  {
    id: "workflow",
    topic: "Workflows",
    prompt: "O que separa um workflow de um agente?",
    options: [
      "No workflow o caminho está definido em código",
      "O workflow roda local; o agente roda na nuvem",
      "O workflow usa um modelo menor",
    ],
    answer: 0,
    why: "Prompt chaining, routing e orchestrator-workers são composições explícitas. No agente, a sequência das ações é decisão do modelo.",
  },
  {
    id: "multiagente",
    topic: "Multiagente",
    prompt: "O ganho de 90,2% do sistema multiagente veio com que custo?",
    options: [
      "Cerca de 15× mais tempo de execução",
      "Quinze subagentes fixos por consulta",
      "Cerca de 15× mais tokens",
    ],
    answer: 2,
    why: "A Anthropic reporta ~15× mais tokens, e que o uso de tokens explica 80% da variação de desempenho no BrowseComp.",
  },
  {
    id: "worktree-shares",
    topic: "Worktree",
    prompt: "O que uma worktree compartilha com o checkout principal?",
    options: [
      "Histórico, objetos e remote; a branch é própria",
      "Nada: é um clone completo e independente",
      "A branch: os dois diretórios usam a mesma",
    ],
    answer: 0,
    why: "Worktree isola diretório e branch sem duplicar o repositório: histórico, objetos e remote continuam compartilhados.",
  },
  {
    id: "worktree-gap",
    topic: "Worktree",
    prompt: "Abriu a worktree e o primeiro teste falhou. Causa provável?",
    options: [
      "A branch nova não tem o histórico do projeto",
      "O remote não foi configurado no novo diretório",
      "Faltou o que o Git ignora: .env e dependências",
    ],
    answer: 2,
    why: "A worktree só leva o que o Git conhece. A correção é declarar o que precisa acompanhar ou usar um hook de bootstrap.",
  },
  {
    id: "worktree-limit",
    topic: "Worktree",
    prompt: "O que a worktree NÃO resolve?",
    options: [
      "Conflito de arquivos entre duas frentes",
      "Coordenação e permissão: worktree não é sandbox",
      "Trabalhar em duas branches ao mesmo tempo",
    ],
    answer: 1,
    why: "Worktree resolve isolamento de arquivo. Coordenação fica com subagentes ou com o orquestrador humano; permissão fica com o harness.",
  },
  {
    id: "subagent-description",
    topic: "Subagentes",
    prompt: "Para que serve o campo description de um subagente?",
    options: [
      "Dizer em que situação a delegação faz sentido",
      "Virar o system prompt do subagente",
      "Definir quais ferramentas ele pode usar",
    ],
    answer: 0,
    why: "name e description são obrigatórios. O corpo do markdown é que vira o system prompt; tools define o conjunto permitido.",
  },
  {
    id: "tool-scope",
    topic: "Permissões",
    prompt: "Por que tirar Write e Edit de um subagente revisor?",
    options: [
      "Porque Write e Edit custam mais tokens",
      "Porque ele herda as permissões do agente principal",
      "Menos ferramentas, menos ações erradas possíveis",
    ],
    answer: 2,
    why: "disallowedTools bloqueia capacidades antes da execução. O escopo de ferramentas faz parte do desenho do agente.",
  },
  {
    id: "second-harness",
    topic: "Orquestração",
    prompt: "Quando um segundo harness se justifica?",
    options: [
      "Sempre que a tarefa tiver mais de duas etapas",
      "Fornecedores diferentes ou frentes longas e independentes",
      "Quando a janela de contexto do primeiro enche",
    ],
    answer: 1,
    why: "Outro harness duplica contexto e coordenação. Comece com a composição mais simples que atende a tarefa.",
  },
  {
    id: "agents-md",
    topic: "Contratos",
    prompt: "Qual é a vantagem do AGENTS.md na raiz do repositório?",
    options: [
      "Markdown versionado que vários harnesses leem",
      "Carrega sozinho em toda chamada, sem custo de tokens",
      "Dispensa a escrita de ADRs",
    ],
    answer: 0,
    why: "Guarda comandos exatos, caminhos proibidos e convenções. Um arquivo gigante perde hierarquia: regra demais nivela tudo.",
  },
  {
    id: "adr-shape",
    topic: "ADR",
    prompt: "Quais seções formam um ADR no formato Nygard?",
    options: [
      "Resumo, requisitos, cronograma e responsáveis",
      "Problema, hipótese, experimento e métrica",
      "Título, status, contexto, decisão e consequências",
    ],
    answer: 2,
    why: "Costuma caber em uma ou duas páginas e fica versionado junto do código.",
  },
  {
    id: "adr-agents",
    topic: "ADR",
    prompt: "Por que o ADR ajuda no trabalho com agentes?",
    options: [
      "Guarda a decisão entre sessões, mesmo após compactação",
      "Impede o agente de alterar arquivos de infraestrutura",
      "Reduz os tokens que cada sessão consome",
    ],
    answer: 0,
    why: "Os agentes não precisam conversar diretamente: o estado compartilhado fica no repositório.",
  },
  {
    id: "incident",
    topic: "Case",
    prompt: "O que derrubou o site do BuscaGames por cerca de 20 minutos?",
    options: [
      "Um agente apagou a base de dados de produção",
      "A Steam bloqueou o scraping e a API parou",
      "Worker de I/O carregou modelo pesado e saturou a VPS",
    ],
    answer: 2,
    why: "4 vCPU compartilhados pelo site e pelos workers, 15 GB de RAM no pico. Sem limites de recurso, a falha atingiu o host inteiro.",
  },
  {
    id: "tacit",
    topic: "Case",
    prompt: "O agente inspecionou os containers. O que ainda faltava?",
    options: [
      "A regra de subir cada serviço isolado, não versionada",
      "Permissão para reiniciar o container após o deploy",
      "Janela de contexto maior para ler o repositório",
    ],
    answer: 0,
    why: "Inspecionar um ambiente mostra o que existe. Não revela uma convenção que nunca foi escrita.",
  },
  {
    id: "autonomy",
    topic: "Autonomia",
    prompt: "Por reversibilidade e blast radius, o que exige aprovação?",
    options: [
      "Qualquer mudança de código acima de 100 linhas",
      "Produção: dados, permissões e recursos compartilhados",
      "Toda execução de teste que use rede",
    ],
    answer: 1,
    why: "Local e efêmero admite autonomia alta; staging compartilhado pede regras e revisão seletiva; produção fica atrás de aprovação humana.",
  },
  {
    id: "checklist",
    topic: "Autonomia",
    prompt: "Qual pergunta NÃO está no checklist antes da autonomia?",
    options: [
      "Existe rollback se o próprio host falhar?",
      "CPU, memória e cotas estão declaradas?",
      "Qual modelo tem o melhor benchmark na linguagem?",
    ],
    answer: 2,
    why: "O checklist é: qual ambiente, qual o limite, como reverter e se a ação precisa de aprovação humana.",
  },
  {
    id: "cost",
    topic: "Custo",
    prompt: "Que custo o paralelismo acrescenta além da fatura do modelo?",
    options: [
      "Tempo de convergir e risco em ambiente compartilhado",
      "Licenças adicionais por subagente aberto",
      "Armazenamento: cada worktree duplica o histórico",
    ],
    answer: 0,
    why: "Cada agente replica parte do contexto; cache reduz preço, mas não zera uso. Ação sobre ambiente compartilhado soma risco que não está na fatura.",
  },
  {
    id: "isolation",
    topic: "Isolamento",
    prompt: "O que caracteriza orchestrator-worker frente a um swarm?",
    options: [
      "Mais estado compartilhado e coordenação emergente",
      "Um único agente executando etapas em sequência",
      "Estado separado e depuração mais simples de reconstruir",
    ],
    answer: 2,
    why: "No BuscaGames os subagentes trabalhavam sem conversar entre si, e documentos versionados foram o canal entre as frentes.",
  },
];
