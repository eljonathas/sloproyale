// Tipos mínimos do carregador vendorizado. Não há pacote de tipos instalado: o
// que interessa aqui é fechar a compilação sem acrescentar dependência.
export declare class GLTFLoader {
  loadAsync(url: string): Promise<{ scene: any; animations: any[] }>;
}
