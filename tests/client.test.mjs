import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../dist/server.js';
import { QUESTIONS } from '../dist/content/questions.js';
import { STORY, STUDY } from '../dist/content/story.js';
import { installBrowser, makeClient } from './harness.mjs';

// Exercita as classes reais do cliente contra HTTP. Só a superfície do
// navegador é substituída; regras, pedidos e transições de estado são reais.
let client;
function serve(t) {
 const {server,arena}=createServer();
 t.after(()=>{server.closeAllConnections();server.close();});
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>{
  const base=`http://127.0.0.1:${server.address().port}`;
  installBrowser(base);
  client=makeClient;
  resolve({server,arena,base});
 }));
}

test('client: tocar carta e construção mobiliza agente; entrega revisada atualiza o placar dos celulares',async t=>{
 const {arena}=await serve(t);let now=Date.now();arena.now=()=>now;
 const admin=await client(),ana=await client(),bia=await client();
 admin.fields.participants=4;admin.fields.teamSize=2;await admin.create();const code=admin.state().code;
 await ana.lookup(code);ana.fields.name='Ana';ana.team(0);await ana.join();
 await bia.lookup(code);bia.fields.name='Bia';bia.team(1);await bia.join();await admin.action('start');await ana.refresh();await bia.refresh();
 assert.ok(!ana.draw().some(c=>/vote|reveal/.test(c.id)));assert.equal(ana.draw().find(c=>c.id==='deliver').disabled,true);
 await ana.click('card-builder');await ana.click('site-0');assert.equal(ana.state().teams[0].jobs.length,1);assert.equal(ana.state().teams[0].energy,10);
 now+=STORY.buildSeconds*1000;arena.tick();await ana.refresh();await ana.click('card-reviewer');await ana.click('site-0');now+=STORY.reviewSeconds*1000;arena.tick();await ana.refresh();await ana.click('deliver');
 assert.equal(ana.state().teams[0].score,100);await bia.refresh();assert.equal(bia.state().teams[0].score,100);assert.equal(bia.state().teams[1].score,0);assert.equal(ana.state().phase,'playing');
});

test('client: arrastar a carta e soltar no alvo cria uma tarefa, sem botão de confirmar resposta',async t=>{
 await serve(t);const c=await client();
 await c.create(true);const controls=c.draw(),card=controls.find(c=>c.id==='card-builder'),site=controls.find(c=>c.id==='site-2');
 const event=(x,y)=>({clientX:x,clientY:y,pointerId:1,preventDefault:()=>{}});
 c.pointer('pointerdown',event(card.x+card.w/2,card.y+card.h/2));c.draw();c.pointer('pointermove',event(site.x+site.w/2,site.y+site.h/2));await c.pointer('pointerup',event(site.x+site.w/2,site.y+site.h/2));
 assert.equal(c.state().teams[0].jobs.length,1);assert.equal(c.state().teams[0].jobs[0].siteId,2);assert.equal(c.state().teams[0].jobs[0].cardId,'builder');assert.equal(c.state().phase,'playing');
});

