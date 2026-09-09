# Agent Arena — A Cidadela dos Agentes

Jogo multiplayer em tempo real para acompanhar a apresentação *Orquestrando Agentes de IA*. Cada guilda comanda agentes numa arena compartilhada e sente na prática o que o material explica: contexto é finito, frentes paralelas conflitam quando dividem o mesmo checkout, revisão transforma trabalho em entrega, e permissões barram o que uma instrução sozinha não barra.

## Rodar

Requer Node.js 22 ou posterior. `dist/` não é versionado, então a primeira vez
pede um build:

```sh
npm install
npm run build
npm start
```

Depois disso, `npm start` sozinho basta enquanto `dist/` existir.

Abra `http://localhost:8080`. O terminal também mostra o endereço para os celulares na mesma rede. Para mudar a porta: `PORT=8081 npm start`.

Modelos, texturas, fontes e Three.js estão no projeto. Não há chamadas para CDNs; os aparelhos só precisam alcançar o servidor pela rede local. Uma rede de convidados que bloqueie comunicação entre dispositivos impede a entrada dos celulares.

## Como se joga

A arena tem três frentes — **Portal**, **Forja** e **Muralha** — e cada uma sobe até o nível 3. Vence a guilda com mais pontos quando o tempo acaba. Uma campanha jogada de qualquer jeito vale cerca de **1200**; combinando as jogadas certas, passa de **2700**. É essa distância que separa a guilda que entendeu a apresentação da que só empurrou cartas.

Toda guilda dispõe de **12 de contexto** (regenera 0,65/s) e **até 6 agentes em campo**, independentemente de quantas pessoas ela tenha. Esse é o ponto da dinâmica: o orçamento é do time, não da pessoa. Quem gasta sem combinar tira contexto do colega.

| Carta | Custo | Efeito |
| --- | --- | --- |
| Construtor | 2 / 3 / 4 | Custo por nível a construir (1 / 2 / 3). Sozinho leva 24 s. |
| Worktree | 2 | Abre um canteiro isolado na frente. Até 2 por frente, permanentes. Dois Construtores em canteiros próprios somam **+0,3** ao multiplicador da entrega. |
| Revisor | 2 / 3 / 4 | Custo por nível a entregar (1 / 2 / 3). Valida em 8 s, +3 s por falha, +5 s por frente extra. |
| Harness | 2 | Barra entrega sem revisão e comandos do caos naquela frente. Multiplica a entrega em **+0,3 / +0,6 / +1,0** conforme o nível, e aponta a próxima carta certa na placa. |

O preço é cobrado uma vez ao enviar a carta, conforme o nível que a frente está construindo. Avançar o progresso ou acertar a pergunta não aumenta esse preço nem cobra contexto adicional. As cartas mostram a faixa de preços das frentes disponíveis; ao mirar, a carta e a placa mostram o preço exato.

O ciclo é construir → revisar → entregar. Entrega revisada e sem falhas vale **100 pontos**; entrega sem revisão vale **40**. Se a frente tem Harness, a entrega sem revisão é bloqueada em vez de pontuar 40 — o bloqueio não consome contexto.

**O multiplicador da frente.** É aqui que combinar jogadas vira placar, em vez de só economizar segundos. Na entrega, a frente multiplica o que pagou:

| Situação da frente | Soma ao multiplicador |
| --- | --- |
| Harness ativo, entregando o nível 1 | +0,3 |
| Harness ativo, entregando o nível 2 | +0,6 |
| Harness ativo, entregando o nível 3 | +1,0 |
| Dois ou mais Construtores, cada um no seu canteiro | +0,3 |
| **Houve conflito de checkout neste nível** | **zera tudo: a entrega sai em 1×** |

Uma frente protegida desde o começo e construída em canteiros próprios entrega o nível 3 a **2,3×**: 230 pontos em vez de 100. A mesma frente, com um conflito no meio do caminho, paga 100 — e a revisão limpa as falhas, mas não devolve o multiplicador. O erro custa a recompensa daquele nível, nunca pontos já conquistados: o nível seguinte começa limpo.

O bônus da pergunta é pago duas vezes: **20 pontos na hora do acerto** e, na entrega, mais a parte que o multiplicador acrescenta. Acertar numa frente a 2× vale 40 no total. Quem estudou e organizou a operação ganha nas duas pontas.

**O Harness como painel de controle.** Numa frente protegida a placa diz qual é a próxima carta certa — *isolar antes de somar Construtores*, *revisar antes de entregar*. É a leitura literal do slide: o harness é quem conhece a operação e aplica a regra. Quem pagou pela proteção joga com o mapa à vista; quem não pagou decide no escuro.

