import * as THREE from "three";
import { clone } from "../../../assets/utils/SkeletonUtils.js";
import type { JobView } from "../../shared/protocol.js";
import { along, type Island, SITE_COORDS } from "./island.js";

/** Um modelo carregado com as animações dele. */
export interface CharacterTemplate {
  readonly object: any;
  readonly clips: any[];
}

/** Segundos que o agente leva do acampamento até a frente. */
const WALK_SECONDS = 3.4;
/** Segundos do caminho de volta, quando a tarefa termina. */
const RETURN_SECONDS = 3;
/** Postos laterais para não sobrepor agentes na mesma obra. */
const LANES = [0, -1.5, 1.5] as const;

/** Um agente em campo, com o próprio trajeto e a própria animação. */
class Agent {
  grown = 0;
  retiredAt: number | null = null;
  private clipName: string | null = null;
  readonly baseScale: any;

  constructor(
    readonly object: any,
    readonly mixer: any,
    readonly clips: any[],
    readonly path: any[],
    readonly marker: any,
    public job: JobView,
  ) {
    this.baseScale = object.scale.clone();
  }

  private setClip(name: string): void {
    if (this.clipName === name) return;
    this.mixer.stopAllAction();
    const clip =
      this.clips.find((candidate) => candidate.name === name) ??
      this.clips.find((candidate) => candidate.name === "Idle");
    if (clip) {
      this.mixer.clipAction(clip).play();
      // Aplica a pose inicial mesmo quando a preferência reduz movimento.
      this.mixer.update(0);
    }
    this.clipName = name;
  }

  /** Devolve false quando o agente terminou de encolher e pode ser removido. */
  update(
    elapsed: number,
    dt: number,
    time: number,
    teamColor: string,
    reduced: boolean,
    paused: boolean,
  ): boolean {
    // Ida e volta percorrem a mesma rota. O trecho de volta termina no
    // acampamento, onde o agente encolhe até sumir.
    const walking = this.retiredAt === null;
    const step = walking
      ? Math.max(0, (elapsed - this.job.startedAt) / WALK_SECONDS)
      : 1 - Math.max(0, (elapsed - this.retiredAt!) / RETURN_SECONDS);
    const { position, heading } = along(this.path, step);
    this.object.position.copy(position);

    const arrived = walking && step >= 1;
    this.setClip(
      arrived
        ? this.job.cardId === "builder"
          ? "Interact"
          : "Spellcasting"
        : "Walking_A",
    );

    // Surge crescendo no acampamento e recolhe encolhendo: sem isto o modelo
    // aparecia e sumia de um quadro para o outro.
    const target = walking ? 1 : Math.max(0, Math.min(1, step * 4));
    this.grown += (target - this.grown) * (reduced ? 1 : Math.min(1, dt * 7));
    if (!walking && this.grown < 0.06) return false;

    this.object.scale.copy(this.baseScale).multiplyScalar(this.grown);
    if (arrived) {
      // O posto pode ser lateral. Ao trabalhar, olha para o centro da obra,
      // não para a direção do último trecho da caminhada.
      const [x, z] = SITE_COORDS[this.job.siteId]!;
      heading.set(x - position.x, 0, z - position.z);
    } else if (!walking) heading.negate();
    this.object.rotation.y = Math.atan2(heading.x, heading.z);
    this.mixer.update(reduced || paused ? 0 : dt);

    this.marker.position.set(
      this.object.position.x,
      0.57,
      this.object.position.z,
    );
    this.marker.material.color.set(this.job.conflict ? "#ff8067" : teamColor);
    this.marker.material.opacity = 0.95 * this.grown;
    this.marker.scale.setScalar(
      (reduced ? 1 : 1 + Math.sin(time * 0.005 + this.job.id) * 0.07) *
        Math.max(0.2, this.grown),
    );
    return true;
  }

