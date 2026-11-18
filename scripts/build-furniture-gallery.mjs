import {rollup} from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import {sourceFingerprint} from './source-fingerprint.mjs';
import {buildFingerprintPlugin} from './bundle-manifest.mjs';
import {generateVolume} from './generate-furniture-volume.mjs';
generateVolume(undefined,true);
const bundle=await rollup({input:'src/furniture-gallery-entry.ts',plugins:[resolve(),
 typescript({compilerOptions:{outDir:'demo/ui-lab/gallery-dist/.ts'}}),
 buildFingerprintPlugin(sourceFingerprint()),terser()]});
try{await bundle.write({dir:'demo/ui-lab/gallery-dist',format:'es',entryFileNames:'entry.js',chunkFileNames:'chunks/[name]-[hash].js'});}
finally{await bundle.close();}
console.log('Standalone gallery built from shared renderer.');process.exit(0);