**Estudo em campo.** Todo Construtor ou Revisor abre uma pergunta sobre o conteúdo da apresentação para quem enviou o agente — 39 perguntas em `src/content/questions.ts`, embaralhadas por guilda, cobrindo os três blocos do deck: conceitos (harness, workflows, multiagente), configuração (worktrees, subagentes, permissões, AGENTS.md, ADR) e o case do BuscaGames (arquitetura, incidente, contratos operacionais e checklist). Acertar corta **metade do tempo que falta** na tarefa e soma **20 pontos**; errar não tira nada e revela a explicação. **A pergunta tem relógio próprio: 25 s, contados de quando ela abre.** Ela não morre com a tarefa — um Revisor leva 8 s e três Construtores em canteiros fecham a obra em 8 s, e ninguém lê enunciado e três alternativas nesse tempo. Enquanto o agente ainda trabalha, acertar acelera a obra; depois que ele volta, o acerto ainda vale os 20 pontos e o multiplicador, mas não há mais o que adiantar. Responder cedo continua compensando, sem que ler até o fim seja impossível.

A janela ocupa o lugar do baralho enquanto o agente trabalha e se recolhe sozinha para uma chamada compacta quando ele volta, liberando as cartas. O botão **Baralho** faz o mesmo a qualquer momento, sem encerrar a pergunta.

Isso existe porque, sem ele, bastava alocar agentes depressa para pontuar. Com ele, a guilda que entende worktree, harness e ADR constrói mais rápido e pontua mais. Uma campanha completa abre uma pergunta por agente enviado — quem paraleliza responde mais, e cada acerto vale mais na frente multiplicada. Como o banco tem 39 e a ordem é sorteada por guilda, cada time vê um recorte diferente — nenhum consegue copiar a resposta do vizinho, e a mesma turma pode jogar de novo sem repetir.

**Frentes paralelas e o checkout compartilhado.** Isolamento é por diretório, não por frente — é assim que worktree funciona no repositório. A guilda tem **um** checkout principal e cada Worktree abre mais um canteiro naquela frente. Um Construtor ocupa um canteiro livre; se não houver, cai no checkout principal.

- Cada Construtor isolado soma uma frente de trabalho: **1 leva 24 s, 2 levam 12 s, 3 levam 8 s** na mesma obra.
- Dois agentes no mesmo diretório **rendem metade cada**, ganham falhas e **zeram o multiplicador da entrega** — juntos produzem o de um só, gastando o dobro de contexto. Medido: 24,5 s de obra nos dois casos, 4 de contexto em vez de 2, e a revisão sobe de 8 s para 19 s.
- Abrir uma Worktree durante um conflito **tira um agente do diretório compartilhado e encerra o conflito**, como aconteceria de verdade.

O preço é a convergência: cada frente extra soma **5 s de integração** na revisão, e o custo dos agentes cresce com o nível. Seis Construtores no nível 1 gastam os 12 de uma barra inteira; no nível 3, só três já gastam esses 12. Os canteiros são pagos à parte. Paralelismo compra latência pagando coordenação e tokens, que é o ponto do slide sobre custo.

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

O terreno da cidadela tem contorno recortado, base rochosa em camadas, cascatas, margens de rio, caminhos de pedra e vegetação nas bordas. As três frentes têm praças próprias; as bandeiras usam a cor da guilda observada. O cenário estático é agrupado por material, usando o utilitário Three.js já disponível localmente, para reduzir as chamadas de desenho sem adicionar texturas ou downloads. Essa camada visual fica em `scene/terrain.ts`; as posições das frentes e rotas dos agentes continuam em `Island`.

O baralho usa retratos em pose dos próprios modelos, cartas inclinadas e seleção com elevação e abertura da mão. Toque, arrasto e foco acompanham as cartas; com movimento reduzido, a seleção muda de estado sem animação. Os agentes trabalham voltados ao centro da construção, inclusive nos postos laterais.

Na batalha o mapa ocupa a largura inteira e os painéis ficam nas sobras laterais que a ilha na diagonal não alcança. Cada frente carrega o próprio estado no terreno: anel de progresso, andaime que cresce com a obra, uma cerca verde por canteiro aberto, cúpula do Harness e cristais vermelhos de falha. Vários Construtores na mesma obra ganham postos próprios.

