import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {brotliCompressSync,brotliDecompressSync,gzipSync,gunzipSync} from 'node:zlib';
import {server} from './index.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const fixture=fs.mkdtempSync(path.join(root,'compression-test-'));
const bytes=Buffer.from('WebAssembly payload '.repeat(5000));
const asset='fortune-0123456789ab.wasm';
fs.writeFileSync(path.join(fixture,asset),bytes);
fs.writeFileSync(path.join(fixture,asset+'.br'),brotliCompressSync(bytes));
fs.writeFileSync(path.join(fixture,asset+'.gz'),gzipSync(bytes));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const request=(encoding,method='GET')=>new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:`/${path.basename(fixture)}/${asset}`,method,headers:{'Accept-Encoding':encoding}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({headers:res.headers,status:res.statusCode,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();
});
test('serves identical WebAssembly with negotiated Brotli, gzip, identity and HEAD',async()=>{
 const br=await request('br, gzip');
 assert.equal(br.status,200);assert.equal(br.headers['content-type'],'application/wasm');
 assert.equal(br.headers['content-encoding'],'br');assert.equal(br.headers.vary,'Accept-Encoding');
 assert.match(br.headers['cache-control'],/immutable/);assert.deepEqual(brotliDecompressSync(br.body),bytes);
 const gz=await request('br;q=0, gzip;q=1');assert.equal(gz.headers['content-encoding'],'gzip');assert.deepEqual(gunzipSync(gz.body),bytes);
 const plain=await request('br;q=0, gzip;q=0');assert.equal(plain.headers['content-encoding'],undefined);assert.deepEqual(plain.body,bytes);
 const head=await request('br','HEAD');assert.equal(head.body.length,0);assert.equal(head.headers['content-length'],br.headers['content-length']);
});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(fixture,{recursive:true});});
