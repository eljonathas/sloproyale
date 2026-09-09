# Agent Arena — A Cidadela dos Agentes

Jogo de decisões em equipe para o encerramento de uma apresentação sobre orquestração de agentes. A narrativa é própria: guildas reconstroem uma cidadela antes de uma tempestade de caos. As seis missões transformam conceitos técnicos em decisões sobre o reino.

## Rodar

Requer Node.js 22 ou posterior. Não é necessário instalar pacotes.

```sh
npm start
```

Abra `http://localhost:8080`. O terminal também mostra o endereço para os celulares na mesma rede. Mantenha o processo aberto durante a dinâmica. Para mudar a porta: `PORT=8081 npm start`.

Modelos, texturas, fontes e Three.js estão no projeto. Não há chamadas para CDNs nem necessidade de internet durante a partida; os aparelhos precisam alcançar o servidor pela rede local. Uma rede de convidados que bloqueie comunicação entre dispositivos pode impedir a entrada dos celulares.

## Conduzir a dinâmica

1. No computador do apresentador, escolha **Criar uma arena**. Configure de 4 a 80 participantes, de 2 a 8 pessoas por time e o tempo por missão. O limite é de 16 guildas, com vagas equilibradas.
2. Copie o convite ou mostre o endereço e código da sala. Quando o computador usa `localhost`, o convite utiliza o endereço da rede local.
3. Cada participante informa o nome e escolhe uma guilda disponível. É possível trocar de guilda antes de começar. O admin pode remover uma entrada duplicada pelo painel de participantes.
4. O admin inicia quando todas as guildas têm ao menos uma pessoa. Se faltarem participantes, o jogo pede confirmação para iniciar com o grupo presente.
5. Todos recebem a mesma missão e três cartas. O time conversa; cada pessoa confirma uma decisão. O voto é único e não pode ser alterado. O apresentador pode pausar ou encerrar a votação; o prazo também a encerra automaticamente.
6. A revelação mostra os pontos e explica o conceito. O admin avança quando terminar a discussão. Ao final das seis missões, o maior placar vence e o apresentador entrega o brinde à guilda vencedora.

**Pontuação:** 100 pontos pela melhor decisão; algumas alternativas válidas, mas incompletas, valem 40; as demais valem 0. A carta mais votada determina os pontos do time, independentemente do tamanho dele. Em empate entre cartas, aplica-se a média dos pontos, arredondada para o inteiro mais próximo. Um time sem votos recebe 0. Não há bônus por velocidade. O máximo é 600 pontos. Guildas empatadas no maior placar compartilham a vitória.

**Treino:** o botão **Treinar** abre uma partida individual. A confirmação da carta revela imediatamente a explicação; depois, avance à próxima missão. Não há oponentes artificiais nem pontuação aleatória.

## Missões e narrativa

- O chamado das guildas: delegação e contrato entre frentes.
- Cada agente no seu território: worktrees e isolamento de arquivos.
- O guardião das ferramentas: harness e permissões.
- Uma decisão que sobrevive: ADR e contexto versionado.
- Território novo, mochila vazia: preparação do ambiente de uma worktree.
- Acender o coração da Cidadela: autonomia, recursos compartilhados e aprovação.

Os quatro personagens são arquétipos visuais. As pessoas participam da mesma votação; não há poderes individuais ou regras extras de combate. Os capítulos concluídos reconstroem visualmente a cidadela, enquanto o placar mede a qualidade das decisões.

## Interface e implementação

Toda a interface visível — telas, campos, botões, cartas, cronômetro, placar e modais — é desenhada no Canvas 2D. O diorama usa WebGL/Three.js em um segundo canvas. HTML é apenas o contêiner; um campo invisível habilita o teclado nativo dos celulares e controles invisíveis oferecem descrições para tecnologias assistivas.

Use toque ou mouse. No teclado: Tab/Shift+Tab navegam, Enter confirma, 1/2/3 selecionam cartas, Escape fecha os painéis. O som é opcional. A preferência de redução de movimento é respeitada. Em computadores, há controle de tela cheia.

- `agent-arena.html`: entrada e contêiner dos canvases.
- `src/client.js`: interface, interação e sincronização.
- `src/scene.js`: diorama, modelos, retratos e animações.
- `src/game.mjs`: regras e estado autoritativo.
- `src/missions.mjs`: narrativa, cartas e gabaritos; não é servido ao navegador.
- `server.mjs`: servidor HTTP e eventos de atualização, usando apenas a biblioteca padrão do Node.js.

Salas e placares são mantidos na memória do servidor. Recarregar a página preserva o acesso na mesma aba, e a conexão de eventos tenta se recuperar automaticamente. **Reiniciar o servidor encerra as salas e apaga os placares.** Esta versão é destinada a uma dinâmica presencial conduzida, sem contas ou persistência em banco de dados. Se hospedar atrás de um proxy, configure `PUBLIC_URL` com a URL acessível aos participantes para os convites.

## Verificação

```sh
npm test
```

Onze testes cobrem regras, limite e equilíbrio dos times, voto único, autorização do admin, proteção dos gabaritos, relógio, pausa, empate, seis rodadas completas, HTTP, stream de eventos e ações reais do cliente contra o servidor, incluindo admin, dois participantes e treino.

As telas 2D foram renderizadas e inspecionadas em tamanhos de computador e celular. Os modelos e suas dependências locais foram verificados. A renderização WebGL e o teclado virtual ainda precisam de uma passagem em navegador real: não havia navegador conectado no ambiente desta implementação.

## Créditos

Modelos de Kay Lousberg, os mesmos packs referenciados na base original:

- [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), CC0. Licença em `assets/models/CHARACTERS-LICENSE.txt`.
- [KayKit Medieval Hexagon](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0), CC0. Licença em `assets/models/BUILDINGS-LICENSE.txt`.
- Three.js 0.180.0, MIT. Licença em `assets/vendor/THREE-LICENSE.txt`.
- Lilita One e Nunito, SIL Open Font License. Licenças em `assets/fonts/`.

O arquivo da apresentação foi preservado. A dinâmica implementada usa narrativa própria e votação coletiva; não reproduz o exercício de contextos privados descrito no slide 31.
