import * as THREE from "three";
import { mergeGeometries } from "../../../assets/utils/BufferGeometryUtils.js";
import { MeshFactory } from "./geometry.js";

/** Cenário fixo. As coordenadas e rotas das frentes continuam em Island. */
export class Terrain {
  readonly group = new THREE.Group();
  private readonly factory = new MeshFactory();

  constructor() {
    this.land();
    this.river();
    this.roads();
    this.gardens();
    this.ramparts();
    this.batch();
  }

  private box(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
  ): any {
    return this.factory.box(w, h, d, color, x, y, z, this.group);
  }

  private mesh(
    geometry: any,
    color: number,
    x: number,
    y: number,
    z: number,
  ): any {
    const mesh = new THREE.Mesh(geometry, this.factory.material(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private slab(
    points: readonly (readonly [number, number])[],
    bottom: number,
    height: number,
    color: number,
  ): any {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) =>
      i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
    );
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    return this.mesh(geometry, color, 0, bottom, 0);
  }

  private land(): void {
    const outline = [
      [-11.5, -10.8],
      [-9.4, -13.6],
      [-3.8, -14],
      [3.5, -13.7],
      [9.4, -13.4],
      [11.5, -10.6],
      [11.8, -4.2],
      [11.3, 1.6],
      [11.6, 9.9],
      [9.1, 13.4],
      [3.2, 14],
      [-3.7, 13.8],
      [-9.5, 13.3],
      [-11.6, 10.1],
      [-11.8, 4.2],
      [-11.4, -3.8],
    ] as const;
    this.slab(outline, -1.55, 1.4, 0x637777);
    this.slab(
      outline.map(([x, z]) => [x * 0.98, z * 0.98]),
      -0.15,
      0.33,
      0xa19d78,
    );
    this.slab(
      outline.map(([x, z]) => [x * 0.96, z * 0.96]),
      0.18,
      0.21,
      0x698658,
    );

    // Rochas em camadas acompanham o contorno, sem aumentar o zoom da batalha.
    const core = this.slab(
      outline.map(([x, z]) => [x * 0.82, z * 0.82]),
      -3.9,
      2.5,
      0x405c63,
    );
    core.userData.decor = true;
    outline.forEach(([x, z], i) => {
      const rock = this.mesh(
        new THREE.DodecahedronGeometry(1, 0),
        [0x4b646b, 0x536e70, 0x6d7f78][i % 3]!,
        x * 0.83,
        -2.3 - (i % 3) * 0.35,
        z * 0.83,
      );
      rock.scale.set(2.5, 2.2 + (i % 3) * 0.45, 2.5);
      rock.rotation.set(i * 0.3, i * 1.7, 0.25);
      rock.userData.decor = true;
    });
    const tip = this.mesh(
      new THREE.CylinderGeometry(8.5, 2.8, 3, 7),
      0x334f5a,
      0,
      -5.5,
      0,
    );
    tip.scale.z = 1.22;
    tip.userData.decor = true;

    // Manchas amplas de grama, sem um quadriculado sob as unidades.
    for (const side of [-1, 1]) {
      this.slab(
        [
          [-10.4, side * 3.1],
          [-7.7, side * 3.4],
          [-7.5, side * 10.8],
          [-9.2, side * 11.8],
          [-10.6, side * 9.4],
        ],
        0.391,
        0.012,
        0x789563,
      );
      this.slab(
        [
          [-3.6, side * 3],
          [2.9, side * 3.1],
          [3.8, side * 5.9],
          [1.2, side * 7.1],
          [-3.2, side * 6.4],
        ],
        0.391,
        0.012,
        0x728e5b,
      );
    }
  }

  private river(): void {
    const banks = [-11.4, -9, -6.9, -4.2, -1.8, 1, 3.6, 6.8, 9, 11.4];
    const edge = banks.map((x, i) => [x, -1.7 - (i % 3) * 0.12] as const);
    const opposite = [...banks]
      .reverse()
      .map((x, i) => [x, 1.7 + (i % 3) * 0.12] as const);
    this.slab([...edge, ...opposite], 0.395, 0.03, 0xb4af86);
    const water = this.slab(
      [
        ...edge.map(([x, z]) => [x, z + 0.23] as const),
        ...opposite.map(([x, z]) => [x, z - 0.23] as const),
      ],
      0.43,
      0.02,
      0x328f9f,
    );
    // A superfície pouco reflexiva mantém o contraste das pontes e dos agentes.
    water.material = new THREE.MeshStandardMaterial({
      color: 0x328f9f,
      roughness: 0.38,
      metalness: 0.12,
    });
    this.box(22.6, 0.012, 1.65, 0x3ca9b6, 0, 0.459, 0);
    for (let i = 0; i < 22; i++) {
      const x = -10.8 + i;
      if (Math.abs(Math.abs(x) - 5.6) < 1.8) continue;
      this.box(
        0.35 + (i % 4) * 0.18,
        0.013,
        0.045,
        0x9dd9d2,
        x,
        0.475,
        Math.sin(i * 2.7) * 1.2,
      );
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const x = -10.5 + i * 2.3;
        if (Math.abs(Math.abs(x) - 5.6) < 1.9) continue;
        const stone = this.mesh(
          new THREE.DodecahedronGeometry(0.4, 0),
          i % 2 ? 0x99a28d : 0x7c9286,
          x,
          0.51,
          side * 1.9,
        );
        stone.scale.set(1.5, 0.65, 0.9);
        stone.rotation.y = i;
      }
      // Cascatas restritas à base decorativa, fora das superfícies interativas.
      const fall = this.box(0.12, 3.6, 2.75, 0x59b4be, side * 11.42, -1.35, 0);
      fall.userData.decor = true;
      for (let i = 0; i < 5; i++) {
        const ribbon = this.box(
          0.14,
          2.6 + (i % 3) * 0.45,
          0.09,
          0xa2d9d3,
          side * 11.5,
          -1.15,
          -1.1 + i * 0.52,
        );
        ribbon.userData.decor = true;
      }
    }
    for (const x of [-5.6, 5.6]) {
      this.box(3.25, 0.19, 4.55, 0x584c3b, x, 0.5, 0);
      for (let i = 0; i < 12; i++)
        this.box(
          3.1,
          0.1,
          0.34,
          i % 3 ? 0xb28b57 : 0xc19a66,
          x,
          0.62,
          -2.09 + i * 0.38,
        );
      for (const dx of [-1.68, 1.68]) {
        this.box(0.15, 0.16, 4.8, 0x867049, x + dx, 1.25, 0);
        for (const z of [-2.2, 0, 2.2]) {
          this.box(0.25, 1.02, 0.25, 0x766040, x + dx, 0.9, z);
          this.box(0.32, 0.12, 0.32, 0xd3bb88, x + dx, 1.47, z);
        }
      }
      for (const z of [-2.65, 2.65])
        this.box(3.5, 0.12, 0.65, 0xb5b39a, x, 0.47, z);
    }
  }

