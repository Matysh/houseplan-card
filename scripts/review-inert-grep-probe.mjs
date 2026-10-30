// #1134: manual native protocol probe. Run with unshare -Urn and loopback up.
// No real provider/model: responses are scripted, inputs and HOME are synthetic.
import {createServer} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,realpathSync} from 'node:fs';
import {tmpdir,networkInterfaces} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {REVIEW_CLI_VERSION,REVIEW_CLI_SHA256} from './review-execution-policy.mjs';
const root=realpathSync(fileURLToPath(new URL('..',import.meta.url)));
if(process.platform!=='linux'||Object.keys(networkInterfaces()).some(name=>name!=='lo'))throw Error('Run only inside an isolated network namespace with loopback');
const binary=process.argv.find(a=>a.startsWith('--cli='))?.slice(6);
if(!binary||!binary.startsWith('/'))throw Error('Supply --cli=/absolute/path/to/checksum-verified/native/claude');
if(createHash('sha256').update(readFileSync(binary)).digest('hex')!==REVIEW_CLI_SHA256)throw Error('pin mismatch');
const dir=mkdtempSync(join(tmpdir(),'hp-1134-inert-')),out=[];
for(const [name,input] of [['valid',{pattern:'needle',path:'fixture.txt',output_mode:'content'}],
  ['unknown-v',{pattern:'needle',path:'fixture.txt',output_mode:'content','-v':true}],
  ['unknown-l',{pattern:'needle',path:'fixture.txt','-n':true,'-l':true}],
  ['wrong-n-type',{pattern:'needle',path:'fixture.txt','-n':'yes','-l':true}]]) {
  const owned=join(dir,name),repo=join(owned,'repo'),home=join(owned,'home');mkdirSync(repo,{recursive:true});mkdirSync(home);
  writeFileSync(join(repo,'fixture.txt'),'needle synthetic content\n');
  const env={PATH:process.env.PATH,HOME:home,TMPDIR:owned,XDG_CONFIG_HOME:home,
    GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_AUTHOR_NAME:'fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',
    GIT_COMMITTER_NAME:'fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',
    REVIEW_KIND:'task',REVIEW_CLAUDE_VERSION:REVIEW_CLI_VERSION,REVIEW_DOC:join(owned,'report.md'),
    ANTHROPIC_API_KEY:'hp-synthetic-offline-key',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',
    DISABLE_TELEMETRY:'1',DISABLE_ERROR_REPORTING:'1',DO_NOT_TRACK:'1'};
  const git=(...args)=>execFileSync('git',args,{cwd:repo,env,stdio:'pipe'});
  git('init','-q');git('add','.');git('commit','-qm','inert fixture');
  const policyPath=join(owned,'policy.json');
  const prepared=spawnSync(process.execPath,[join(root,'scripts/review-execution-policy.mjs'),'prepare',policyPath],{cwd:repo,env,encoding:'utf8'});
  if(prepared.status!==0)throw Error('original prepare failed');
  const policy=JSON.parse(readFileSync(policyPath));let requests=0,resultShape=null;
  const server=createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    const body=Buffer.concat(chunks);if(body.length>8*1024*1024){res.writeHead(413);res.end();return;}
    if(req.url.includes('count_tokens')){res.setHeader('Content-Type','application/json');res.end('{"input_tokens":1}');return;}
    if(!req.url.startsWith('/v1/messages')){res.setHeader('Content-Type','application/json');res.end('{}');return;}
    const data=JSON.parse(body),results=(data.messages||[]).flatMap(m=>Array.isArray(m.content)?m.content:[])
      .filter(b=>b.type==='tool_result'&&b.tool_use_id==='probe_grep');
    if(results.length){const r=results[0],text=typeof r.content==='string'?r.content:JSON.stringify(r.content);
      const first=typeof r.content==='string'?r.content:r.content?.find(b=>b.type==='text')?.text??'';
      resultShape={contentShape:typeof r.content==='string'?'text':Array.isArray(r.content)?'blocks':'other',
        errorEnvelope:/^InputValidationError:/.test(first)?'plain-prefix':/^<tool_use_error>InputValidationError:/.test(first)?'tag-prefix':'other',
        isError:r.is_error===true,category:/InputValidationError/.test(text)?'input-validation-error':r.is_error===true?'other-tool-error':'non-error'};}
    const tool=++requests===1;if(requests>4){res.writeHead(500);res.end();return;}
    res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');
    const emit=(event,value)=>res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
    emit('message_start',{type:'message_start',message:{id:'msg_fixture',type:'message',role:'assistant',model:data.model,
      content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}});
    emit('content_block_start',{type:'content_block_start',index:0,content_block:tool?{type:'tool_use',id:'probe_grep',name:'Grep',input:{}}:{type:'text',text:''}});
    emit('content_block_delta',{type:'content_block_delta',index:0,delta:tool?{type:'input_json_delta',partial_json:JSON.stringify(input)}:{type:'text_delta',text:'fixture complete'}});
    emit('content_block_stop',{type:'content_block_stop',index:0});
    emit('message_delta',{type:'message_delta',delta:{stop_reason:tool?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:1}});
    emit('message_stop',{type:'message_stop'});res.end();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));env.ANTHROPIC_BASE_URL=`http://127.0.0.1:${server.address().port}`;
  const args=['--print','--verbose','--output-format','stream-json','--setting-sources','',
    '--settings',`${policyPath}.settings.json`,'--strict-mcp-config','--mcp-config','{"mcpServers":{}}',
    '--tools','Grep','--allowedTools','Grep','--no-session-persistence','--max-turns','3'];
  const child=spawn(binary,args,{cwd:repo,env,stdio:['pipe','pipe','pipe'],detached:true});let output='',errors='';
  child.stdout.on('data',b=>{if(output.length<4*1024*1024)output+=b;});child.stderr.on('data',b=>{if(errors.length<1024*1024)errors+=b;});
  child.stdin.end('Use the supplied inert fixture.');
  const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},45000);
  const exit=await new Promise(r=>child.on('close',(code,signal)=>r({code,signal})));clearTimeout(timer);
  await new Promise(r=>server.close(r));
  const rows=readFileSync(policy.journal,'utf8').split('\n').filter(Boolean).map(JSON.parse);
  out.push({name,inputKeys:Object.keys(input),requests,resultShape,journalRows:rows.length,
    journalKeys:rows.map(r=>r.diagnostic?.keys),journalOtherKeys:rows.map(r=>r.diagnostic?.otherKeyCount),
    denied:rows.map(r=>r.denied),exit,outputBytes:output.length,errorBytes:errors.length,
    optionError:/unknown option/.test(errors),terminalSuccess:output.includes('"subtype":"success"')});
}
const result={schema:1,diagnosticOnly:true,verdictAuthority:false,nativeVersion:REVIEW_CLI_VERSION,nativeSha:REVIEW_CLI_SHA256,
  network:'isolated-loopback-only',providerRequests:0,modelCalls:0,out};
const output=join(root,'artifacts/review-inert-grep');mkdirSync(output,{recursive:true});
writeFileSync(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
for(const row of out) {
  const rejected=['unknown-v','wrong-n-type'].includes(row.name);
  assert.equal(row.exit.code,0,row.name);assert.equal(row.exit.signal,null,row.name);
  assert.equal(row.requests,2,row.name);assert.equal(row.terminalSuccess,true,row.name);
  assert.equal(row.journalRows,rejected?0:1,row.name);
  assert.deepEqual(row.denied,rejected?[]:[false],row.name);
  assert.equal(row.resultShape?.isError,rejected,row.name);
  if(rejected)assert.equal(row.resultShape.category,'input-validation-error',row.name);
}
