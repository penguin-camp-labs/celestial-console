// A client-only static build: observation inputs never enter a server renderer.
const load = (name: string) => import(import.meta.resolve(name));
export default async function config() {
  const [{ default: tailwindcss }, { default: react }] = await Promise.all([
    load('@tailwindcss/postcss'),
    load('@vitejs/plugin-react'),
  ]);
  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    resolve: {
      preserveSymlinks: true,
      alias: { '@': process.cwd().replaceAll('\\', '/') },
    },
    server: {
      host: '127.0.0.1',
      port: 3000,
      watch: { usePolling: true, interval: 500 },
    },
    build: { outDir: 'dist/client', emptyOutDir: true, sourcemap: false },
    plugins: [react()],
  };
}