// A prévia na arena repete as regras de game.mjs para mostrar o efeito da carta
// antes da jogada. Este teste cruza as duas: se uma regra do servidor mudar sem
// a prévia acompanhar, a interface passa a prometer o que o servidor recusa.
test('client: a prévia da carta na frente concorda com a decisão do servidor',async t=>{
 const {arena}=await serve(t);let now=Date.now();arena.now=()=>now;
 const advance=async(c,seconds)=>{now+=seconds*1000;arena.tick();await c.refresh();};
 // Cada Construtor ou Revisor abre uma pergunta que toma o lugar do baralho.
 // Aqui ela é dispensada pelo mesmo botão que a pessoa usaria.
 const act=async(c,cardId,siteId)=>{await c.click('card-'+cardId);await c.click('site-'+siteId);if(c.draw().some(k=>k.id==='quiz-later'))await c.click('quiz-later');};
 const states={
  'frente intacta':async()=>{},
  'construtor em campo':async c=>{await act(c,'builder',0);},
  'obra pronta':async c=>{await act(c,'builder',0);await advance(c,STORY.buildSeconds);},
  'obra revisada':async c=>{await act(c,'builder',0);await advance(c,STORY.buildSeconds);await act(c,'reviewer',0);await advance(c,STORY.reviewSeconds);},
  'frente isolada':async c=>{await act(c,'worktree',0);},
  'frente protegida':async c=>{await act(c,'harness',0);},
  'checkout ocupado por outra frente':async c=>{await act(c,'builder',1);},
  'seis agentes ocupados':async c=>{for(const s of [0,1,2,0,1,2])await act(c,'builder',s);await advance(c,2/STORY.regen);},
  'contexto no limite':async c=>{await act(c,'builder',1);await act(c,'builder',2);await act(c,'harness',1);await act(c,'worktree',2);await act(c,'harness',0);await act(c,'worktree',0);},
 };
 const checked=[];
 for(const [label,setup] of Object.entries(states))
  for(const cardId of ['builder','worktree','reviewer','harness']){
   const c=await client();
   await c.create(true);
   await setup(c);
   const preview=c.preview(cardId,0);
   // Pelo caminho da interface: carta apagada no baralho e recusa do servidor
   // são as duas formas de "não dá para jogar" que a pessoa enxerga.
   const deck=c.draw().find(k=>k.id==='card-'+cardId);
   let accepted=!deck.disabled;
   if(accepted){await c.click('card-'+cardId);await c.click('site-0');accepted=!c.toast()?.error;}
   assert.equal(preview.ok,accepted,`${label} · ${cardId}: prévia disse ${preview.ok?'libera':'recusa'} ("${preview.hint}") e o servidor ${accepted?'aceitou':'recusou'}`);
   checked.push(accepted);
  }
 assert.equal(checked.length,36);
 // Sem isto o teste passaria mesmo que tudo fosse liberado ou tudo recusado.
 const refused=checked.filter(ok=>!ok).length;
 assert.ok(refused>=10&&refused<=26,`matriz pouco variada: ${refused} recusas em 36`);
});

// A janela do estudo é o único caminho para o bônus, então ela precisa abrir
// sozinha, aceitar teclado, poder sair da frente do baralho e revelar o porquê.
test('client: a pergunta abre com o agente, some do baralho e devolve o bônus',async t=>{
 const {arena}=await serve(t);let now=Date.now();arena.now=()=>now;
 const c=await client();
 await c.create(true);
 assert.ok(!c.draw().some(k=>k.id.startsWith('quiz-')),'sem agente em campo não há pergunta');
 await c.click('card-builder');await c.click('site-0');
 const open=c.draw();
 assert.equal(open.filter(k=>/^quiz-\d$/.test(k.id)).length,3,'três alternativas');
 assert.ok(!open.some(k=>k.id.startsWith('card-')),'o baralho sai de cena enquanto a pergunta está aberta');

 // O baralho volta pelo botão, e a pergunta continua viva e cronometrada.
 await c.click('quiz-later');
 const later=c.draw();
 assert.ok(later.some(k=>k.id.startsWith('card-')),'o baralho volta');
 assert.ok(later.some(k=>k.id==='quiz-open'),'a chamada da pergunta continua à vista');
 await c.click('quiz-open');

 const job=c.state().teams[0].jobs[0];
 const question=job.question;
 assert.equal(question.answer,null,'o cliente não recebe a resposta certa antes de responder');
 assert.equal(question.why,null);
 // O teste consulta o gabarito no servidor; o que importa é que o cliente não o
 // recebeu, o que já foi verificado acima.
 const correct=QUESTIONS.find(q=>q.id===question.id).answer;

 const before=c.state().teams[0].jobs[0].endsAt;
 await c.click('quiz-'+correct);
 const team=c.state().teams[0];
 assert.equal(team.score,c.state().study.bonus,'o acerto soma o bônus');
 assert.ok(team.jobs[0].endsAt<before,'o acerto acelera o agente');
 const revealed=c.draw();
 assert.ok(revealed.some(k=>k.id==='quiz-continue'),'a explicação fica com saída própria');
 await c.click('quiz-continue');
 assert.ok(c.draw().some(k=>k.id.startsWith('card-')),'depois da explicação o baralho volta');
});