A placa de cada frente fica pequena em repouso — nome, nível e uma barra fina, com as insígnias reduzidas a ícones — e só abre com o texto completo quando há uma carta na mão, quando a frente está escolhida ou sob o cursor. Três placas grandes cobriam justamente o tabuleiro que elas descrevem. As placas também desviam do botão **Entregar**, que fica no chão da própria construção: primeiro para os lados e, quando não há largura (celular), subindo acima dele. Ao escolher uma carta, cada frente mostra antes o que aconteceria ali — dourado libera, laranja avisa do conflito, vermelho recusa e diz o motivo. Os agentes saem do acampamento da guilda, atravessam a ponte e trabalham na frente, com o nome de quem os enviou sobre eles.

Use toque ou mouse. No teclado: Tab/Shift+Tab navegam, Enter confirma, 1 a 4 selecionam cartas, Escape fecha os painéis. O som é opcional e a preferência de redução de movimento é respeitada.

### Código

O projeto é TypeScript, organizado em classes. As fontes ficam em `src/` e o
build vai para `dist/`, que é ignorado pelo Git. Para editar:

```sh
npm install     # só na primeira vez
npm run build   # compila src/ para dist/
npm run check   # tipos, sem gerar arquivos
npm test        # compila e roda os 41 testes
```

```
src/
  shared/protocol.ts   O contrato entre servidor e navegador. Só interfaces:
                       o arquivo compilado não carrega valor nenhum.
  content/             Cartas, frentes, parâmetros e o banco de perguntas.
  game/                As regras. Site, Job, Team, Room e Arena.
  server.ts            HTTP, stream de eventos e arquivos estáticos.
  client/
    app.ts             AgentArena: o que atravessa telas.
    loop.ts            O laço de render, separado da entrada do programa.
    painter.ts         As primitivas de desenho 2D.
    controls.ts        Áreas clicáveis, foco do teclado e espelho acessível.
    session.ts         Estado publicado, chaves, stream e chamadas de API.
    rules.ts           Prévia da jogada e projeção da obra.
    screens/           Home, Lobby, Battle, Results e os painéis sobrepostos.
    battle/            Placas das frentes, janela do estudo e painéis laterais.
    scene/             World, CameraRig, Island, SiteZone, AgentCrew.
```

**O gabarito não é servido.** O servidor publica apenas `agent-arena.html`,
`assets/` e `dist/client/`. `dist/content/` e `dist/game/` — onde vivem as
respostas e as regras — respondem 404, e um teste percorre essa lista.

A divisão que mais importa é `shared/protocol.ts`: antes dela o cliente lia
`state.teams[0].jobs[0].question.answer` sem garantia de que o campo existia.
Agora servidor e navegador compartilham a mesma definição do que trafega.

O cliente reproduz as regras de jogada em `client/rules.ts` (`PlayPreview`) só para antecipar a leitura na arena. O servidor continua sendo quem aceita ou recusa; ao mudar uma regra em `game/`, ajuste a prévia junto — um teste cruza as duas decisões em 36 combinações e falha se elas divergirem.

Salas e placares ficam na memória do servidor. Recarregar a página preserva o acesso na mesma aba. **Reiniciar o servidor encerra as salas.** Se hospedar atrás de um proxy, configure `PUBLIC_URL` com a URL acessível aos participantes.

## Verificação

```sh
npm test
```

Quarenta e um testes cobrem regras, limite e equilíbrio das guildas, autorização do admin, proteção dos parâmetros, relógio, pausa, conflito de checkout, frentes paralelas e o custo de integração, campanha completa, HTTP, stream de eventos, ações reais do cliente contra o servidor a concordância entre a prévia da carta e a decisão do servidor em 36 combinações, o multiplicador da frente em 48 combinações de placa contra servidor, o conflito que zera o bônus, a ordem que o Harness recomenda, a janela da pergunta que sobrevive ao agente e não encolhe com o paralelismo, e o estudo em campo: o gabarito que não sai do servidor, o bônus e a aceleração do acerto, a explicação no erro, quem pode responder e a ordem das perguntas por guilda.

As telas foram conferidas em navegador real, em tamanho de computador e de celular: mapa, prévia das cartas, ciclo de vida dos agentes, worktree, harness, a visão de uma guilda com duas pessoas os dois desfechos da pergunta com o efeito de aceleração na barra da obra, e dois Construtores dividindo a mesma obra.

## Créditos

Modelos de Kay Lousberg:

- [KayKit Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0), CC0. Licença em `assets/models/CHARACTERS-LICENSE.txt`.
- [KayKit Medieval Hexagon](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0), CC0. Licença em `assets/models/BUILDINGS-LICENSE.txt`.
- Three.js 0.180.0, MIT. Licença em `assets/vendor/THREE-LICENSE.txt`.
- Lilita One e Nunito, SIL Open Font License. Licenças em `assets/fonts/`.
