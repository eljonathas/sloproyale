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
    description: "Envia um agente para construir. Trabalho pronto em 12 s.",
    lesson:
      "Delegação: cada agente recebe uma frente concreta. O time decide o que executar em paralelo.",
  },
  {
    id: "worktree",
    name: "Worktree",
    model: "Rogue_Hooded",
    icon: "branch",
    color: "#83dbb1",
    cost: 2,
    description: "Separa o território desta frente. Dura a partida inteira.",
    lesson:
      "Worktrees isolam os arquivos entre frentes. Dois agentes na mesma frente ainda podem conflitar. Não substituem sandbox.",
  },
  {
    id: "reviewer",
    name: "Revisor",
    model: "Mage",
    icon: "mage",
    color: "#c9a2fa",
    cost: 2,
    description:
      "Valida a construção e corrige falhas. Leva 6 s + 3 s por falha.",
    lesson:
      "Revisão acontece sobre uma entrega concreta. Falhas acumuladas custam tempo para corrigir.",
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
  buildSeconds: 12,
  reviewSeconds: 6,
  maxEnergy: 12,
  regen: 0.65,
  scoreSafe: 100,
  scoreUnsafe: 40,
};
