// A Three.js vem versionada em assets/vendor e é resolvida pelo importmap do
// navegador. Não há pacote de tipos instalado: declarar o módulo aqui mantém a
// compilação fechada sem acrescentar dependência. O que é nosso — cena, câmera,
// agentes, frentes — continua tipado nas classes de src/client/scene.
declare module "three" {
  const THREE: any;
  export = THREE;
}
