"""Sequential CPU comparison; run once per source root in a fresh process.

Generate inputs with benchmark-node-save.mjs. This measures production node
CPU validators, not Store/network/HA executor or client time. No cProfile.
The root may be a read-only git-archive of the pinned baseline.
"""
import argparse
import hashlib
import json
import math
import statistics
import sys
import time
import types
from contextlib import nullcontext
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--root',type=Path,required=True)
parser.add_argument('--inputs',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--samples',type=int,default=5)
parser.add_argument('--optimized',action='store_true')
parser.add_argument('--warm-schema',action='store_true')
args=parser.parse_args()
for name,path in [('custom_components',args.root/'custom_components'),('custom_components.houseplan',args.root/'custom_components/houseplan')]:
    module=types.ModuleType(name);module.__path__=[str(path)];sys.modules[name]=module
from custom_components.houseplan.validation import CONFIG_SCHEMA,validate_opening_passages,validate_partition_opening_hosts,validate_wall_model_transition
from custom_components.houseplan.wall_node_move import node_move_candidate,node_move_host_baseline
from custom_components.houseplan.junction_limits import validate_junction_limits
if args.optimized:
    from custom_components.houseplan.graph_validation_scope import graph_validation_scope
    from custom_components.houseplan.validation import ordinary_write_scope,validate_scoped_candidate
records=[]
for size in [100,1000,5000]:
    message=json.loads((args.inputs/f'{size}.json').read_text())
    previous=CONFIG_SCHEMA(message['config'])
    operation=(previous,message['space_id'],message['intent'],message['direction'],None)
    samples=[]
    for sample in range(args.samples+1):
        stages={}
        def timed(name,call):
            start=time.perf_counter();result=call();stages[name]=(time.perf_counter()-start)*1000;return result
        start=time.perf_counter()
        with graph_validation_scope() if args.optimized else nullcontext():
            kwargs={'trusted_current':args.warm_schema} if args.optimized else {}
            candidate=timed('node_candidate',lambda:node_move_candidate(*operation,**kwargs))
            scoped=ordinary_write_scope(candidate,previous) if args.optimized and args.warm_schema else None
            timed('transition',lambda:validate_wall_model_transition(candidate,previous,**({'touched':scoped.touched_spaces} if scoped is not None else {})))
            candidate=timed('schema',lambda:validate_scoped_candidate(candidate,previous,scoped) if scoped is not None else CONFIG_SCHEMA(candidate))
            timed('passages',lambda:validate_opening_passages(candidate,previous))
            proved=timed('host_lineage',lambda:node_move_host_baseline(previous,candidate,*operation[1:],**kwargs))
            timed('hosts',lambda:validate_partition_opening_hosts(candidate,proved))
            timed('junction_cold',lambda:validate_junction_limits(candidate,previous))
        elapsed=(time.perf_counter()-start)*1000
        digest=hashlib.sha256(json.dumps(candidate,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        if sample:samples.append(dict(ms=elapsed,stages=stages,acceptedSha256=digest))
    values=sorted(row['ms'] for row in samples)
    record=dict(edges=size,medianMs=statistics.median(values),p95Ms=values[math.ceil(len(values)*.95)-1],samples=samples)
    records.append(record);print(json.dumps(record),flush=True)
args.out.parent.mkdir(parents=True,exist_ok=True)
args.out.write_text(json.dumps(dict(root=str(args.root),optimized=args.optimized,warmSchema=args.warm_schema,records=records),indent=2)+'\n')