// A barra da obra é projeção do mesmo acúmulo que o servidor faz. Somar uma
// barra por agente, como no modelo antigo, enchia a barra antes da hora e o
// agente continuava em campo depois dela cheia — mais visível após um acerto,
// que encurta o relógio da tarefa sem mover o startedAt.
test('client: a barra da obra nunca corre na frente do servidor, nem depois do boost',async t=>{
 const {arena}=await serve(t);let now=Date.now();arena.now=()=>now;
 const c=await client();
 await c.create(true);
 await c.click('card-builder');await c.click('site-0');
 const near=(label,tolerance=0.5)=>{
  const drawn=c.progress(0),real=c.state().teams[0].sites[0].built;
  assert.ok(Math.abs(drawn-real)<tolerance,`${label}: barra ${drawn.toFixed(1)}% contra ${real.toFixed(1)}% no servidor`);
  return drawn;
 };
 near('logo após mobilizar');

 // Metade da obra corrida: a barra acompanha, sem dobrar o ritmo.
 now+=STORY.buildSeconds*500;arena.tick();await c.refresh();
 const half=near('na metade da obra');
 assert.ok(half>40&&half<60,`na metade deveria estar perto de 50%, veio ${half.toFixed(1)}%`);

 // O acerto empurra o trabalho, e a barra continua abaixo de 100 com o agente em campo.
 const job=c.state().teams[0].jobs[0];
 c.draw();// um quadro para a janela terminar de entrar, como acontece na tela
 await c.click('quiz-'+QUESTIONS.find(q=>q.id===job.question.id).answer);
 assert.equal(c.state().teams[0].jobs.length,1,'o agente ainda está na obra');
 const boosted=near('logo após o acerto');
 assert.ok(boosted<100,`a barra não pode encher com o agente ainda em campo: ${boosted.toFixed(1)}%`);
 assert.ok(boosted>half,'o acerto precisa adiantar a obra');

 // E ela só chega a 100 no instante em que o agente sai.
 const left=c.state().teams[0].jobs[0].endsAt-c.state().elapsed;
 now+=Math.ceil(left*1000)-500;arena.tick();await c.refresh();
 assert.equal(c.state().teams[0].jobs.length,1,'ainda falta um pedaço');
 assert.ok(c.progress(0)<100,'a barra ainda não fechou');
 now+=1000;arena.tick();await c.refresh();
 assert.equal(c.state().teams[0].jobs.length,0,'o agente sai quando a obra fecha');
 assert.equal(c.progress(0),100);
});

test('client: preço, disponibilidade e cobrança concordam nos três níveis',async t=>{
 const {arena}=await serve(t);const now=Date.now();arena.now=()=>now;
 for(let level=0;level<3;level++)for(const cardId of ['builder','reviewer','worktree','harness'])for(const affordable of [false,true]) {
  const c=await client();await c.create(true);
  const room=arena.rooms.get(c.state().code),team=room.teams[0];
  const cost=cardId==='builder'||cardId==='reviewer'?2+level:2;
  team.sites.forEach(site=>site.level=level);
  if(cardId==='reviewer')team.sites[0].built=100;
  team.energy=affordable?cost:cost-1;
  await c.refresh();
  const preview=c.preview(cardId,0);
  assert.equal(preview.cost,cost);assert.equal(preview.ok,affordable);
  assert.equal(c.draw().find(k=>k.id==='card-'+cardId).disabled,!affordable);
  if(affordable) {
   await c.click('card-'+cardId);await c.click('site-0');
   assert.equal(team.energy,0,`${cardId} no nível ${level+1}: cobra o preço exibido`);
  }
 }
});

