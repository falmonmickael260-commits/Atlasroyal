import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, host: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // three.js n'est chargé qu'à l'entrée en partie : on l'isole pour que
        // l'accueil et le salon s'affichent sans l'attendre.
        manualChunks: { three: ['three', '@react-three/fiber'] },
      },
    },
  },
});
