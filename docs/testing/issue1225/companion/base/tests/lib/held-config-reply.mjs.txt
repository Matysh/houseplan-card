/** A transport fault fixture, never a fake HA result or product writer.
 * A real config/set reaches HA; its actual result is withheld until release.
 * The negative case sends a deliberately stale CAS revision to the real server.
 * Authentication/other commands/events pass through and are never recorded.
 */
export class HeldConfigReply {
  constructor() { this.pending=null; this.writes=[]; }
  arm({staleRevision=false}={}) {
    if(this.pending) throw new Error('previous held config result is not released');
    let resolve;
    const reached=new Promise(r=>{resolve=r;});
    this.pending={staleRevision,resolve,request:null,reply:null,release:null};
    return reached;
  }
  attach(socket) {
    const server=socket.connectToServer();
    socket.onMessage(raw=>{
      let message;try{message=JSON.parse(String(raw));}catch{server.send(raw);return;}
      if(message.type?.startsWith('houseplan/') && /\/(set|copy|history|delete)$/.test(message.type))
        this.writes.push({type:message.type,id:message.id});
      const pending=this.pending;
      if(message.type==='houseplan/config/set' && pending && !pending.request) {
        pending.request={id:message.id,type:message.type,expectedRev:message.expected_rev};pending.socket=socket;
        if(pending.staleRevision) {
          if(!Number.isSafeInteger(message.expected_rev)||message.expected_rev<1) throw new Error('stale CAS fixture needs an existing positive revision');
          server.send(JSON.stringify({...message,expected_rev:message.expected_rev-1}));return;
        }
      }
      server.send(raw);
    });
    server.onMessage(raw=>{
      let decoded;try{decoded=JSON.parse(String(raw));}catch{socket.send(raw);return;}
      const batch=Array.isArray(decoded),messages=batch?decoded:[decoded],remaining=[];
      for(const message of messages) {
        const pending=this.pending;
        if(pending?.socket===socket && message.type==='result' && message.id===pending.request?.id && !pending.reply) {
          pending.reply={success:message.success,errorCode:message.error?.code};
          const held=JSON.stringify(batch?[message]:message);
          pending.release=()=>socket.send(held);
          pending.resolve({request:{...pending.request},reply:{...pending.reply}});
        } else remaining.push(message);
      }
      if(remaining.length===messages.length)socket.send(raw);
      else if(remaining.length)socket.send(JSON.stringify(batch?remaining:remaining[0]));
    });
  }
  release() {
    const pending=this.pending;
    if(!pending?.release)throw new Error('no real HA reply has reached the hold');
    this.pending=null;pending.release();
  }
}
export async function holdConfigReply(page) {
  const hold=new HeldConfigReply();
  await page.routeWebSocket('**/api/websocket',socket=>hold.attach(socket));
  return hold;
}
