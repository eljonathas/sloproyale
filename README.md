# Agent Arena — A Cidadela dos Agentes

Jogo multiplayer em tempo real para acompanhar a apresentação *Orquestrando Agentes de IA*. Cada guilda comanda agentes numa arena compartilhada e sente na prática o que o material explica: contexto é finito, frentes paralelas conflitam quando dividem o mesmo checkout, revisão transforma trabalho em entrega, e permissões barram o que uma instrução sozinha não barra.

## Rodar

Requer Node.js 22 ou posterior. Não é necessário instalar pacotes.

```sh
npm start
```

Abra `http://localhost:8080`. O terminal também mostra o endereço para os celulares na mesma rede. Para mudar a porta: `PORT=8081 npm start`.

Modelos, texturas, fontes e Three.js estão no projeto. Não há chamadas para CDNs; os aparelhos só precisam alcançar o servidor pela rede local. Uma rede de convidados que bloqueie comunicação entre dispositivos impede a entrada dos celulares.

## Como se joga

A arena tem três frentes — **Portal**, **Forja** e **Muralha** — e cada uma sobe até o nível 3. Vence a guilda com mais pontos quando o tempo acaba. As entregas valem até 900; as respostas certas somam por cima.

Toda guilda dispõe de **12 de contexto** (regenera 0,65/s) e **3 agentes em campo**, independentemente de quantas pessoas ela tenha. Esse é o ponto da dinâmica: o orçamento é do time, não da pessoa. Quem gasta sem combinar tira contexto do colega.

| Carta | Custo | Efeito |
| --- | --- | --- |
| Construtor | 3 | Um agente ocupa um diretório e constrói. Sozinho leva 36 s. |
| Worktree | 2 | Abre um canteiro isolado na frente. Até 2 por frente, permanentes. |
| Revisor | 2 | Valida e integra: 9 s, +3 s por falha, +5 s por frente extra. |
| Harness | 2 | Barra entrega sem revisão e comandos do caos naquela frente. |

O ciclo é construir → revisar → entregar. Entrega revisada e sem falhas vale **100 pontos**; entrega sem revisão vale **40**. Se a frente tem Harness, a entrega sem revisão é bloqueada em vez de pontuar 40 — o bloqueio não consome contexto.

**Estudo em campo.** Todo Construtor ou Revisor abre uma pergunta sobre o conteúdo da apresentação para quem enviou o agente — 18 perguntas em `src/missions.mjs`, embaralhadas por guilda. Acertar corta **metade do tempo que falta** na tarefa e soma **20 pontos**; errar não tira nada e revela a explicação. A pergunta vale enquanto o agente trabalha: responder cedo economiza mais. A janela ocupa o lugar do baralho, mas o botão **Baralho** devolve as cartas sem encerrar a pergunta, para que o time não perca o paralelismo entre frentes.

Isso existe porque, sem ele, bastava alocar agentes depressa para pontuar. Com ele, a guilda que entende worktree, harness e ADR constrói mais rápido e pontua mais. As 18 entregas de uma campanha completa abrem 18 perguntas: até 360 pontos de estudo sobre os 900 das entregas.

**Frentes paralelas e o checkout compartilhado.** Isolamento é por diretório, não por frente — é assim que worktree funciona no repositório. A guilda tem **um** checkout principal e cada Worktree abre mais um canteiro naquela frente. Um Construtor ocupa um canteiro livre; se não houver, cai no checkout principal.

- Cada Construtor isolado soma uma frente de trabalho: **1 leva 36 s, 2 levam 18 s, 3 levam 12 s** na mesma obra.
- Dois agentes no mesmo diretório **rendem metade cada** e ganham falhas — juntos produzem o de um só, gastando o dobro de contexto.
- Abrir uma Worktree durante um conflito **tira um agente do diretório compartilhado e encerra o conflito**, como aconteceria de verdade.

O preço é a convergência: cada frente extra soma **5 s de integração** na revisão, e três Construtores numa obra custam 13 de contexto — mais do que os 12 do orçamento de uma vez. Paralelismo compra latência pagando coordenação e tokens, que é o ponto do slide sobre custo.

**Tempestades.** Aos 45% e aos 75% da partida, o caos altera uma construção de cada guilda: uma falha a mais e a revisão perdida. Onde há Harness, o comando é bloqueado. É o exemplo de autonomia sem barreira do case do BuscaGames.

## Conduzir a dinâmica

1. No computador do apresentador, escolha **Criar uma arena**. Configure de 4 a 80 participantes, de 2 a 8 pessoas por guilda e a duração (3, 4, 5 ou 7 minutos). O limite é de 16 guildas, com vagas equilibradas.
2. Copie o convite ou mostre o endereço e o código da sala. Quando o computador usa `localhost`, o convite usa o endereço da rede local.
3. Cada participante informa o nome e escolhe uma guilda com vaga. O admin pode remover uma entrada duplicada antes do início.
4. O admin inicia quando cada guilda tem ao menos uma pessoa. Durante a partida pode pausar ou encerrar.
5. Ao final, o placar decide. Guildas empatadas no topo dividem a vitória.

