/**
 * Copia o motor de inferência (ONNX Runtime, WebAssembly) para public/ort, de onde o botão
 * "Padronizar foto" do painel o carrega. Fica no próprio site para a política de conteúdo não
 * precisar liberar scripts de terceiros. Roda antes do dev e do build (não no postinstall: a
 * Vercel pula a instalação quando reaproveita o cache).
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const transformers = createRequire(require.resolve("@huggingface/transformers"));
const dist = path.dirname(transformers.resolve("onnxruntime-web"));
const target = path.join(process.cwd(), "public", "ort");
mkdirSync(target, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"])
  copyFileSync(path.join(dist, file), path.join(target, file));
