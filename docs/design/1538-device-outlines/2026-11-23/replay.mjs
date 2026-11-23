// Synthetic offline visual replay. Run from a checkout with prototype.patch applied.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createLabServer } from '../../../../demo/ui-lab/server.mjs';
import { parseOptions } from '../../../../demo/ui-lab/config.mjs';
const folder=dirname(fileURLToPath(import.meta.url));
const server=createLabServer({fixture:resolve(folder,'fixture.json'),port:8892,
  ...parseOptions(process.argv.slice(2)),repoRoot:resolve(folder,'../../../..')});
const handler=server.listeners('request')[0];
server.removeListener('request',handler);
server.on('request',(req,res)=>{
  if(req.url?.split('?')[0]==='/app.mjs') {
    const app=readFileSync(resolve(folder,'../../../../demo/ui-lab/app.mjs'),'utf8')
      .replace("const panel = document.createElement('houseplan-panel');",
        "const panel = document.createElement('houseplan-panel'); panel.route={prefix:'/HousePlan',path:''};");
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}).end(app);
    return;
  }
  if(['/HousePlan','/houseplan'].includes(req.url?.split('?')[0]))req.url='/';
  handler(req,res);
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(server.config.port,'127.0.0.1',()=>console.log(`Prototype #1538: http://127.0.0.1:${server.config.port}/HousePlan`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
