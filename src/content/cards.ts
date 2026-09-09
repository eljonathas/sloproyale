import type { CardView } from "../shared/protocol.js";

/**
 * O baralho. Os textos são o que a turma lê durante a partida, então cada
 * descrição carrega o número real da regra e cada lição resume o slide
 * correspondente da apresentação.
 */
export const CARDS: readonly CardView[] = [
    {
      "id": "builder",
      "name": "Construtor",
      "model": "Barbarian",
      "icon": "tools",
      "color": "#edba80",
      "cost": 3,
      "description": "Sozinho leva 36 s. Cada canteiro isolado soma uma frente de trabalho.",
      "lesson": "Delegação: cada agente recebe uma frente concreta. Dois Construtores isolados constroem em metade do tempo; sem canteiro livre eles disputam o mesmo checkout."
    },
    {
      "id": "worktree",
      "name": "Worktree",
      "model": "Rogue_Hooded",
      "icon": "branch",
      "color": "#83dbb1",
      "cost": 2,
      "description": "Abre um canteiro isolado nesta frente. Até 2 por frente, e duram a partida.",
      "lesson": "Uma worktree é um diretório de trabalho, e cabe um agente em cada. Abrir um canteiro libera mais um Construtor em paralelo; sem canteiro livre eles voltam ao mesmo checkout. Worktree não substitui sandbox."
    },
    {
      "id": "reviewer",
      "name": "Revisor",
      "model": "Mage",
      "icon": "mage",
      "color": "#c9a2fa",
      "cost": 2,
      "description": "Valida e integra a obra. 9 s, +3 s por falha e +5 s por frente extra.",
      "lesson": "Revisão acontece sobre uma entrega concreta. Falhas custam tempo, e cada frente paralela precisa ser convergida: paralelismo compra latência pagando coordenação."
    },
    {
      "id": "harness",
      "name": "Harness",
      "model": "Knight",
      "icon": "shield",
      "color": "#79bfff",
      "cost": 2,
      "description": "Bloqueia entrega sem revisão e comandos do caos neste alvo.",
      "lesson": "O harness aplica permissões e bloqueia ações fora das regras. Dar uma instrução não é o mesmo que restringir a ferramenta."
    }
  ];

/** Busca uma carta pelo identificador, ou undefined se não existir. */
export function findCard(id: string): CardView | undefined {
  return CARDS.find((card) => card.id === id);
}
