import fs from 'node:fs';
import path from 'node:path';
import {brotliCompressSync, gzipSync, constants} from 'node:zlib';
const root=path.resolve(process.argv[2]||'dist');
let before=0,after=0;
function compress(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){compress(file);continue;}
  if(!/\.(wasm|pck|js|css|svg|json|html)$/.test(file))continue;
  const bytes=fs.readFileSync(file);if(bytes.length<1024)continue;
  const br=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:6}});
  const gz=gzipSync(bytes,{level:9});
  if(br.length<bytes.length)fs.writeFileSync(file+'.br',br);
  if(gz.length<bytes.length)fs.writeFileSync(file+'.gz',gz);
  before+=bytes.length;after+=Math.min(bytes.length,br.length);
 }
}
compress(root);
console.log(`Static assets: ${(before/1e6).toFixed(1)} MB → ${(after/1e6).toFixed(1)} MB with Brotli`);
