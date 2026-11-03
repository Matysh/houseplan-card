/** Exact bundled producer coverage; a cold positive is required by callers.
 * This is a correctness pass only. Timing samples run with coverage disabled.
 */
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {posix} from 'node:path';
export function bundledProducers(root) {
 const physical=[],constructors=[],modules=new Map(),producerCalls=[];
 const walk=dir=>{for(const e of readdirSync(root+'/'+dir,{withFileTypes:true})){
  const relative=dir?dir+'/'+e.name:e.name;if(e.isDirectory())walk(relative);else if(e.name.endsWith('.js')){
   const code=readFileSync(root+'/'+relative,'utf8'),file=ts.createSourceFile(relative,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
   const label=name=>name?.text??name?.getText(file);
   const imports=new Map(),exports=new Map();modules.set(relative,{imports,exports});
   for(const node of file.statements){
    if(ts.isImportDeclaration(node)&&node.importClause?.namedBindings&&ts.isNamedImports(node.importClause.namedBindings))
     for(const item of node.importClause.namedBindings.elements)imports.set(item.name.text,{module:posix.normalize(posix.join(posix.dirname(relative),node.moduleSpecifier.text)),name:item.propertyName?.text??item.name.text});
    if(ts.isExportDeclaration(node)&&node.exportClause&&ts.isNamedExports(node.exportClause))
     for(const item of node.exportClause.elements)exports.set(item.name.text,item.propertyName?.text??item.name.text);
   }
   const functionLike=n=>ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n);
   const seen=new Set();
   const visit=node=>{
    // The actual saved-floor producer is the function invoked by the public
    // card's physical cache. Direct analytic helpers share the result shape.
    if(ts.isMethodDeclaration(node)&&label(node.name)==='_physicalBodiesR'){
     const calls=n=>{if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression))producerCalls.push({relative,name:n.expression.text});ts.forEachChild(n,calls);};calls(node);
    }
    if(ts.isObjectLiteralExpression(node)){
     const names=node.properties.map(p=>label(p.name));
     if(['partitions','columns','patches','all'].every(n=>names.includes(n))){
      let fn=node.parent;while(fn&&!functionLike(fn))fn=fn.parent;
      if(fn&&!seen.has(fn.pos)){seen.add(fn.pos);physical.push({relative,name:label(fn.name),start:fn.getStart(file),bodyStart:fn.body?.getStart(file),end:fn.end});}
     }
    }
    if(ts.isClassDeclaration(node)||ts.isClassExpression(node)){
     const names=node.members.map(m=>label(m.name));
     if(['prepare','render'].every(n=>names.includes(n)) && node.members.find(ts.isConstructorDeclaration)?.getText(file).includes('this.staticExtras')){
      const ctor=node.members.find(ts.isConstructorDeclaration);if(!ctor)throw Error('constructor missing');
      constructors.push({relative,name:label(node.name),start:ctor.getStart(file),bodyStart:ctor.body?.getStart(file),classStart:node.getStart(file),end:ctor.end});
     }
    }
    ts.forEachChild(node,visit);
   };visit(file);
  }
 }};walk('');
 const resolve=(relative,name,seen=new Set())=>{
  const key=relative+':'+name;if(seen.has(key))return key;seen.add(key);
  const mod=modules.get(relative),imported=mod?.imports.get(name);
  if(imported){const exported=modules.get(imported.module)?.exports.get(imported.name)??imported.name;return resolve(imported.module,exported,seen);}
  return key;
 };
 const called=new Set(producerCalls.map(call=>resolve(call.relative,call.name)));
 const selected=physical.filter(fn=>called.has(resolve(fn.relative,fn.name)));
 if(selected.length!==1)throw Error('ambiguous/missing physicalBodyParts cache callsite: '+JSON.stringify({physical,selected}));
 if(constructors.length>1)throw Error('ambiguous crop constructor');
 return {physical:selected[0],constructor:constructors[0]??null};
}
export function callsFor(coverage,target){
 if(!target)return 0;
 const scripts=coverage.filter(script=>{try{return new URL(script.url).pathname==='/assets/'+target.relative;}catch{return false;}});
 const functions=scripts.flatMap(s=>s.functions).filter(fn=>{
  const start=fn.ranges[0]?.startOffset;return start===target.start||start===target.classStart
   || fn.functionName===target.name&&start>=target.start&&start<=target.bodyStart;
 });
 if(functions.length>1)throw Error('ambiguous covered function '+target.name);
 return functions.reduce((n,fn)=>n+(fn.ranges[0]?.count??0),0);
}