**Treino:** o botão **Treinar** abre uma partida individual com as mesmas regras, útil para demonstrar o fluxo antes de soltar a turma.

O que costuma render discussão depois: guildas que empilharam Construtores sem abrir canteiro, guildas que entregaram sem revisar para pontuar rápido, guildas que gastaram Harness cedo e não sofreram com as tempestades, e o placar de acertos — o **Diário da guilda** guarda cada pergunta errada com a explicação, o que dá um roteiro pronto para retomar os pontos que a turma não fixou.

## Interface

Toda a interface visível é desenhada em Canvas 2D; o diorama usa WebGL/Three.js num segundo canvas. HTML é apenas o contêiner, mais um campo invisível para o teclado nativo dos celulares e controles invisíveis para tecnologias assistivas.

A janela de perguntas, o efeito de seleção e a marcação de certo e errado usam as mesmas primitivas do resto da interface — `panel`, gradientes de `button`, `pill` e o conjunto de ícones —, com entrada em duas batidas: primeiro a alternativa escolhida é marcada e a errada estremece, depois a explicação toma o lugar das outras. O acerto acende a barra de construção daquela frente com uma onda dourada.

Na batalha o mapa ocupa a largura inteira e os painéis ficam nas sobras laterais que a ilha na diagonal não alcança. Cada frente carrega o próprio estado no terreno: anel de progresso, andaime que cresce com a obra, uma cerca verde por canteiro aberto, cúpula do Harness e cristais vermelhos de falha. Vários Construtores na mesma obra ganham postos próprios e a placa mostra `2 frentes · 2×`. Ao escolher uma carta, cada frente mostra antes o que aconteceria ali — dourado libera, laranja avisa do conflito, vermelho recusa e diz o motivo. Os agentes saem do acampamento da guilda, atravessam a ponte e trabalham na frente, com o nome de quem os enviou sobre eles.

Use toque ou mouse. No teclado: Tab/Shift+Tab navegam, Enter confirma, 1 a 4 selecionam cartas, Escape fecha os painéis. O som é opcional e a preferência de redução de movimento é respeitada.

- `agent-arena.html`: entrada e contêiner dos canvases.
- `src/client.js`: interface, interação e sincronização.
- `src/scene.js`: diorama, enquadramento da câmera, agentes e efeitos das cartas.
- `src/game.mjs`: regras e estado autoritativo.
- `src/missions.mjs`: cartas, frentes, parâmetros e o banco de perguntas; **não é servido ao navegador**, e o snapshot só revela a alternativa correta e a explicação depois que a pessoa responde.
- `server.mjs`: servidor HTTP e stream de eventos, usando apenas a biblioteca padrão do Node.js.

O cliente reproduz as regras de jogada em `previewPlay` só para antecipar a leitura na arena. O servidor continua sendo quem aceita ou recusa; ao mudar uma regra em `game.mjs`, ajuste a prévia junto.

Salas e placares ficam na memória do servidor. Recarregar a página preserva o acesso na mesma aba. **Reiniciar o servidor encerra as salas.** Se hospedar atrás de um proxy, configure `PUBLIC_URL` com a URL acessível aos participantes.

## Verificação

```sh
npm test
```

Vinte e dois testes cobrem regras, limite e equilíbrio das guildas, autorização do admin, proteção dos parâmetros, relógio, pausa, conflito de checkout, frentes paralelas e o custo de integração, campanha completa, HTTP, stream de eventos, ações reais do cliente contra o servidor a concordância entre a prévia da carta e a decisão do servidor em 36 combinações, e o estudo em campo: o gabarito que não sai do servidor, o bônus e a aceleração do acerto, a explicação no erro, quem pode responder e a ordem das perguntas por guilda.

As telas foram conferidas em navegador real, em tamanho de computador e de celular: mapa, prévia das cartas, ciclo de vida dos agentes, worktree, harness, a visão de uma guilda com duas pessoas os dois desfechos da pergunta com o efeito de aceleração na barra da obra, e dois Construtores dividindo a mesma obra.

## Créditos

Modelos de Kay Lousberg:

- [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), CC0. Licença em `assets/models/CHARACTERS-LICENSE.txt`.
- [KayKit Medieval Hexagon](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0), CC0. Licença em `assets/models/BUILDINGS-LICENSE.txt`.
- Three.js 0.180.0, MIT. Licença em `assets/vendor/THREE-LICENSE.txt`.
- Lilita One e Nunito, SIL Open Font License. Licenças em `assets/fonts/`.
