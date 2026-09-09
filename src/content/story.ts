import type { StoryView, StudyView } from "../shared/protocol.js";

/**
 * Os números da partida. Ajustar o equilíbrio do jogo é mexer aqui e em mais
 * lugar nenhum: interface, regras e testes leem estes valores.
 */
export const STORY: StoryView = {
    "title": "Reconstrua antes da tempestade",
    "description": "O caos rompeu o Portal, apagou a Forja e derrubou a Muralha. Mobilize sua guilda: construa, revise e entregue três níveis em cada frente.",
    "maxLevel": 3,
    "buildSeconds": 36,
    "reviewSeconds": 9,
    "integrationSeconds": 5,
    "conflictRate": 0.5,
    "maxWorktrees": 2,
    "maxEnergy": 12,
    "regen": 0.65,
    "scoreSafe": 100,
    "scoreUnsafe": 40
  };

/**
 * O estudo em campo. O acerto adianta `speedup` do trabalho que falta e soma
 * `bonus` pontos.
 */
export const STUDY: StudyView = {
    "bonus": 20,
    "speedup": 0.5,
    "revealSeconds": 4.5
  };

/** Coordenadas das frentes no tabuleiro, compartilhadas com a cena 3D. */
export interface SiteBlueprint {
  readonly id: number;
  readonly name: string;
  readonly icon: string;
  readonly purpose: string;
  readonly x: number;
  readonly z: number;
}

export const SITES: readonly SiteBlueprint[] = [
    {
      "id": 0,
      "name": "Portal",
      "icon": "crown",
      "purpose": "Reconecte as rotas do reino.",
      "x": -5.6,
      "z": -8.4
    },
    {
      "id": 1,
      "name": "Forja",
      "icon": "tools",
      "purpose": "Restaure a fonte de energia.",
      "x": 0,
      "z": 10.4
    },
    {
      "id": 2,
      "name": "Muralha",
      "icon": "shield",
      "purpose": "Erga a defesa da Cidadela.",
      "x": 5.6,
      "z": -8.4
    }
  ];
