import sys,json,time,cProfile,pstats,types
from pathlib import Path
root=Path.cwd()
for name,path in [('custom_components',root/'custom_components'),('custom_components.houseplan',root/'custom_components/houseplan')]:
    module=types.ModuleType(name);module.__path__=[str(path)];sys.modules[name]=module
from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import CONFIG_SCHEMA,validate_opening_passages,validate_partition_opening_hosts,validate_wall_model_transition
from custom_components.houseplan.wall_node_move import node_move_candidate,node_move_host_baseline
def execute(message):
    previous=message['config'];args=(previous,message['space_id'],message['intent'],message['direction'],None); rows=[]
    def timed(name,call):
        start=time.perf_counter();out=call();rows.append(dict(stage=name,ms=round((time.perf_counter()-start)*1000,3)));return out
    candidate=timed('node_move_candidate',lambda:node_move_candidate(*args))
    timed('wall_model_transition',lambda:validate_wall_model_transition(candidate,previous))
    candidate=timed('CONFIG_SCHEMA',lambda:CONFIG_SCHEMA(candidate))
    timed('opening_passages',lambda:validate_opening_passages(candidate,previous))
    proved=timed('host_lineage_baseline',lambda:node_move_host_baseline(previous,candidate,*args[1:]))
    timed('opening_hosts',lambda:validate_partition_opening_hosts(candidate,proved))
    timed('junction_limits_cold',lambda:validate_junction_limits(candidate,previous))
    return rows
results=[]
for size in [100,1000,5000]:
    data=json.loads(Path(f'artifacts/1305/ordinary-{size}.json').read_text())
    rows=execute(data);results.append(dict(edges=size,totalMs=round(sum(r['ms'] for r in rows),3),stages=rows))
    print(json.dumps(results[-1]),flush=True)
prof=cProfile.Profile();prof.enable();execute(data);prof.disable();prof.dump_stats('artifacts/1305/ordinary-5000.prof')
stats=pstats.Stats(prof)
functions=[]
for (file,line,name),(primitive,calls,self_s,cum_s,callers) in stats.stats.items():
    if 'custom_components/houseplan' not in file:continue
    functions.append(dict(file=file.split('houseplan/')[-1],line=line,function=name,calls=calls,selfMs=round(self_s*1000,2),cumulativeMs=round(cum_s*1000,2),callers=[dict(function=k[2],file=k[0].split('houseplan/')[-1],line=k[1],calls=v[1]) for k,v in callers.items()]))
functions.sort(key=lambda x:x['cumulativeMs'],reverse=True)
Path('artifacts/1305/ordinary-profile.json').write_text(json.dumps(dict(measurements=results,profile=functions),indent=2))
print(json.dumps(functions[:12]),flush=True)

# Low-overhead attribution without cProfile's per-Fraction-call overhead.
import hashlib
from custom_components.houseplan import plan_graph,wall_node_move
counts=[]
def instrument(original,name):
    def wrapped(*args,**kwargs):
        start=time.perf_counter()
        try:return original(*args,**kwargs)
        finally:
            elapsed=(time.perf_counter()-start)*1000
            graph=args[0] if name=='validate_graph' else None
            fingerprint=hashlib.sha256(json.dumps(graph,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:12] if graph is not None else None
            counts.append(dict(function=name,ms=round(elapsed,3),graph=fingerprint))
    for module in list(sys.modules.values()):
        if not getattr(module,'__name__','').startswith('custom_components.houseplan'):continue
        for key,value in list(vars(module).items()):
            if value is original:setattr(module,key,wrapped)
instrument(plan_graph.validate_graph,'validate_graph')
instrument(wall_node_move._nodes,'legacy_all_pair_nodes')
execute(data)
Path('artifacts/1305/ordinary-calls.json').write_text(json.dumps(counts,indent=2))
print(json.dumps(counts),flush=True)
