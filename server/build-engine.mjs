import {build} from 'esbuild';
await build({entryPoints:['src/engine/engine.ts'],outfile:'server/engine.mjs',bundle:true,platform:'node',format:'esm',target:'node22'});