  dispose(island: Island): void {
    island.remove(this.object, this.marker);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.object);
    // O clone tem esqueletos próprios, mas compartilha malhas e materiais.
    this.object.traverse((node: any) => {
      if (node.isSkinnedMesh) node.skeleton.dispose();
    });
    this.marker.geometry.dispose();
    this.marker.material.dispose();
  }
}

/** Onde um agente aparece na tela, para o cliente rotulá-lo. */
export interface AgentAnchor {
  readonly id: number;
  readonly job: JobView;
  readonly x: number;
  readonly y: number;
}

/**
 * Os agentes em campo de uma guilda.
 *
 * A tripulação nasce e morre a partir da lista de tarefas do snapshot: quando
 * uma tarefa aparece, um agente sai do acampamento; quando some, ele volta e
 * encolhe. Trocar de guilda descarta tudo.
 */
export class AgentCrew {
  private readonly agents = new Map<number, Agent>();
  private teamId: number | null = null;

  constructor(
    private readonly island: Island,
    private readonly templates: Record<string, CharacterTemplate>,
  ) {}

  /** Descarta a tripulação ao trocar a guilda observada. */
  follow(teamId: number | null): void {
    if (this.teamId === teamId) return;
    for (const agent of this.agents.values()) agent.dispose(this.island);
    this.agents.clear();
    this.teamId = teamId;
  }

  private spawn(job: JobView, now: number): void {
    const template =
      this.templates[job.cardId === "builder" ? "Barbarian" : "Mage"];
    if (!template) return;

    // O template é o mesmo objeto usado como ator da vitrine, e a batalha o
    // esconde no começo de cada quadro. Sem restaurar isto, o clone nasce
    // invisível e o agente nunca aparece caminhando até a frente.
    const object = clone(template.object);
    object.visible = true;
    object.scale.multiplyScalar(1.2);
    this.island.add(object);

    // Frentes paralelas colocam vários agentes na mesma obra: cada um recebe um
    // posto próprio, senão os modelos ficam sobrepostos. A rota resolve a
    // geometria — o posto sai de lado sem tirar o agente da linha da obra.
    const posted = [...this.agents.values()].filter(
      (agent) => agent.job.siteId === job.siteId,
    ).length;
    const path = this.island.route(
      job.siteId,
      LANES[posted % LANES.length]!,
      Math.floor(posted / LANES.length) * 1.5,
    );
    this.island.flashCamp(now);

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.86, 28),
      new THREE.MeshBasicMaterial({
        color: job.conflict ? 0xff8067 : 0xffd888,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    this.island.add(marker);

    this.agents.set(
      job.id,
      new Agent(
        object,
        new THREE.AnimationMixer(object),
        template.clips,
        path,
        marker,
        job,
      ),
    );
  }

  update(
    jobs: readonly JobView[],
    elapsed: number,
    dt: number,
    time: number,
    teamColor: string,
    reduced: boolean,
    paused: boolean,
  ): void {
    for (const job of jobs) {
      const existing = this.agents.get(job.id);
      if (existing) existing.job = job;
      else this.spawn(job, time);
    }
    for (const [id, agent] of this.agents) {
      const active = jobs.some((job) => job.id === id);
      if (!active && agent.retiredAt === null) {
        agent.retiredAt = elapsed;
        this.island.flashCamp(time);
      }
      const alive = agent.update(elapsed, dt, time, teamColor, reduced, paused);
      if (!alive) {
        agent.dispose(this.island);
        this.agents.delete(id);
      }
    }
  }

  /** Posições projetadas, para o cliente pendurar os rótulos. */
  anchors(
    project: (x: number, y: number, z: number) => { x: number; y: number },
  ): AgentAnchor[] {
    return [...this.agents.values()].map((agent) => ({
      id: agent.job.id,
      job: agent.job,
      ...project(agent.object.position.x, 3.7, agent.object.position.z),
    }));
  }
}
