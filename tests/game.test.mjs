import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena } from '../src/game.mjs';
import { QUESTIONS, STORY, STUDY } from '../src/missions.mjs';
const INTEGRATE=STORY.integrationSeconds;
const BUILD=STORY.buildSeconds,REVIEW=STORY.reviewSeconds;
import { createServer } from '../server.mjs';

function fixture({participants=4,teamSize=2,duration=180,practice=false}={}){
 let now=1000;const arena=new Arena({now:()=>now}),room=arena.create({participants,teamSize,duration,practice});
 const players=Array.from({length:practice?1:participants},(_,i)=>arena.join(room,{name:'Pessoa '+i,teamId:i%room.teams.length}));
 arena.start(room,room.admin);
 return {arena,room,players,team:room.teams[0],wait:seconds=>{now+=seconds*1000;arena.tick();},jump:seconds=>now+=seconds*1000,play:(cardId,siteId=0,p=players[0])=>arena.action(room,p.key,'play',{cardId,siteId}),deliver:(siteId=0)=>arena.action(room,players[0].key,'deliver',{siteId}),answer:(jobId,option,p=players[0])=>arena.action(room,p.key,'answer',{jobId,option}),ask:(job)=>QUESTIONS.find(q=>q.id===job.questionId)};
}
test('equilibra vagas e recursos entre guildas de tamanhos diferentes',()=>{
 const arena=new Arena();for(let participants=4;participants<=80;participants++){const room=arena.create({participants,teamSize:5});assert.equal(room.teams.reduce((n,t)=>n+t.capacity,0),participants);assert.ok(Math.max(...room.teams.map(t=>t.capacity))-Math.min(...room.teams.map(t=>t.capacity))<=1);assert.ok(room.teams.every(t=>t.energy===12));}assert.throws(()=>arena.create({participants:80,teamSize:2}),/16 times/);
});
test('lobby: vagas, nomes, troca e autorização do orquestrador',()=>{
 const arena=new Arena(),room=arena.create({participants:4,teamSize:2});const a=arena.join(room,{name:'Ana',teamId:0});arena.join(room,{name:'Bia',teamId:0});assert.throws(()=>arena.join(room,{name:'Caio',teamId:0}),/cheio/);assert.throws(()=>arena.join(room,{name:'ana',teamId:1}),/já está/);assert.throws(()=>arena.start(room,a.key),/orquestrador/);assert.throws(()=>arena.start(room,room.admin),/pelo menos/);arena.join(room,{name:'Ana',teamId:1},a.key);arena.start(room,room.admin);assert.throws(()=>arena.join(room,{name:'Caio',teamId:1}),/já começou/);
});
test('construção e revisão levam tempo; só a entrega gera pontos e não pode ser repetida',()=>{
 const f=fixture();f.play('builder');assert.equal(f.team.energy,9);assert.equal(f.team.jobs.length,1);assert.equal(f.team.score,0);f.wait(BUILD-1);assert.ok(f.team.sites[0].built>90&&f.team.sites[0].built<100,'a obra avança continuamente');f.wait(1);assert.equal(f.team.sites[0].built,100);assert.equal(f.team.jobs.length,0);f.play('reviewer');f.wait(REVIEW);assert.equal(f.team.sites[0].reviewed,true);assert.equal(f.team.score,0);f.deliver();assert.equal(f.team.score,100);assert.equal(f.team.sites[0].level,1);assert.throws(()=>f.deliver(),/não terminou/);assert.equal(f.team.score,100);
});
test('ações de pessoas do mesmo time compartilham orçamento; concorrência no checkout causa conflito real',()=>{
 const f=fixture();f.play('builder',0,f.players[0]);f.play('builder',1,f.players[2]);assert.equal(f.team.energy,6);assert.equal(f.team.jobs.length,2);assert.ok(f.team.jobs.every(j=>j.conflict));f.wait(BUILD);
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
test('contexto e três agentes limitam ações sem aceitar pontos ou time enviados pelo cliente',()=>{
 const f=fixture();f.play('builder',0);f.play('builder',0);f.play('builder',0);assert.throws(()=>f.play('builder',1),/3 agentes/);assert.equal(f.team.energy,3);assert.throws(()=>f.arena.action(f.room,'fake','play',{cardId:'builder',siteId:1}),/Entre/);assert.throws(()=>f.arena.action(f.room,f.players[0].key,'finish'),/orquestrador/);assert.equal(f.team.score,0);assert.throws(()=>f.play('reviewer',2),/Construa/);
});
test('harness bloqueia entrega não revisada; sem harness a entrega vale apenas 40',()=>{
 const f=fixture();f.play('harness');f.play('builder');f.wait(BUILD);const energy=f.team.energy;f.deliver();assert.equal(f.team.score,0);assert.equal(f.team.sites[0].level,0);assert.equal(f.team.stats.blocked,1);assert.equal(f.team.energy,energy);f.play('reviewer');f.wait(REVIEW);f.deliver();assert.equal(f.team.score,100);
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
test('uma campanha completa reconstrói nove níveis e termina com 900 pontos',()=>{
 // A campanha usa a mecânica nova: um canteiro por frente e dois Construtores
 // em paralelo, pagando a integração na revisão.
 const f=fixture({practice:true,duration:420});
 for(let site=0;site<3;site++){f.play('harness',site);f.play('worktree',site);f.wait(10);}
 for(let site=0;site<3;site++)
  for(let level=0;level<3;level++){
   f.play('builder',site);f.play('builder',site);f.wait(BUILD/2);
   f.play('reviewer',site);f.wait(REVIEW+INTEGRATE);f.deliver(site);
  }
 assert.equal(f.room.phase,'finished');assert.equal(f.team.score,900);assert.equal(f.team.stats.safe,9);assert.ok(f.team.sites.every(s=>s.level===3));assert.deepEqual(f.arena.snapshot(f.room,'').winners,[0]);
});
test('HTTP: estado ao vivo, recursos locais e regras não expostas como arquivos',async t=>{
 const {server}=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}`;
 const request=(path,body,key)=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await(await request('/api/rooms',{participants:4,teamSize:2})).json();const code=data.state.code;
 const joined=await(await request(`/api/rooms/${code}/join`,{name:'Ana',teamId:0})).json();assert.ok(joined.key);assert.equal(joined.state.cards.length,4);assert.ok(!JSON.stringify(joined.state).includes(data.key));
 const abort=new AbortController();const stream=await fetch(`${base}/api/rooms/${code}/events?key=${joined.key}`,{signal:abort.signal});assert.match(stream.headers.get('content-type'),/event-stream/);assert.match(new TextDecoder().decode((await stream.body.getReader().read()).value),/Ana/);abort.abort();
 for(const path of ['/','/src/client.js','/assets/models/Knight.glb','/assets/utils/SkeletonUtils.js'])assert.equal((await request(path)).status,200);
 for(const path of ['/src/missions.mjs','/server.mjs','/assets/..%2fsrc/missions.mjs'])assert.equal((await request(path)).status,404);
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

test('só quem enviou o agente responde, uma única vez, enquanto a tarefa existe',()=>{
 const f=fixture();f.play('builder',0,f.players[0]);const job=f.team.jobs[0],asked=f.ask(job);
 assert.throws(()=>f.answer(job.id,asked.answer,f.players[2]),/quem enviou/);
 assert.throws(()=>f.answer(job.id,7),/alternativa/);
 f.answer(job.id,asked.answer);
 assert.throws(()=>f.answer(job.id,asked.answer),/já respondeu/);
 assert.equal(f.team.score,STUDY.bonus,'a segunda tentativa não pode somar de novo');
 const g=fixture();g.play('builder');const gone=g.team.jobs[0].id;g.wait(BUILD);
 assert.throws(()=>g.answer(gone,0),/expirou/);
});

test('cada guilda recebe as perguntas numa ordem própria e sem repetir no ciclo',()=>{
 const f=fixture({participants:4,teamSize:2});
 const seen=[];for(let i=0;i<QUESTIONS.length;i++){f.play('builder',0);const job=f.team.jobs[0];seen.push(job.questionId);f.team.jobs=[];f.team.energy=12;}
 assert.equal(new Set(seen).size,QUESTIONS.length,'o ciclo deveria passar por todas antes de repetir');
 assert.notDeepEqual(f.room.teams[0].quiz,f.room.teams[1].quiz);
});
