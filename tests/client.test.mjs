import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createServer } from '../server.mjs';

// Exercises the real client actions against HTTP. Canvas and the DOM are replaced
// only as rendering surfaces; game rules, requests and state transitions are real.
async function client(base) {
 const source=(await readFile(new URL('../src/client.js',import.meta.url),'utf8')).replace(/import\('\.\/scene\.js'\)[^\n]+/,'');
 const noop=()=>{},listeners={};
 const ctx=new Proxy({measureText:s=>({width:String(s).length*8}),createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
 const canvas={getContext:()=>ctx,style:{},addEventListener:(name,fn)=>listeners[name]=fn,focus:noop};const element={addEventListener:noop,blur:noop,focus:noop,setAttribute:noop,replaceChildren:noop};
 const context=vm.createContext({document:{querySelector:s=>s==='#game'?canvas:{...element},fonts:{load:async()=>{}},createElement:()=>({...element})},innerWidth:1440,innerHeight:900,devicePixelRatio:1,matchMedia:()=>({matches:true}),addEventListener:noop,sessionStorage:{getItem:()=>null,setItem:noop},performance:{now:()=>0},requestAnimationFrame:noop,URL,URLSearchParams,location:{origin:base,search:'',host:new URL(base).host},history:{replaceState:noop},Date,console,
 listeners,fetch:(url,options)=>fetch(new URL(url,base),options),EventSource:class{close(){}},Image:class{}});
 return vm.runInContext(`(async()=>{${source}\nreturn {
 create,lookup,join,action,apply,api,
 pointer:(name,event)=>listeners[name](event),fields, state:()=>state, key:()=>key,
 team:(id)=>teamSelection=id,
 draw:()=>{draw(1000);return controls.map(c=>({id:c.id,disabled:c.disabled,label:c.label,x:c.x,y:c.y,w:c.w,h:c.h}));},
 click:async(id)=>{draw(1000);const control=controls.find(c=>c.id===id);if(!control||control.disabled)throw Error('Control unavailable: '+id);await control.fn();},
 refresh:async()=>apply((await api('/api/rooms/'+state.code)).state),
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
 now+=12000;arena.tick();await ana.refresh();await ana.click('card-reviewer');await ana.click('site-0');now+=6000;arena.tick();await ana.refresh();await ana.click('deliver');
 assert.equal(ana.state().teams[0].score,100);await bia.refresh();assert.equal(bia.state().teams[0].score,100);assert.equal(bia.state().teams[1].score,0);assert.equal(ana.state().phase,'playing');
});

test('client: arrastar a carta e soltar no alvo cria uma tarefa, sem botão de confirmar resposta',async t=>{
 const {server}=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});const c=await client(`http://127.0.0.1:${server.address().port}`);
 await c.create(true);const controls=c.draw(),card=controls.find(c=>c.id==='card-builder'),site=controls.find(c=>c.id==='site-2');
 const event=(x,y)=>({clientX:x,clientY:y,pointerId:1,preventDefault:()=>{}});
 c.pointer('pointerdown',event(card.x+card.w/2,card.y+card.h/2));c.draw();c.pointer('pointermove',event(site.x+site.w/2,site.y+site.h/2));await c.pointer('pointerup',event(site.x+site.w/2,site.y+site.h/2));
 assert.equal(c.state().teams[0].jobs.length,1);assert.equal(c.state().teams[0].jobs[0].siteId,2);assert.equal(c.state().teams[0].jobs[0].cardId,'builder');assert.equal(c.state().phase,'playing');
});
