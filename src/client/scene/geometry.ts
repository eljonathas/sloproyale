import * as THREE from "three";

/**
 * Fábrica de blocos do diorama.
 *
 * Caixas e materiais compartilhados pelas construções e pelo terreno. O cache
 * evita criar um material novo para cada pedra, arbusto ou peça de andaime.
 */
export class MeshFactory {
  private readonly materials = new Map<number, any>();

  material(color: number): any {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.87 });
      this.materials.set(color, material);
    }
    return material;
  }

  /** Uma caixa com sombra, posicionada e pendurada num pai. */
  box(
    width: number,
    height: number,
    depth: number,
    color: number,
    x: number,
    y: number,
    z: number,
    parent: any,
  ): any {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      this.material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}

/**
 * Encaixa um modelo carregado numa altura conhecida e o apoia no chão.
 * Os packs vêm em escalas diferentes; sem isto, um castelo sairia do tabuleiro
 * e um agente ficaria do tamanho de uma pedra.
 */
export function fitToHeight(object: any, height: number): any {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  object.scale.setScalar(height / size.y);
  const grounded = new THREE.Box3().setFromObject(object);
  object.position.y -= grounded.min.y;
  object.traverse((node: any) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return object;
}
