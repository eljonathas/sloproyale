import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../dist/game/arena.js';
import { QUESTIONS } from '../dist/content/questions.js';
import { STORY, STUDY } from '../dist/content/story.js';
const INTEGRATE=STORY.integrationSeconds;
const BUILD=STORY.buildSeconds,REVIEW=STORY.reviewSeconds;
import { createServer } from '../dist/server.js';

function fixture({participants=4,teamSize=2,duration=180,practice=false}={}){
 let now=1000;const arena=new Arena({now:()=>now}),room=arena.create({participants,teamSize,duration,practice});
 const players=Array.from({length:practice?1:participants},(_,i)=>arena.join(room,{name:'Pessoa '+i,teamId:i%room.teams.length}));
 arena.action(room,room.admin,'start');
 return {arena,room,players,team:room.teams[0],wait:seconds=>{now+=seconds*1000;arena.tick();},jump:seconds=>now+=seconds*1000,play:(cardId,siteId=0,p=players[0])=>arena.action(room,p.key,'play',{cardId,siteId}),deliver:(siteId=0)=>arena.action(room,players[0].key,'deliver',{siteId}),answer:(jobId,option,p=players[0])=>arena.action(room,p.key,'answer',{jobId,option}),ask:(job)=>QUESTIONS.find(q=>q.id===job.questionId)};
}
test('equilibra vagas e recursos entre guildas de tamanhos diferentes',()=>{
 const arena=new Arena();for(let participants=4;participants<=80;participants++){const room=arena.create({participants,teamSize:5});assert.equal(room.teams.reduce((n,t)=>n+t.capacity,0),participants);assert.ok(Math.max(...room.teams.map(t=>t.capacity))-Math.min(...room.teams.map(t=>t.capacity))<=1);assert.ok(room.teams.every(t=>t.energy===12));}assert.throws(()=>arena.create({participants:80,teamSize:2}),/16 times/);
});
test('lobby: vagas, nomes, troca e autorização do orquestrador',()=>{
 const arena=new Arena(),room=arena.create({participants:4,teamSize:2});const a=arena.join(room,{name:'Ana',teamId:0});arena.join(room,{name:'Bia',teamId:0});assert.throws(()=>arena.join(room,{name:'Caio',teamId:0}),/cheio/);assert.throws(()=>arena.join(room,{name:'ana',teamId:1}),/já está/);assert.throws(()=>arena.action(room,a.key,'start'),/orquestrador/);assert.throws(()=>arena.action(room,room.admin,'start'),/pelo menos/);arena.join(room,{name:'Ana',teamId:1},a.key);arena.action(room,room.admin,'start');assert.throws(()=>arena.join(room,{name:'Caio',teamId:1}),/já começou/);
});
test('construção e revisão levam tempo; só a entrega gera pontos e não pode ser repetida',()=>{
 const f=fixture();f.play('builder');assert.equal(f.team.energy,10);assert.equal(f.team.jobs.length,1);assert.equal(f.team.score,0);f.wait(BUILD-1);assert.ok(f.team.sites[0].built>90&&f.team.sites[0].built<100,'a obra avança continuamente');f.wait(1);assert.equal(f.team.sites[0].built,100);assert.equal(f.team.jobs.length,0);f.play('reviewer');f.wait(REVIEW);assert.equal(f.team.sites[0].reviewed,true);assert.equal(f.team.score,0);f.deliver();assert.equal(f.team.score,100);assert.equal(f.team.sites[0].level,1);assert.throws(()=>f.deliver(),/não terminou/);assert.equal(f.team.score,100);
});
test('ações de pessoas do mesmo time compartilham orçamento; concorrência no checkout causa conflito real',()=>{
 const f=fixture();f.play('builder',0,f.players[0]);f.play('builder',1,f.players[2]);assert.equal(f.team.energy,8);assert.equal(f.team.jobs.length,2);assert.ok(f.team.jobs.every(j=>j.conflict));f.wait(BUILD);
 // Dividindo o mesmo diretório, os dois juntos rendem o de um agente sozinho.
 assert.equal(Math.round(f.team.sites[0].built),50);assert.equal(Math.round(f.team.sites[1].built),50);assert.ok(f.team.stats.conflicts>0);assert.equal(f.room.teams[1].energy,12);
});
test('canteiros somam frentes na mesma obra; sem canteiro livre os agentes voltam ao mesmo checkout',()=>{
 // Um canteiro numa frente e o checkout principal na outra: duas obras em paralelo.
 const f=fixture();f.play('worktree',0);f.play('builder',0);f.play('builder',1);assert.ok(f.team.jobs.every(j=>!j.conflict));f.wait(BUILD);assert.equal(f.team.sites[0].built,100);assert.equal(f.team.sites[1].built,100);

 // Dois Construtores na MESMA frente, cada um no seu diretório: metade do tempo.
 const g=fixture();g.play('worktree',0);g.play('builder',0);g.play('builder',0);
 assert.ok(g.team.jobs.every(j=>!j.conflict));assert.equal(g.team.sites[0].contributors,2);
 g.wait(BUILD/2);assert.equal(g.team.sites[0].built,100,'duas frentes fecham em metade do tempo');

 // O terceiro não tem para onde ir: o checkout principal é um só.
 const h=fixture();h.play('worktree',0);h.play('builder',0);h.play('builder',0);h.play('builder',0);
 assert.equal(h.team.jobs.filter(j=>j.conflict).length,2,'só os dois do checkout principal conflitam');
 // Abrir outro canteiro tira um deles do diretório compartilhado e encerra o conflito.
 h.wait(3);h.play('worktree',0);
 assert.ok(h.team.jobs.every(j=>!j.conflict),'isolar durante o conflito resolve o conflito');
});

