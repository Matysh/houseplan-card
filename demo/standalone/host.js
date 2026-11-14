/** Browser-side test transport. No domain parsing, echo storage or fake hass. */
export function createCorePlanHost(capabilities){
  const listeners=new Set(),events=new Map(),commands=[];
  let key={},epoch=1,revision=1,fail,hold,handshake={},pending=0;
  const empty=Object.freeze({});
  let environment=Object.freeze({ready:true,connected:true,permissions:{read:true,write:true,admin:true},
    units:{},timeZone:'UTC',states:empty,registry:{revision:0,authoritative:false,access:'limited',devices:empty,entities:empty,areas:empty,lastSuccess:0},
    presentation:Object.freeze({language:'en'})});
  const error=code=>Object.assign(new Error(code),{code});
  const rpc=async value=>{
    const authority=key,sequence=epoch;
    if(!environment.ready||!environment.connected)throw error('not_ready');
    if(value.op!=='snapshot'&&value.op==='request'&&!value.command.type.endsWith('/get')&&!environment.permissions.write)throw error('unauthorized');
    if(fail){const code=fail;fail=undefined;throw error(code);}
    if(hold){const wait=hold;hold=undefined;await wait;}
    if(authority!==key||sequence!==epoch)throw error('context-changed');
    const response=await fetch('/standalone-core-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
    const reply=await response.json();if(reply.error)throw error(reply.error.code);
    if(authority!==key||sequence!==epoch)throw error('context-changed');
    for(const event of reply.events||[])for(const receive of [...events.get(event.event)||[]])receive({data:{rev:event.rev}});
    return reply.result;
  };
  const request=async command=>{commands.push(structuredClone(command));pending++;
    try{const result=await rpc({op:'request',command});return command.type==='houseplan/config/get'?{...result,...handshake}:result;}
    finally{pending--;}};
  const postJson=(path,value)=>rpc({op:'post',path,value});
  const host={capabilities:Object.freeze(capabilities),get authorityKey(){return key;},get writeAuthorityRevision(){return epoch;},
    get environmentRevision(){return revision;},get environment(){return environment;},request,
    async subscribe(event,receive){const set=events.get(event)||new Set();events.set(event,set);set.add(receive);let live=true;
      return ()=>{if(live){live=false;set.delete(receive);}};},
    subscribeEnvironment(receive){listeners.add(receive);return ()=>listeners.delete(receive);},
    http:{postJson,async request(path,init){
      const body=init?.body instanceof FormData?init.body.get('file'):init?.body;
      const bytes=new Uint8Array(await body.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      const result=await postJson(path,{name:body.name||'plan.json',mime:body.type,bytes:btoa(binary)});return Response.json(result);
    }},
    content:{async resolve(paths){return Object.fromEntries(paths.map(path=>[path,path]));},async resolveAssets(ids){
      const {assets}=await request({type:'houseplan/assets/list'});return {assets:assets.filter(asset=>ids.includes(asset.asset_id))};}},
  };
  const publish=patch=>{environment=Object.freeze({...environment,...patch});revision++;for(const receive of [...listeners])receive();};
  return {host,commands,get pendingCount(){return pending;},get listenerCount(){return listeners.size;},get subscriptionCount(){return [...events.values()].reduce((n,s)=>n+s.size,0);},
    snapshot:()=>rpc({op:'snapshot'}),failNext(code){fail=code;},holdNext(promise){hold=promise;},
    permissions(value){epoch++;publish({permissions:value});},replace(){key={};epoch++;publish({});},
    connection(connected){epoch++;publish({connected,ready:connected});},handshake(value){handshake=value;}};
}
