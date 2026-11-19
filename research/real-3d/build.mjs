import {build} from 'esbuild';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
await mkdir('out',{recursive:true});
await build({entryPoints:['viewer.mjs'],outfile:'out/viewer.js',bundle:true,format:'esm',minify:true,sourcemap:true,target:'es2022'});
await build({entryPoints:['scene.mjs'],outfile:'out/scene-node.mjs',bundle:true,platform:'node',format:'esm',target:'es2022'});
// Identical deliberately small capability probes, not whole-package sizes.
const probes={
 three:`import {WebGLRenderer,Scene,OrthographicCamera,BoxGeometry,Mesh,MeshBasicMaterial,Raycaster} from 'three';globalThis.probe={WebGLRenderer,Scene,OrthographicCamera,BoxGeometry,Mesh,MeshBasicMaterial,Raycaster};`,
 babylon:`import {Engine} from '@babylonjs/core/Engines/engine.js';import {Scene} from '@babylonjs/core/scene.js';import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';import {Vector3} from '@babylonjs/core/Maths/math.vector.js';import {CreateBox} from '@babylonjs/core/Meshes/Builders/boxBuilder.js';import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';globalThis.probe={Engine,Scene,FreeCamera,Vector3,CreateBox,StandardMaterial};`,
 playcanvas:`import {Application,Entity,Mesh,StandardMaterial,CameraComponent,RenderComponent} from 'playcanvas';globalThis.probe={Application,Entity,Mesh,StandardMaterial,CameraComponent,RenderComponent};`,
 ogl:`import {Renderer,Camera,Transform,Box,Mesh,Program,Raycast} from 'ogl';globalThis.probe={Renderer,Camera,Transform,Box,Mesh,Program,Raycast};`,
};
const sizes={};
for(const [name,contents] of Object.entries(probes)){
 const r=await build({stdin:{contents,resolveDir:process.cwd(),sourcefile:`${name}-probe.js`},bundle:true,write:false,format:'esm',minify:true,target:'es2022'});
 const bytes=r.outputFiles[0].contents;
 sizes[name]={raw:bytes.length,gzip:gzipSync(bytes,{level:9}).length,scope:'named minimal renderer/camera/mesh/picking imports; capabilities are not identical'};
}
const mvp=await readFile('out/viewer.js');sizes.mvp={raw:mvp.length,gzip:gzipSync(mvp,{level:9}).length};
await writeFile('out/sizes.json',JSON.stringify(sizes,null,2));
console.log(JSON.stringify(sizes));
