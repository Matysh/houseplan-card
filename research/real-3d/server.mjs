import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
export const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
export function serve(port=8317){
 const server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const product=pathname.startsWith('/product/')||pathname.startsWith('/assets/')||pathname.startsWith('/fixtures/');
   const base=product?resolve(root,'../../demo/srv'):root;
   const path=resolve(base,product?(pathname.startsWith('/product/')?pathname.slice(9):'.'+pathname):'.'+(pathname==='/'?'/index.html':pathname));
   if(path!==base&&!path.startsWith(base+sep)){res.writeHead(403).end();return;}
   const data=await readFile(path);
   res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.css':'text/css'})[extname(path)]||'application/octet-stream','cache-control':'no-store'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
 });
 return new Promise(done=>server.listen(port,'127.0.0.1',()=>done(server)));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){await serve();console.log('Research MVP: http://127.0.0.1:8317');}
