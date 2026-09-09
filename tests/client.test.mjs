import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createServer } from '../server.mjs';
import { QUESTIONS, STORY } from '../src/missions.mjs';

// Exercises the real client actions against HTTP. Canvas and the DOM are replaced
// only as rendering surfaces; game rules, requests and state transitions are real.
async function client(base) {
 const source=(await readFile(new URL('../src/client.js',import.meta.url),'utf8')).replace(/import\('\.\/scene\.js'\)[^\n]+/,'');
 const noop=()=>{},listeners={};
 const ctx=new Proxy({measureText:s=>({width:String(s).length*8}),createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 const canvas={getContext:()=>ctx,style:{},addEventListener:(name,fn)=>listeners[name]=fn,focus:noop};const element={addEventListener:noop,blur:noop,focus:noop,setAttribute:noop,replaceChildren:noop};
 const context=vm.createContext({document:{querySelector:s=>s==='#game'?canvas:{...element},fonts:{load:async()=>{}},createElement:()=>({...element})},innerWidth:1440,innerHeight:900,devicePixelRatio:1,matchMedia:()=>({matches:true}),addEventListener:noop,sessionStorage:{getItem:()=>null,setItem:noop},performance:{now:()=>0},requestAnimationFrame:noop,URL,URLSearchParams,location:{origin:base,search:'',host:new URL(base).host},history:{replaceState:noop},Date,console,
 listeners,fetch:(url,options)=>fetch(new URL(url,base),options),EventSource:class{close(){}},Image:class{}});
 return vm.runInContext(`(async()=>{${source}
 // O relógio avança a cada quadro: sem isso as animações ficam paradas no
 // primeiro instante e os controles com entrada animada nunca habilitam.
 let __clock=1000;const __step=()=>(__clock+=600);
 return {
 create,lookup,join,action,apply,api,
 pointer:(name,event)=>listeners[name](event),fields, state:()=>state, key:()=>key,
 team:(id)=>teamSelection=id,
 draw:()=>{draw(__step());return controls.map(c=>({id:c.id,disabled:c.disabled,label:c.label,x:c.x,y:c.y,w:c.w,h:c.h}));},
 click:async(id)=>{draw(__step());const control=controls.find(c=>c.id===id);if(!control||control.disabled)throw Error('Control unavailable: '+id);await control.fn();},
 refresh:async()=>apply((await api('/api/rooms/'+state.code)).state),
 progress:(siteId)=>{const t=viewTeam();return buildProgress(t,t.sites[siteId],elapsed());},
 preview:(cardId,siteId)=>{const team=viewTeam();return previewPlay(state.cards.find(c=>c.id===cardId),team.sites[siteId],team,currentEnergy(team));},
 toast:()=>toast
 };})()`,context);
}

test('client: tocar carta e construção mobiliza agente; entrega revisada atualiza o placar dos celulares',async t=>{
 const {server,arena}=createServer();let now=Date.now();arena.now=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}`;
 const admin=await client(base),ana=await client(base),bia=await client(base);
 admin.fields.participants=4;admin.fields.teamSize=2;await admin.create();const code=admin.state().code;
 await ana.lookup(code);ana.fields.name='Ana';ana.team(0);await ana.join();
 await bia.lookup(code);bia.fields.name='Bia';bia.team(1);await bia.join();await admin.action('start');await ana.refresh();await bia.refresh();
 assert.ok(!ana.draw().some(c=>/vote|reveal/.test(c.id)));assert.equal(ana.draw().find(c=>c.id==='deliver').disabled,true);
 await ana.click('card-builder');await ana.click('site-0');assert.equal(ana.state().teams[0].jobs.length,1);assert.equal(ana.state().teams[0].energy,9);
 now+=STORY.buildSeconds*1000;arena.tick();await ana.refresh();await ana.click('card-reviewer');await ana.click('site-0');now+=STORY.reviewSeconds*1000;arena.tick();await ana.refresh();await ana.click('deliver');
 assert.equal(ana.state().teams[0].score,100);await bia.refresh();assert.equal(bia.state().teams[0].score,100);assert.equal(bia.state().teams[1].score,0);assert.equal(ana.state().phase,'playing');
});

test('client: arrastar a carta e soltar no alvo cria uma tarefa, sem botão de confirmar resposta',async t=>{
 const {server}=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});const c=await client(`http://127.0.0.1:${server.address().port}`);
 await c.create(true);const controls=c.draw(),card=controls.find(c=>c.id==='card-builder'),site=controls.find(c=>c.id==='site-2');
 const event=(x,y)=>({clientX:x,clientY:y,pointerId:1,preventDefault:()=>{}});
 c.pointer('pointerdown',event(card.x+card.w/2,card.y+card.h/2));c.draw();c.pointer('pointermove',event(site.x+site.w/2,site.y+site.h/2));await c.pointer('pointerup',event(site.x+site.w/2,site.y+site.h/2));
 assert.equal(c.state().teams[0].jobs.length,1);assert.equal(c.state().teams[0].jobs[0].siteId,2);assert.equal(c.state().teams[0].jobs[0].cardId,'builder');assert.equal(c.state().phase,'playing');
});

// A prévia na arena repete as regras de game.mjs para mostrar o efeito da carta
// antes da jogada. Este teste cruza as duas: se uma regra do servidor mudar sem
// a prévia acompanhar, a interface passa a prometer o que o servidor recusa.
test('client: a prévia da carta na frente concorda com a decisão do servidor',async t=>{
 const {server,arena}=createServer();let now=Date.now();arena.now=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
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
  'tres agentes ocupados':async c=>{for(const s of [0,1,2])await act(c,'builder',s);},
  'contexto no limite':async c=>{await act(c,'builder',1);await act(c,'builder',2);await act(c,'harness',1);await act(c,'worktree',2);},
 };
 const checked=[];
 for(const [label,setup] of Object.entries(states))
  for(const cardId of ['builder','worktree','reviewer','harness']){
   const c=await client(base);
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
 const {server,arena}=createServer();let now=Date.now();arena.now=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const c=await client(`http://127.0.0.1:${server.address().port}`);
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
 const {server,arena}=createServer();let now=Date.now();arena.now=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const c=await client(`http://127.0.0.1:${server.address().port}`);
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
