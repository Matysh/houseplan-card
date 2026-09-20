import http from 'node:http';
import {readFile, stat, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = await realpath(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.HOUSEPLAN_SETTINGS_PORT || 8135);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const requested=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    const file=await realpath(requested);
    const relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||!(await stat(file)).isFile()){res.writeHead(403);res.end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Space settings design preview: http://127.0.0.1:${port}`));