test('client: frente cara não bloqueia carta que pode ser usada numa frente mais barata',async t=>{
 const {arena}=await serve(t);const now=Date.now();arena.now=()=>now;const c=await client();await c.create(true);
 const room=arena.rooms.get(c.state().code),team=room.teams[0];
 team.sites[0].level=2;team.energy=2;
 await c.refresh();
 assert.equal(c.preview('builder',0).cost,4);assert.equal(c.preview('builder',0).ok,false);
 assert.equal(c.preview('builder',1).cost,2);assert.equal(c.preview('builder',1).ok,true);
 assert.equal(c.draw().find(k=>k.id==='card-builder').disabled,false);
 await c.click('card-builder');await c.click('site-0');
 assert.equal(team.jobs.length,0,'a frente cara recusa');assert.ok(team.energy>=2,'a recusa não consome contexto');
 await c.click('card-builder');await c.click('site-1');
 assert.equal(team.jobs.length,1);assert.equal(team.jobs[0].siteId,1);
});

// A conta do multiplicador vive duas vezes: em game/site.ts e em client/rules.ts.
// Se uma mudar sozinha, a placa promete um número e o servidor paga outro.
test('client: o valor da entrega na placa é o que o servidor paga',async t=>{
 const {arena}=await serve(t);const now=Date.now();arena.now=()=>now;
 const combinacoes=[];
 for(const nivel of [0,1,2])for(const harness of [false,true])for(const contribuintes of [1,2])for(const conflito of [false,true])for(const acertos of [0,1]){
  const c=await client();await c.create(true);
  const room=arena.rooms.get(c.state().code),site=room.teams[0].sites[0];
  site.level=nivel;site.harness=harness;site.contributors=contribuintes;
  site.conflicted=conflito;site.studyBonus=acertos*20;
  site.built=100;site.reviewed=true;site.faults=0;
  await c.refresh();
  const previsto=c.value(0);
  const antes=c.state().teams[0].score;
  await c.click('deliver');
  const pago=c.state().teams[0].score-antes;
  assert.equal(previsto,pago,`nível ${nivel+1}, harness ${harness}, ${contribuintes} contribuintes, conflito ${conflito}, ${acertos} acerto(s): placa ${previsto} vs servidor ${pago}`);
  combinacoes.push(pago);
 }
 assert.equal(combinacoes.length,48);
 assert.ok(new Set(combinacoes).size>=6,'a matriz precisa variar, senão o teste passa com tudo igual');
});

// O Harness é o painel de controle da frente: ele aponta a jogada certa, na
// ordem que a apresentação ensina — isolar antes de somar, revisar antes de entregar.
test('client: a frente protegida aponta a próxima carta na ordem certa',async t=>{
 const {arena}=await serve(t);const now=Date.now();arena.now=()=>now;
 const c=await client();await c.create(true);
 const room=arena.rooms.get(c.state().code),team=room.teams[0],site=team.sites[0];

 await c.refresh();
 assert.equal(c.nextMove(0),'builder','obra vazia pede Construtor');

 await c.click('card-builder');await c.click('site-0');
 if(c.draw().some(k=>k.id==='quiz-later'))await c.click('quiz-later');
 assert.equal(c.nextMove(0),'worktree','com um Construtor no checkout, isole antes de somar outro');

 team.energy=12;await c.refresh();
 await c.click('card-worktree');await c.click('site-0');
 assert.equal(c.nextMove(0),'builder','com canteiro livre, o segundo Construtor entra sem conflito');

 team.energy=12;await c.refresh();
 await c.click('card-builder');await c.click('site-0');
 if(c.draw().some(k=>k.id==='quiz-later'))await c.click('quiz-later');
 assert.equal(c.nextMove(0),'worktree','os dois canteiros ocupados: abra o segundo');

 site.built=100;team.jobs=[];team.energy=12;await c.refresh();
 assert.equal(c.nextMove(0),'reviewer','obra pronta pede Revisor');
 site.reviewed=true;await c.refresh();
 assert.equal(c.nextMove(0),'deliver','obra revisada pede a entrega');
 site.level=3;await c.refresh();
 assert.equal(c.nextMove(0),null,'frente concluída não pede nada');
});

