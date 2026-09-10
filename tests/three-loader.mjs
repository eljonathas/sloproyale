// Usa nos testes a mesma cópia de Three.js que o importmap carrega no jogo.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three')
    return { url: new URL('../assets/vendor/three.module.js', import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
