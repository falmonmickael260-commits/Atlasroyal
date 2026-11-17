import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
const root = fileURLToPath(new URL('../', import.meta.url));
test('malformed JSON values close only their socket and leave other rooms running', async () => {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {server} from './server/index.mjs';server.listen(0,'127.0.0.1',()=>console.log(server.address().port));",
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server startup timeout: ' + stderr)), 4000);
      child.stdout.once('data', (chunk) => {
        clearTimeout(timer);
        resolve(Number(String(chunk).trim()));
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(Error(stderr));
      });
    });
    const connect = (packet) =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        ws.once('open', () => ws.send(JSON.stringify(packet)));
        ws.once('message', (raw) => resolve({ ws, message: JSON.parse(raw) }));
        ws.once('close', () => reject(Error('Closed without a response: ' + stderr)));
        ws.once('error', reject);
      });
    for (const packet of [null, [], 42, {}]) {
      const result = await connect(packet);
      assert.equal(result.message.type, 'error');
      result.ws.close();
    }
    const healthy = await connect({ type: 'connect', code: 'ABCDE', id: 'host', host: true });
    assert.equal(healthy.message.type, 'ready');
    healthy.ws.close();
  } finally {
    child.kill();
    await once(child, 'exit').catch(() => {});
  }
});
