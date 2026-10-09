// "server-only" lança erro fora do servidor do Next. Nos scripts de linha de comando ele já entra
// carregado e vazio, como nos testes (vitest.config.ts).
const file = require.resolve("server-only");
require.cache[file] = {
  id: file,
  filename: file,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
};