// A janela se recolhe sozinha quando o agente volta, para liberar o baralho.
// Isso precisa acontecer uma vez, na virada: recolher a cada quadro impedia a
// pessoa de reabrir a pergunta que ainda tinha 16 s de vida.
test('client: a pergunta se recolhe quando o agente volta e reabre quando a pessoa pede',async t=>{
 const {arena}=await serve(t);let now=Date.now();arena.now=()=>now;
 const c=await client();await c.create(true);
 const room=arena.rooms.get(c.state().code),team=room.teams[0];

 await c.click('card-builder');await c.click('site-0');
 assert.ok(c.draw().some(k=>/^quiz-\d$/.test(k.id)),'a pergunta abre sobre o baralho');
 assert.ok(!c.draw().some(k=>k.id.startsWith('card-')),'e o baralho sai de cena');

 // A obra fecha; o agente vai embora e a pergunta fica.
 now+=STORY.buildSeconds*1000;arena.tick();await c.refresh();
 assert.equal(team.jobs.length,0,'o agente voltou');
 assert.equal(team.quizzes.length,1,'a pergunta continua aberta');
 const recolhida=c.draw();
 assert.ok(recolhida.some(k=>k.id.startsWith('card-')),'o baralho volta sozinho');
 assert.ok(recolhida.some(k=>k.id==='quiz-open'),'e a chamada da pergunta aparece');

 // Reabrir tem de funcionar, e continuar funcionando quadro após quadro.
 await c.click('quiz-open');
 for(let quadro=0;quadro<5;quadro++)
  assert.ok(c.draw().some(k=>/^quiz-\d$/.test(k.id)),`quadro ${quadro}: a janela precisa continuar aberta`);

 // Responder depois paga os pontos, sem obra para acelerar.
 const job=team.quizzes[0];
 const certa=QUESTIONS.find(q=>q.id===job.questionId).answer;
 await c.click('quiz-'+certa);
 assert.equal(team.score,c.state().study.bonus);
 assert.equal(team.sites[0].studyBonus,c.state().study.bonus);
 assert.equal(team.quizzes.length,0);
});

test('client: a janela da pergunta não encolhe com o paralelismo',async t=>{
 const {arena}=await serve(t);let now=Date.now();arena.now=()=>now;
 const c=await client();await c.create(true);
 const room=arena.rooms.get(c.state().code),team=room.teams[0];
 await c.click('card-worktree');await c.click('site-0');
 team.energy=STORY.maxEnergy;await c.refresh();
 // A primeira pergunta fica em espera; a segunda entra na fila atrás dela.
 const dispensa=async()=>{if(c.draw().some(k=>k.id==='quiz-later'))await c.click('quiz-later');};
 await c.click('card-builder');await c.click('site-0');await dispensa();
 await c.click('card-builder');await c.click('site-0');await dispensa();
 // Dois Construtores isolados fecham a obra em metade do tempo.
 const janelas=team.jobs.map(j=>j.questionExpiresAt-room.elapsed);
 assert.ok(janelas.every(j=>Math.abs(j-STUDY.windowSeconds)<0.01),`janelas ${janelas} deveriam ser de ${STUDY.windowSeconds}s`);
 now+=(STORY.buildSeconds/2)*1000;arena.tick();await c.refresh();
 assert.equal(team.sites[0].built,100,'a obra fechou em metade do tempo');
 assert.equal(team.quizzes.length,2,'as duas perguntas continuam abertas');
 assert.ok(team.quizzes.every(j=>j.questionExpiresAt-room.elapsed>10),'com folga para ler');
});