  private path(
    points: readonly (readonly [number, number])[],
    width: number,
  ): void {
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1]!;
      const [bx, bz] = points[i]!;
      const length = Math.hypot(bx - ax, bz - az);
      const angle = Math.atan2(bx - ax, bz - az);
      const bed = this.box(
        width + 0.18,
        0.055,
        length,
        0x95987b,
        (ax + bx) / 2,
        0.425,
        (az + bz) / 2,
      );
      bed.rotation.y = angle;
      const rows = Math.ceil(length / 0.8);
      for (let row = 0; row < rows; row++) {
        const t = (row + 0.5) / rows;
        for (let col = 0; col < 3; col++) {
          const offset = ((col - 1) * width) / 3;
          const stone = this.box(
            width / 3 - 0.045,
            0.055,
            length / rows - 0.045,
            [0xbfc0a5, 0xadb39a, 0xb5b99f][(row + col * 2) % 3]!,
            ax + (bx - ax) * t + Math.cos(angle) * offset,
            0.468,
            az + (bz - az) * t - Math.sin(angle) * offset,
          );
          stone.rotation.y = angle;
        }
      }
    }
  }

  private roads(): void {
    for (const x of [-5.6, 5.6]) {
      this.path(
        [
          [x, -2.9],
          [x, -8.4],
        ],
        2.3,
      );
      this.path(
        [
          [x, 2.9],
          [x, 8.4],
        ],
        2.3,
      );
    }
    this.path(
      [
        [-5.6, 3.1],
        [6.6, 7.4],
      ],
      1.5,
    );
    this.path(
      [
        [6.6, 7.4],
        [3, 9.2],
        [0, 10.4],
      ],
      1.5,
    );
    this.path(
      [
        [-5.6, -8.4],
        [0, -10.4],
        [5.6, -8.4],
      ],
      1.35,
    );
    for (const [x, z, radius] of [
      [-5.6, -8.4, 3],
      [5.6, -8.4, 3],
      [0, 10.4, 3.05],
    ]) {
      this.mesh(
        new THREE.CylinderGeometry(radius, radius + 0.12, 0.09, 12),
        0x8d9787,
        x,
        0.445,
        z,
      );
      this.mesh(
        new THREE.CylinderGeometry(radius - 0.2, radius - 0.2, 0.035, 12),
        0xb3b7a0,
        x,
        0.5,
        z,
      );
      const inlay = this.mesh(
        new THREE.RingGeometry(radius - 0.4, radius - 0.34, 48),
        0x899583,
        x,
        0.521,
        z,
      );
      inlay.rotation.x = -Math.PI / 2;
    }
  }

  private tree(x: number, z: number, scale: number, broad = false): void {
    this.box(
      0.25 * scale,
      1.4 * scale,
      0.26 * scale,
      0x655b3f,
      x,
      0.9 * scale,
      z,
    );
    for (let i = 0; i < 3; i++) {
      const geometry = broad
        ? new THREE.IcosahedronGeometry((1.03 - i * 0.12) * scale, 0)
        : new THREE.ConeGeometry((1.12 - i * 0.26) * scale, 1.6 * scale, 6);
      const leaf = this.mesh(
        geometry,
        (broad
          ? [0x718b48, 0x8c9e53, 0xa5af66]
          : [0x315e4e, 0x41755a, 0x588869])[i]!,
        x,
        0.4 + (1.35 + i * 0.62) * scale,
        z,
      );
      leaf.rotation.y = i * 0.6 + x;
    }
  }

  private gardens(): void {
    for (const [x, z, size] of [
      [-9.7, -10.4, 0.85],
      [-10, -6, 0.95],
      [-9.5, -3.5, 0.65],
      [9.9, -10.5, 0.85],
      [10, -5.6, 0.72],
      [-9.9, 5.8, 0.9],
      [-9.1, 10.5, 1.05],
      [-6.9, 12.4, 0.7],
      [9.7, 11, 0.78],
      [9.7, 3.6, 0.7],
    ])
      this.tree(x, z, size, z > 0);
    // Posições determinísticas: todos os participantes veem a mesma paisagem.
    for (let i = 0; i < 44; i++) {
      const x = (i % 2 ? -1 : 1) * (9.35 + Math.sin(i * 2.4) * 0.9);
      const z = -11.7 + (i / 44) * 23.4;
      if (Math.abs(z) < 2.4 || (x > 0 && z > 5 && z < 10)) continue;
      const shrub = this.mesh(
        new THREE.IcosahedronGeometry(0.33 + (i % 3) * 0.08, 0),
        [0x4f7752, 0x638653, 0x879855][i % 3]!,
        x,
        0.58,
        z,
      );
      shrub.scale.set(1.3, 0.7, 1);
      if (i % 3 === 0) {
        for (let j = 0; j < 3; j++)
          this.mesh(
            new THREE.IcosahedronGeometry(0.09, 0),
            z < 0 ? 0xb9c4df : 0xe5c582,
            x + j * 0.18,
            0.83,
            z + 0.2,
          );
      }
    }
    // Pedras com musgo no fundo dos gramados, afastadas dos canteiros.
    for (const [x, z] of [
      [-2.6, -4.6],
      [2.5, -4.4],
      [-7.8, 9.5],
      [9.6, -2.8],
      [-10.2, 2.7],
    ]) {
      const rock = this.mesh(
        new THREE.DodecahedronGeometry(0.65, 0),
        0x8c9984,
        x,
        0.55,
        z,
      );
      rock.scale.set(1.2, 0.55, 0.85);
      rock.rotation.y = x;
    }
  }

  private ramparts(): void {
    // Muretas baixas contornam o mapa sem esconder os postos de trabalho.
    for (const x of [-10.9, 10.9]) {
      for (const z of [-9.2, -5.8, 5.8, 9.2]) {
        this.box(0.62, 0.48, 2.85, 0x8e9b8c, x, 0.59, z);
        this.box(0.78, 0.14, 3, 0xc0c3aa, x, 0.89, z);
      }
    }
    for (const z of [-12.75, 12.75])
      for (const x of [-5.8, 5.8]) {
        this.box(3.4, 0.48, 0.65, 0x8e9b8c, x, 0.59, z);
        this.box(3.55, 0.14, 0.8, 0xc0c3aa, x, 0.89, z);
      }
    for (const x of [-10.6, 10.6])
      for (const z of [-11.5, 11.5]) {
        this.box(1.2, 0.65, 1.2, 0x7c8b80, x, 0.66, z);
        this.box(1.35, 0.16, 1.35, 0xbdbea0, x, 1.05, z);
        this.box(0.36, 0.8, 0.36, 0x756848, x, 1.5, z);
        this.box(0.48, 0.4, 0.48, 0xf0d396, x, 1.94, z);
        const roof = this.mesh(
          new THREE.ConeGeometry(0.48, 0.3, 4),
          0x506a60,
          x,
          2.27,
          z,
        );
        roof.rotation.y = Math.PI / 4;
      }
  }

  /** Agrupa o cenário por material para não enviar uma chamada por pedra à GPU. */
  private batch(): void {
    const batches = new Map<
      string,
      { material: any; decor: boolean; geometries: any[] }
    >();
    this.group.updateMatrixWorld(true);
    for (const mesh of [...this.group.children]) {
      const decor = mesh.userData.decor === true;
      const key = mesh.material.uuid + String(decor);
      let batch = batches.get(key);
      if (!batch) {
        batch = { material: mesh.material, decor, geometries: [] };
        batches.set(key, batch);
      }
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      batch.geometries.push(geometry);
      mesh.geometry.dispose();
    }
    this.group.clear();
    for (const { material, decor, geometries } of batches.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.decor = decor;
      this.group.add(mesh);
      geometries.forEach((geometry: any) => geometry.dispose());
    }
  }
}
