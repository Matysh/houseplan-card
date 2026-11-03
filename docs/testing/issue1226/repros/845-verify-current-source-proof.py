import json, pathlib, collections,hashlib,base64,math,gzip,sys
from fractions import Fraction as F
# Usage: python3 this.py SAVED_DATASET PROOF_JSON_GZ OUTPUT_DIRECTORY
BASE=pathlib.Path(sys.argv[1]); PKG=json.loads(gzip.decompress(pathlib.Path(sys.argv[2]).read_bytes())); OWN=pathlib.Path(sys.argv[3]); OWN.mkdir(parents=True,exist_ok=True)
for name in ['inputs.jsonl','typescript.jsonl']:
 assert hashlib.sha256((BASE/name).read_bytes()).hexdigest()==PKG['externalEvidenceSha256'][name], 'independent saved evidence hash mismatch: '+name
load=lambda p:[json.loads(x)for x in p.read_text().splitlines()]
inputs=load(BASE/'inputs.jsonl'); outputs={x['index']:x for x in load(BASE/'typescript.jsonl')};maps={x['index']:dict(x['mappings']) for x in PKG['mappings']}
def q(v):
 v=float(v); n=math.floor(v*240+0.5)
 return F(n,240) if v==n/240 else F(str(v))
def pt(v):return tuple(q(x)for x in v[:2])
def gp(p):return (F(int(p[1]),240),F(int(p[2]),240))if p[0]=='l'else(F(int(p[1]),int(p[2])),F(int(p[3]),int(p[4])))
def at(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
def dist2(a,b):return sum((x-y)**2 for x,y in zip(a,b))
def param(p,a,b):return sum((x-u)*(v-u)for x,u,v in zip(p,a,b))/dist2(a,b)
def pair(a,b):return tuple(sorted([pt(a),pt(b)]))
def hid(space,a,b,owners):
 key=lambda p:','.join(format(float(v),'.12f')for v in p)
 a,b=sorted([a,b],key=key);text=space+'|'+key(a)+'|'+key(b)+'|'+','.join(sorted(owners))
 return 'wall-'+base64.b32encode(hashlib.sha256(text.encode()).digest()).decode().lower()[:20]
def rawpoly(r):
 if r.get('poly'):return r['poly']
 return [[r['x'],r['y']],[r['x']+r['w'],r['y']],[r['x']+r['w'],r['y']+r['h']],[r['x'],r['y']+r['h']]]
def sources(s):
 out={};roomonly={};boundary={};rawpoints={}
 def add(k,r,generated=False):
  a,b=pt(r['a']),pt(r['b']);rev=a>b
  out[k+':'+r['id']]={'kind':k,'id':r['id'],'a':min(a,b),'b':max(a,b),'reversed':rev,'raw':r,'generated':generated}
 for k,key in [('wall','wall_segments'),('partition','partitions')]:
  for r in s.get(key,[]):add(k,r)
 used={x.get('id')for key in ['rooms','openings','decor','partitions','wall_columns','wall_segments','stairs','room_drafts']for x in s.get(key,[])}
 for d in s.get('room_drafts',[]):
  for i,seg in enumerate(d['segments']):
   a,b=d['points'][i:i+2];id=seg.get('id')
   if not id or id in used:
    base=hid(str(s['id']),a,b,['draft:'+str(d.get('id',''))+':'+str(i)]);id=base;n=2
    while id in used:id=base+'-'+str(n);n+=1
   used.add(id);add('partition',{'id':id,'a':a,'b':b,'cm':seg['cm']})
 for r in s.get('rooms',[]):
  p=rawpoly(r);boundary[r['id']]=[]
  for i,a in enumerate(p):
   b=p[(i+1)%len(p)];key=pair(a,b);preferred=(r.get('wall_ids')or[])[i]if i<len(r.get('wall_ids')or[])else None
   existing='wall:'+preferred if preferred and 'wall:'+preferred in out else next((k for k,v in out.items()if v['kind']=='wall'and (v['a'],v['b'])==key),None)
   if not existing:
    row=roomonly.setdefault(key,{'a':a,'b':b,'owners':[],'preferred':[]});row['owners'].append(r['id'])
    if preferred:row['preferred'].append(preferred)
   boundary[r['id']].append({'a':pt(a),'b':pt(b),'key':key,'source':existing})
 for key,v in roomonly.items():
  base=min(v['preferred'])if v['preferred']else hid(str(s['id']),v['a'],v['b'],v['owners']);id=base;n=2
  while 'wall:'+id in out:id=base+'-'+str(n);n+=1
  add('wall',{'id':id,'a':v['a'],'b':v['b'],'cm':None},True)
  for bs in boundary.values():
   for b in bs:
    if b['source']is None and b['key']==key:b['source']='wall:'+id
 return out,boundary
errors=[];stats=collections.Counter();detail=[];widths=[]
for row in inputs:
 saved=outputs[row['index']]
 if not saved['ok']:continue
 cfg=row['input'];ledger={'index':row['index'],'label':row['label'],'checks':collections.Counter(),'errors':[]}
 def check(ok,code,**ctx):
  ledger['checks'][code]+=1
  if not ok:ledger['errors'].append({'code':code,**ctx})
 check(collections.Counter(s['id']for s in cfg['spaces'])==collections.Counter(s['id']for s in saved['config']['spaces']),'complete-space-ID-multiset')
 for s in cfg['spaces']:
  t=next(x for x in saved['config']['spaces']if x['id']==s['id']);g=t['plan_graph'];nodes={n['id']:gp(n['p'])for n in g['nodes']};edges={e['kind']+':'+e['id']:e for e in g['edges']}
  if cfg.get('model_version')==11:check(s['plan_graph']==g,'current-graph-exact',space=s['id']);continue
  check(collections.Counter(x['id']for x in s.get('rooms',[]))==collections.Counter(x['id']for x in t.get('rooms',[])),'projected-room-ID-multiset')
  check(collections.Counter(x['id']for x in s.get('openings',[]))==collections.Counter(x['id']for x in t.get('openings',[])),'opening-ID-multiset')
  src,bound=sources(s);expectedProps={key:{}for key in edges};targetOwners={key:[]for key in edges};m=maps.get(row['index'],{}).get(s['id'])
  if m is None:
   m={'edges':{key:[{'ref':{'kind':v['kind'],'id':v['id']},'sourceInterval':[['0','1'],['1','1']],'reverse':False}]for key,v in src.items()},'hosts':{}}
  R=min(F(1,1200000),F(1,10)/(240*q(s.get('cell_cm')or 5)));covered=set()
  check(set(m['edges'])==set(src),'complete-source-set',space=s['id'],extra=list(set(m['edges'])-set(src)),missing=list(set(src)-set(m['edges'])))
  for key,ranges in m['edges'].items():
   if key not in src:continue
   v=src[key];last=F(0);previous=None
   for rr in ranges:
    lo,hi=[F(int(x[0]),int(x[1]))for x in rr['sourceInterval']];ref=rr['ref']['kind']+':'+rr['ref']['id'];e=edges.get(ref);check(e is not None,'mapped-edge-exists',source=key,target=ref)
    if not e:continue
    covered.add(ref);targetOwners[ref].append(key);check(lo>=last and hi>lo,'ordered-source-intervals',source=key)
    p0,p1=nodes[e['from']],nodes[e['to']]
    if rr['reverse']:p0,p1=p1,p0
    if lo!=last:
     # A removed microscopic source interval is legal only when BOTH ends
     # resolve to the SAME exact output node and each ORIGINAL end is in R.
     first=m.get('nodes',{}).get(json.dumps([v['kind'],v['id'],0],separators=(',',':')),[])
     left=previous if previous is not None else (nodes[first[0]] if len(first)==1 else None)
     check(left==p0 and dist2(p0,at(v['a'],v['b'],last))<=R*R and dist2(p0,at(v['a'],v['b'],lo))<=R*R,'collapsed-gap-single-node-R',source=key)
    last=hi;previous=p1
    check(dist2(p0,at(v['a'],v['b'],lo))<=R*R and dist2(p1,at(v['a'],v['b'],hi))<=R*R,'raw-source-R-bound',source=key,target=ref)
    props={k:x for k,x in v['raw'].items()if k not in ['id','a','b','cm']};expectedProps[ref].update(props)
    check(all(e.get('props',{}).get(k)==x for k,x in props.items()),'opaque-source-fields',source=key,target=ref)
    # Source model9/10 catalogue and all partition widths are authoritative.
    if v['kind']=='partition'or (cfg.get('model_version',0)>=9 and not v['generated']):check(e['cm']==v['raw'].get('cm',0),'authoritative-width',source=key,target=ref)
    else:
     legal={v['raw'].get('cm') or 0}
     for overlay in s.get('walls',[]):
      if 'a'in overlay and 'b'in overlay:
       oa,ob=pt(overlay['a']),pt(overlay['b'])
       if oa==ob:continue
       ts=[param(p,oa,ob)for p in [p0,p1]]
       if min(ts)>=-R and max(ts)<=1+R and all(dist2(p,at(oa,ob,u))<=R*R for p,u in zip([p0,p1],ts)):legal.add(overlay.get('cm',0))
      elif overlay.get('key')=='0.500000,0.000000@0.0000' and v['a']==(F(0),F(0)) and v['b']==(F(1),F(0)):legal.add(overlay.get('cm',0))
     # Zero is allowed by the source width default; positive widths need a covering raw overlay.
     check(e['cm']in legal,'legacy-overlay-width-provenance',source=key,target=ref,actual=e['cm'],legal=sorted(legal));widths.append({'index':row['index'],'space':s['id'],'source':key,'target':ref,'a':[str(x)for x in p0],'b':[str(x)for x in p1],'cm':e['cm']})
   if last!=1:
    final=m.get('nodes',{}).get(json.dumps([v['kind'],v['id'],1],separators=(',',':')),[])
    check(len(final)==1 and previous==nodes[final[0]] and dist2(previous,v['b'])<=R*R,'collapsed-tail-single-node-R',source=key)
   else:check(True,'complete-unit-interval',source=key)
  for ek,e in edges.items():
   check(e.get('props',{})==expectedProps[ek],'complete-opaque-union',target=ek)
   owners=targetOwners[ek];owner=min(owners);sid=src[owner]['id'];ident=e['id'];lineage=ident==sid
   if ident.startswith(sid+'~'):lineage=ident[len(sid)+1:].isdigit()and int(ident[len(sid)+1:])>0
   if not lineage and len(sid)>62:
    for rr in m['edges'][owner]:
     if rr['ref']!={'kind':e['kind'],'id':ident}:continue
     for i in range(1,len(g['nodes'])+1):
      seed=json.dumps([e['kind'],sid,i,*rr['sourceInterval']],separators=(',',':'));candidate='s:'+base64.b32encode(hashlib.sha256(seed.encode()).digest()).decode().lower().rstrip('=')[:52]
      if ident==candidate:lineage=True;break
   check(lineage,'canonical-source-ID-lineage',source=owner,target=ek)
  check(covered==set(edges),'complete-output-edge-coverage',space=s['id'],uncovered=list(set(edges)-covered))
  rooms={r['room']:r for r in g['rooms']};check(collections.Counter(r['room']for r in g['rooms'])==collections.Counter(r['id']for r in s.get('rooms',[])),'complete-room-identity',space=s['id'])
  for rid,bs in bound.items():
   want=[]
   for b in bs:
    v=src[b['source']];start,end=param(b['a'],v['a'],v['b']),param(b['b'],v['a'],v['b']);lo,hi=min(start,end),max(start,end);ran=[x for x in m['edges'][b['source']]if F(*map(int,x['sourceInterval'][1]))>lo and F(*map(int,x['sourceInterval'][0]))<hi]
    if start>end:ran=list(reversed(ran))
    want.extend({**x['ref'],'reverse':x['reverse'] if start<end else not x['reverse']}for x in ran)
   want=[x for i,x in enumerate(want)if i==0 or (x['kind'],x['id'])!=(want[i-1]['kind'],want[i-1]['id'])]
   check(rooms.get(rid,{}).get('edges')==want,'ordered-room-cycle',room=rid)
  for old in s.get('openings',[]):
   new=next(x for x in t.get('openings',[])if x['id']==old['id']);h=new.get('host')
   if not h:
    oldh=old.get('host',{});check(not(oldh.get('kind')=='partition'and 'partition:'+oldh.get('id','')in src),'preserved-existing-partition-host',opening=old['id']);continue
   target=h['kind']+':'+h['id'];hostq=F(*map(int,h['tq'])) if h.get('tq')else q(h['t'])
   candidates=[]
   for key,ranges in m['edges'].items():
    for rr in ranges:
     if rr['ref']=={'kind':h['kind'],'id':h['id']}:
      lo,hi=[F(*map(int,x))for x in rr['sourceInterval']];sourceq=lo+(hi-lo)*(1-hostq if rr['reverse']else hostq);v=src[key]
      if old.get('host',{}).get('kind')=='partition' and key=='partition:'+old['host']['id']:
       oq=F(*map(int,old['host']['tq']))if old['host'].get('tq')else q(old['host']['t']);oq=1-oq if v['reversed']else oq
       good=oq==sourceq
      else:good=v['kind']=='wall'and dist2(pt([old['x'],old['y']]),at(v['a'],v['b'],sourceq))<=R*R
      if good:candidates.append(key)
   check(bool(candidates),'exact-host-source-parameter',opening=old['id'],target=target)
 detail.append(ledger);stats.update(ledger['checks'])
 if ledger['errors']:errors.append({'index':row['index'],'label':row['label'],'errors':ledger['errors']})
(OWN/'legacy-width-rows.json').write_text(json.dumps(widths,indent=2))
(OWN/'ownership-ledger.json').write_text(json.dumps(detail,indent=2))
summary={'documents':len(detail),'checks':stats,'failedDocuments':len(errors),'failedChecks':sum(len(x['errors'])for x in errors),'errors':errors};(OWN/'ownership-summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items()if k!='errors'},indent=2));print(json.dumps(errors[:4],indent=2)[:10000])
if errors:raise SystemExit(1)
