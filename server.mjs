import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { Arena, GameError } from './src/game.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
export function createServer() {
  const arena=new Arena(), streams=new Set();
  function publish(room){room.version++;room.updated=Date.now();for(const s of streams)if(s.room===room)s.res.write(`data: ${JSON.stringify(arena.snapshot(room,s.key))}\n\n`);}
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')){
        if(req.method==='POST'){
          const origin=req.headers.origin;
          if(origin&&new URL(origin).host!==req.headers.host)throw new GameError('Origem não permitida.',403);
          let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw new GameError('Pedido muito grande.',413);}
          let body;try{body=JSON.parse(text||'{}');}catch{throw new GameError('Pedido inválido.');}
          if(!body||typeof body!=='object'||Array.isArray(body))throw new GameError('Pedido inválido.');
          if(url.pathname==='/api/rooms'){
            const room=arena.create(body);let key=room.admin;
            if(body.practice){const p=arena.join(room,{name:'Você',teamId:0});key=p.key;room.practicePlayer=p.key;}
            json(res,201,{key,adminKey:body.practice?room.admin:undefined,state:arena.snapshot(room,key)});return;
          }
          const match=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})\/(join|action)$/i);
          if(!match)throw new GameError('Rota não encontrada.',404);
          const room=arena.get(match[1]);const key=req.headers.authorization?.replace(/^Bearer /,'');
          if(match[2]==='join'){const p=arena.join(room,body,key);publish(room);json(res,200,{key:p.key,state:arena.snapshot(room,p.key)});}
          else {let result;try{result=arena.action(room,key,body.action,body);}finally{publish(room);}json(res,200,{state:arena.snapshot(room,key),result});}return;
        }
        if(req.method==='GET'){
          if(url.pathname==='/api/connection') {
            const host=req.headers.host;
            const addresses=Object.entries(networkInterfaces()).sort(([a],[b])=>Number(!/^en/.test(a))-Number(!/^en/.test(b))).flatMap(([,list])=>list).filter(n=>n.family==='IPv4'&&!n.internal);
            const local=/^(localhost|127\.0\.0\.1)(:|$)/.test(host);
            const joinBase=process.env.PUBLIC_URL || (local&&addresses[0]?`http://${addresses[0].address}:${server.address().port}`:`http://${host}`);
            json(res,200,{joinBase});return;
          }
          const match=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})(\/events)?$/i);if(!match)throw new GameError('Rota não encontrada.',404);
          const room=arena.get(match[1]);const key=match[2]?url.searchParams.get('key'):req.headers.authorization?.replace(/^Bearer /,'');
          if(match[2]){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(`data: ${JSON.stringify(arena.snapshot(room,key))}\n\n`);const stream={room,key,res};streams.add(stream);req.on('close',()=>streams.delete(stream));}
          else json(res,200,{state:arena.snapshot(room,key)});return;
        }
        throw new GameError('Método não permitido.',405);
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw new GameError('Método não permitido.',405);
      const path=url.pathname==='/'?'/agent-arena.html':decodeURIComponent(url.pathname);
      // Servir apenas a interface e os recursos do jogo.
      if(!(path==='/agent-arena.html'||path.startsWith('/assets/')||['/src/client.js','/src/scene.js'].includes(path)))throw new GameError('Arquivo não encontrado.',404);
      const file=resolve(root,'.'+path);const allowedFiles=['agent-arena.html','src/client.js','src/scene.js'].map(p=>resolve(root,p));if(!file.startsWith(resolve(root,'assets')+sep)&&!allowedFiles.includes(file))throw new GameError('Arquivo não encontrado.',404);
      const info=await stat(file);if(!info.isFile())throw new GameError('Arquivo não encontrado.',404);
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));
    }catch(error){if(!res.headersSent)json(res,error.status||(error.code==='ENOENT'?404:500),{error:error instanceof GameError?error.message:error.code==='ENOENT'?'Arquivo não encontrado.':'Erro no servidor.'});else res.end();}
  });
  const interval=setInterval(()=>{for(const room of arena.tick())publish(room);},250);interval.unref();
  const heartbeat=setInterval(()=>{for(const s of streams)s.res.write(': heartbeat\n\n');},15000);heartbeat.unref();
  server.on('close',()=>{clearInterval(interval);clearInterval(heartbeat);for(const s of streams)s.res.end();});
  return {server,arena};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||8080;const {server}=createServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`A porta ${port} já está em uso. Escolha outra: PORT=${port+1} npm start`:error.message);process.exitCode=1;});server.listen(port,'0.0.0.0',()=>{
 console.log(`Agent Arena: http://localhost:${port}`);
 for(const net of Object.values(networkInterfaces()).flat())if(net.family==='IPv4'&&!net.internal)console.log(`Celulares na mesma rede: http://${net.address}:${port}`);
 console.log('Mantenha este terminal aberto durante a partida.');
 });
}