test('a revisão cobra a convergência das frentes paralelas',()=>{
 const f=fixture();f.play('worktree',0);f.play('builder',0);f.play('builder',0);
 f.wait(BUILD/2);assert.equal(f.team.sites[0].built,100);
 f.play('reviewer',0);
 assert.equal(Math.round(f.team.jobs[0].endsAt-f.room.elapsed),REVIEW+INTEGRATE,'duas branches custam a integração');
 f.wait(REVIEW+INTEGRATE);f.deliver(0);
 assert.equal(f.team.sites[0].contributors,0,'o nível seguinte começa do zero');
 f.play('builder',0);f.wait(BUILD);f.play('reviewer',0);
 assert.equal(Math.round(f.team.jobs[0].endsAt-f.room.elapsed),REVIEW,'uma frente só não paga integração');
});
test('contexto e seis agentes limitam ações sem aceitar pontos ou time enviados pelo cliente',()=>{
 const f=fixture();
 for(let i=0;i<STORY.maxAgents;i++)f.play('builder',i%3);
 assert.equal(f.team.jobs.length,6);assert.equal(f.team.energy,0);
 assert.throws(()=>f.play('builder',1),/Contexto insuficiente/);
 f.wait(2/STORY.regen);
 assert.throws(()=>f.play('builder',1),/6 agentes/);
 assert.ok(Math.abs(f.team.energy-2)<1e-8,'recusa não cobra contexto');
 assert.throws(()=>f.arena.action(f.room,'fake','play',{cardId:'builder',siteId:1}),/Entre/);
 assert.throws(()=>f.arena.action(f.room,f.players[0].key,'finish'),/orquestrador/);
 assert.equal(f.team.score,0);assert.throws(()=>f.play('reviewer',2),/Construa/);
});
test('harness bloqueia entrega não revisada; sem harness a entrega vale apenas 40',()=>{
 const f=fixture();f.play('harness');f.play('builder');f.wait(BUILD);const energy=f.team.energy;f.deliver();assert.equal(f.team.score,0);assert.equal(f.team.sites[0].level,0);assert.equal(f.team.stats.blocked,1);assert.equal(f.team.energy,energy);f.play('reviewer');f.wait(REVIEW);f.deliver();assert.equal(f.team.score,Math.round(STORY.scoreSafe*(1+STORY.harnessBonus[0])),'a frente protegida entrega com multiplicador');
 const g=fixture();g.play('builder');g.wait(BUILD);g.deliver();assert.equal(g.team.score,40);assert.equal(g.team.stats.unsafe,1);
});
test('tempestades têm o mesmo horário; harness protege e worktree não é sandbox',()=>{
 const f=fixture();f.play('harness',0);f.play('worktree',1);f.wait(81);assert.equal(f.room.storms,1);assert.equal(f.team.sites[0].faults,0);assert.equal(f.room.teams[1].sites[0].faults,1);f.wait(54);assert.equal(f.room.storms,2);assert.equal(f.team.sites[1].faults,1);
});
test('pausa congela tarefas, contexto e tempestades; retomar conserva o tempo restante',()=>{
 const f=fixture();f.play('builder');f.wait(4);f.arena.action(f.room,f.room.admin,'pause');const energy=f.team.energy;f.wait(300);assert.equal(f.room.elapsed,4);assert.equal(f.team.energy,energy);assert.equal(f.team.jobs.length,1);assert.throws(()=>f.play('harness'),/pausada/);f.arena.action(f.room,f.room.admin,'pause');f.wait(BUILD-4);assert.equal(f.team.sites[0].built,100);assert.equal(f.room.elapsed,BUILD);
});
test('ticks atrasados preservam a ordem: tempestade antes da revisão é corrigida',()=>{
 const f=fixture();f.play('builder');f.wait(78);f.play('reviewer');f.wait(12);assert.equal(f.room.storms,1);assert.equal(f.team.sites[0].faults,0);assert.equal(f.team.sites[0].reviewed,true);assert.equal(f.team.log[0].title,'Portal: revisão concluída');
});
test('prazo encerra partida, impede ação tardia e reconhece empate sem pontos fictícios',()=>{
 const f=fixture();f.jump(181);assert.throws(()=>f.play('builder'),/terminou/);assert.equal(f.room.phase,'finished');assert.deepEqual(f.arena.snapshot(f.room,'').winners,[0,1]);assert.ok(f.room.teams.every(t=>t.score===0));
});
test('uma campanha completa reconstrói nove níveis e paga o multiplicador de cada nível',()=>{
 // A campanha usa a mecânica nova: um canteiro por frente e dois Construtores
 // em paralelo, pagando a integração na revisão.
 const f=fixture({practice:true,duration:420});
 for(let site=0;site<3;site++){f.play('harness',site);f.play('worktree',site);f.wait(10);}
 for(let site=0;site<3;site++)
  for(let level=0;level<3;level++){
   f.play('builder',site);f.play('builder',site);f.wait(BUILD/2);
   f.play('reviewer',site);f.wait(REVIEW+INTEGRATE);f.deliver(site);
  }
 assert.equal(f.room.phase,'finished');// Harness + dois canteiros em todos os níveis: 1,6x, 1,9x e 2,3x por frente.
 assert.equal(f.team.score,3*(160+190+230));assert.equal(f.team.stats.safe,9);assert.equal(f.team.stats.combos,9);assert.ok(f.team.sites.every(s=>s.level===3));assert.deepEqual(f.arena.snapshot(f.room,'').winners,[0]);
});
test('HTTP: estado ao vivo, recursos locais e regras não expostas como arquivos',async t=>{
 const {server}=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}`;
 const request=(path,body,key)=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await(await request('/api/rooms',{participants:4,teamSize:2})).json();const code=data.state.code;
 const joined=await(await request(`/api/rooms/${code}/join`,{name:'Ana',teamId:0})).json();assert.ok(joined.key);assert.equal(joined.state.cards.length,4);assert.ok(!JSON.stringify(joined.state).includes(data.key));
 const abort=new AbortController();const stream=await fetch(`${base}/api/rooms/${code}/events?key=${joined.key}`,{signal:abort.signal});assert.match(stream.headers.get('content-type'),/event-stream/);assert.match(new TextDecoder().decode((await stream.body.getReader().read()).value),/Ana/);abort.abort();
 for(const path of ['/','/assets/models/Knight.glb','/assets/utils/SkeletonUtils.js'])assert.equal((await request(path)).status,200);
 // O gabarito e as regras moram fora do que o servidor publica. Se algum dia
 // alguém acrescentar dist/ inteiro à lista de arquivos servidos, isto quebra.
 for(const path of ['/src/content/questions.ts','/src/game/arena.ts','/dist/content/questions.js','/dist/content/story.js','/dist/game/arena.js','/dist/game/room.js','/dist/server.js','/package.json','/assets/..%2fdist/content/questions.js'])
  assert.equal((await request(path)).status,404,path+' não pode ser baixável');
});

test('a pergunta acompanha o agente e a chave da resposta não sai do servidor',()=>{
 const f=fixture();
 f.play('worktree',1);assert.equal(f.team.jobs.length,0,'cartas permanentes não abrem pergunta');
 f.play('builder');const job=f.team.jobs[0];
 assert.ok(QUESTIONS.some(q=>q.id===job.questionId));assert.equal(job.askedTo,f.players[0].id);assert.equal(job.answered,null);
 const before=f.arena.snapshot(f.room,f.players[0].key).teams[0].jobs[0].question;
 assert.equal(before.options.length,3);assert.equal(before.answer,null);assert.equal(before.why,null);assert.equal(before.chosen,null);
 // O stream chega a todos: nem o texto correto nem a explicação podem viajar antes da resposta.
 const asked=f.ask(job);
 for(const key of ['',f.room.admin,f.players[1].key,f.players[0].key])
  assert.ok(!JSON.stringify(f.arena.snapshot(f.room,key)).includes(asked.why),'a explicação vazou no snapshot');
 f.answer(job.id,asked.answer);
 const after=f.arena.snapshot(f.room,f.players[0].key).teams[0].jobs[0].question;
 assert.equal(after.answer,asked.answer);assert.equal(after.why,asked.why);assert.equal(after.correct,true);
});

test('acerto acelera o agente e soma bônus; erro explica e não pontua',()=>{
 const f=fixture();f.play('builder');const job=f.team.jobs[0],asked=f.ask(job);
 f.wait(2);
 const left=job.endsAt-f.room.elapsed;
 const result=f.answer(job.id,asked.answer);
 assert.equal(result.correct,true);assert.equal(f.team.score,STUDY.bonus);assert.equal(f.team.stats.learned,1);
 assert.ok(Math.abs(job.endsAt-f.room.elapsed-left*(1-STUDY.speedup))<1e-6,'o tempo restante deveria cair pela metade');
 f.wait(left*(1-STUDY.speedup));assert.equal(f.team.sites[0].built,100,'a obra fecha mais cedo com o acerto');

 const g=fixture();g.play('builder');const bad=g.team.jobs[0],quiz=g.ask(bad);
 const ends=bad.endsAt;
 const wrong=g.answer(bad.id,(quiz.answer+1)%3);
 assert.equal(wrong.correct,false);assert.equal(g.team.score,0);assert.equal(g.team.stats.missed,1);assert.equal(bad.endsAt,ends);
 assert.equal(wrong.question.why,quiz.why,'errar também revela a explicação');
 // O diário é o que o apresentador usa na retomada: o erro precisa ficar lá com o porquê.
 assert.match(g.team.log[0].title,new RegExp(quiz.topic));assert.equal(g.team.log[0].body,quiz.why);
});

test('só quem enviou o agente responde, uma única vez, enquanto a janela da pergunta durar',()=>{
 const f=fixture();f.play('builder',0,f.players[0]);const job=f.team.jobs[0],asked=f.ask(job);
 assert.throws(()=>f.answer(job.id,asked.answer,f.players[2]),/quem enviou/);
 assert.throws(()=>f.answer(job.id,7),/alternativa/);
 f.answer(job.id,asked.answer);
 assert.throws(()=>f.answer(job.id,asked.answer),/já respondeu/);
 assert.equal(f.team.score,STUDY.bonus,'a segunda tentativa não pode somar de novo');
 const g=fixture();g.play('builder');const gone=g.team.jobs[0].id;g.wait(STUDY.windowSeconds+1);
 assert.throws(()=>g.answer(gone,0),/expirou/);
});

// A janela de leitura é da pergunta, não da tarefa: uma revisão de 8 s não pode
// decidir quanto tempo alguém tem para ler o enunciado e as três alternativas.
test('a pergunta sobrevive ao agente e continua valendo pontos, sem acelerar nada',()=>{
 const f=fixture();
 f.play('builder',0);
 const job=f.team.jobs[0];
 assert.equal(job.questionExpiresAt,f.room.elapsed+STUDY.windowSeconds);
 f.wait(BUILD);
 assert.equal(f.team.jobs.length,0,'o agente voltou');
 assert.equal(f.team.quizzes.length,1,'a pergunta continua aberta');
 const antes=f.team.sites[0].built;
 f.answer(job.id,f.ask(job).answer);
 assert.equal(f.team.score,STUDY.bonus,'ainda paga os pontos');
 assert.equal(f.team.sites[0].studyBonus,STUDY.bonus,'e ainda conta para o multiplicador');
 assert.equal(f.team.sites[0].built,antes,'mas não há obra para adiantar');
 assert.equal(f.team.quizzes.length,0,'respondida, sai da espera');
 assert.match(f.team.log[0].body,/já tinha voltado/);
});

test('a janela da pergunta não depende de quantos Construtores dividem a obra',()=>{
 // Três Construtores fecham a obra em 8 s; a pergunta continua com 25 s.
 const f=fixture();
 f.play('worktree',0);f.play('worktree',0);
 f.team.energy=STORY.maxEnergy;
 f.play('builder',0);f.play('builder',0);f.play('builder',0);
 const ids=f.team.jobs.map(j=>j.id);
 f.wait(BUILD/3);
 assert.equal(f.team.sites[0].built,100,'a obra fecha em um terço do tempo');
 assert.equal(f.team.jobs.length,0);
 assert.equal(f.team.quizzes.length,3,'as três perguntas seguem abertas');
 // Todas ainda respondíveis muito depois do fim da obra.
 f.wait(STUDY.windowSeconds-BUILD/3-1);
 for(const id of ids){const j=f.team.quizOf(id);f.answer(id,f.ask(j).answer);}
 assert.equal(f.team.score,3*STUDY.bonus);
 // E fecham juntas quando a janela vence.
 const g=fixture();g.play('builder',0);const perdida=g.team.jobs[0].id;
 g.wait(STUDY.windowSeconds-1);
 assert.equal(g.team.quizzes.length,1,'ainda aberta um segundo antes');
 g.wait(2);
 assert.equal(g.team.quizzes.length,0,'a janela fecha sozinha');
 assert.throws(()=>g.answer(perdida,0),/expirou/);
 assert.equal(g.team.score,0);
});

test('a pausa não consome a janela da pergunta',()=>{
 const f=fixture();f.play('builder',0);
 const job=f.team.jobs[0];
 f.wait(4);
 f.arena.action(f.room,f.room.admin,'pause');
 f.wait(600);
 f.arena.action(f.room,f.room.admin,'pause');
 assert.equal(f.team.quizOf(job.id)?.id,job.id,'a pergunta atravessa a pausa');
 f.answer(job.id,f.ask(job).answer);
 assert.equal(f.team.score,STUDY.bonus);
});

test('cada guilda recebe as perguntas numa ordem própria e sem repetir no ciclo',()=>{
 const f=fixture({participants:4,teamSize:2});
 const seen=[];for(let i=0;i<QUESTIONS.length;i++){f.play('builder',0);const job=f.team.jobs[0];seen.push(job.questionId);f.team.jobs=[];f.team.energy=12;}
 assert.equal(new Set(seen).size,QUESTIONS.length,'o ciclo deveria passar por todas antes de repetir');
 assert.notDeepEqual(f.room.teams[0].quiz,f.room.teams[1].quiz);
});

test('custos dos agentes sobem por nível; suporte continua custando 2',()=>{
 for(let level=0;level<3;level++) {
  const f=fixture();f.team.sites[0].level=level;
  for(const cardId of ['worktree','harness']) {
   const before=f.team.energy;
   f.play(cardId);assert.equal(f.team.energy,before-2);
  }
  const before=f.team.energy;
  f.arena.action(f.room,f.players[0].key,'play',{cardId:'builder',siteId:0,cost:0});
  assert.equal(f.team.energy,before-(2+level),'servidor calcula o preço; ignora o preço enviado');
  f.wait(BUILD);const readyEnergy=f.team.energy;
  f.play('reviewer');assert.equal(f.team.energy,readyEnergy-(2+level));
 }
});

test('boost e respostas não cobram contexto nem mudam o preço da tarefa em andamento',()=>{
 for(let level=0;level<3;level++)for(const cardId of ['builder','reviewer']) {
  const f=fixture();const site=f.team.sites[0];site.level=level;
  if(cardId==='reviewer')site.built=100;
  f.play(cardId);f.wait(2);
  const job=f.team.jobs[0],beforeEnergy=f.team.energy,beforeRemaining=job.remaining(f.room.elapsed);
  f.answer(job.id,f.ask(job).answer);
  assert.equal(f.team.energy,beforeEnergy,`${cardId}, nível ${level+1}: resposta gratuita`);
  assert.ok(Math.abs(job.remaining(f.room.elapsed)-beforeRemaining*(1-STUDY.speedup))<1e-8);
  assert.equal(f.team.score,STUDY.bonus);assert.equal(site.level,level);
  assert.throws(()=>f.answer(job.id,f.ask(job).answer),/já respondeu/);
  assert.equal(f.team.energy,beforeEnergy,'repetir não cobra nem reembolsa');
 }
 const f=fixture();f.play('builder');const job=f.team.jobs[0],energy=f.team.energy,end=job.endsAt;
 f.answer(job.id,(f.ask(job).answer+1)%f.ask(job).options.length);
 assert.equal(f.team.energy,energy);assert.equal(job.endsAt,end);assert.equal(f.team.score,0);
});

test('uma barra permite seis Construtores isolados e chega a zero sem alterar a outra guilda',()=>{
 const f=fixture();
 for(const siteId of [0,0,1,1,2])f.play('worktree',siteId);
 f.wait((STORY.maxEnergy-f.team.energy)/STORY.regen);
 for(const siteId of [0,0,1,1,2,2])f.play('builder',siteId);
 assert.equal(f.team.jobs.length,STORY.maxAgents);
 assert.ok(f.team.jobs.every(job=>!job.conflict));
 assert.equal(f.team.energy,0);assert.equal(f.room.teams[1].energy,STORY.maxEnergy);
 f.wait(BUILD/2);
 assert.equal(f.team.jobs.length,0);assert.ok(f.team.sites.every(site=>site.ready));
 for(const site of f.team.sites)f.play('reviewer',site.id);
 assert.equal(f.team.jobs.length,3,'há contexto para iniciar as revisões depois da primeira onda');
});

// O multiplicador é o que separa quem combinou as jogadas de quem só empurrou
// cartas. Ele precisa crescer com o nível, somar o paralelismo limpo e sumir
// inteiro quando houve conflito de checkout — inclusive na frente do rival.
test('o multiplicador da frente cresce com o nível e soma o paralelismo limpo',()=>{
 const casos=[
  {nivel:0,harness:false,paralelo:false,esperado:1},
  {nivel:0,harness:true, paralelo:false,esperado:1.3},
  {nivel:1,harness:true, paralelo:false,esperado:1.6},
  {nivel:2,harness:true, paralelo:false,esperado:2},
  {nivel:0,harness:false,paralelo:true, esperado:1.3},
  {nivel:2,harness:true, paralelo:true, esperado:2.3},
 ];
 for(const {nivel,harness,paralelo,esperado} of casos){
  const f=fixture();const site=f.team.sites[0];
  site.level=nivel;site.harness=harness;site.contributors=paralelo?2:1;
  assert.ok(Math.abs(site.multiplier()-esperado)<1e-9,`nível ${nivel+1}, harness ${harness}, paralelo ${paralelo}: ${site.multiplier()} != ${esperado}`);
  site.built=100;site.reviewed=true;
  assert.equal(site.reward(),Math.round(STORY.scoreSafe*esperado));
  f.team.energy=STORY.maxEnergy;
  f.deliver(0);
  assert.equal(f.team.score,Math.round(STORY.scoreSafe*esperado));
  assert.equal(f.team.stats.combos,esperado>1?1:0);
  assert.equal(site.conflicted,false,'a entrega limpa o registro do nível');
  assert.equal(site.studyBonus,0);
 }
});

test('conflito de checkout zera o multiplicador do nível nas duas frentes, mesmo depois da revisão',()=>{
 const f=fixture();
 f.play('harness',0);f.play('harness',1);
 f.play('builder',0);f.play('builder',1);
 assert.ok(f.team.jobs.every(j=>j.conflict),'sem canteiro os dois dividem o checkout principal');
 assert.ok(f.team.sites[0].conflicted&&f.team.sites[1].conflicted,'as duas frentes ficam marcadas');
 // Isolar depois encerra o conflito, mas não desfaz o retrabalho já pago.
 f.play('worktree',0);
 assert.ok(f.team.jobs.every(j=>!j.conflict));
 assert.equal(f.team.sites[0].conflicted,true,'o registro do nível sobrevive ao resgate');
 f.wait(BUILD*2);
 f.team.energy=STORY.maxEnergy;f.play('reviewer',0);f.wait(f.team.sites[0].reviewDuration());
 assert.equal(f.team.sites[0].faults,0,'a revisão limpa as falhas');
 assert.equal(f.team.sites[0].multiplier(),1,'mas não devolve o multiplicador');
 f.deliver(0);
 assert.equal(f.team.score,STORY.scoreSafe,'entrega sem multiplicador');
 assert.equal(f.team.stats.combos,0);
 // O nível seguinte começa limpo: o erro custa aquele nível, não a partida.
 assert.equal(f.team.sites[0].conflicted,false);
 assert.equal(f.team.sites[0].multiplier(),1+STORY.harnessBonus[1]);
});

test('o bônus de estudo é pago na hora e multiplicado de novo na entrega',()=>{
 const f=fixture();const site=f.team.sites[0];
 site.harness=true;site.level=2;// multiplicador 2x
 f.play('builder',0);
 const job=f.team.jobs[0];
 f.answer(job.id,f.ask(job).answer);
 assert.equal(f.team.score,STUDY.bonus,'o acerto continua pagando na hora');
 assert.equal(site.studyBonus,STUDY.bonus);
 f.wait(BUILD);
 f.team.energy=STORY.maxEnergy;f.play('reviewer',0);f.wait(site.reviewDuration());
 const antes=f.team.score;
 f.deliver(0);
 // 100 x 2 mais a parte que o multiplicador acrescenta ao bônus já creditado.
 assert.equal(f.team.score-antes,STORY.scoreSafe*2+STUDY.bonus);
 assert.equal(f.team.score,STUDY.bonus+STORY.scoreSafe*2+STUDY.bonus,'240 na conta da entrega perfeita do nível 3');
});

test('errar a pergunta não acumula bônus para a entrega multiplicar',()=>{
 const f=fixture();const site=f.team.sites[0];
 site.harness=true;site.level=2;
 f.play('builder',0);
 const job=f.team.jobs[0],q=f.ask(job);
 f.answer(job.id,(q.answer+1)%q.options.length);
 assert.equal(site.studyBonus,0);
 assert.equal(f.team.score,0);
});
