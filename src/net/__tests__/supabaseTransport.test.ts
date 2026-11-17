import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), removeChannel: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: () => {
      const ch = { on: vi.fn(() => ch), subscribe: mocks.subscribe };
      return ch;
    },
    removeChannel: mocks.removeChannel,
  }),
}));

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });

it('libère le canal et signale une erreur si le serveur ne répond jamais', async () => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test');
  const { SupabaseTransport } = await import('../supabaseTransport');
  const transport = new SupabaseTransport('ABCDE', 'player');
  const result = expect(transport.connect()).rejects.toThrow('Connexion au serveur impossible');
  await vi.advanceTimersByTimeAsync(10000);
  await result;
  expect(mocks.removeChannel).toHaveBeenCalledOnce();
});
