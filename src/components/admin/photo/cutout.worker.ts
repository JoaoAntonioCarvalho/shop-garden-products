/**
 * Recorte do fundo da foto, fora da tela principal para o painel não travar. O modelo (BEN2,
 * licença MIT) roda no próprio navegador: pela placa de vídeo (WebGPU) quando há, senão em
 * WebAssembly. O arquivo do modelo é baixado uma vez e fica guardado no navegador.
 */
import { env, pipeline, RawImage, type ProgressInfo } from "@huggingface/transformers";

const MODEL = "onnx-community/BEN2-ONNX";
// Versão fixa do modelo: uma mudança no repositório não altera o resultado sem revisão.
const REVISION = "c552aa82688edce09f0ac9d2e31ad53d9d629010";

export type CutoutRequest = { image: Blob };
export type CutoutMessage =
  | { type: "progress"; stage: "download"; percent: number }
  | { type: "progress"; stage: "cutout" }
  | { type: "done"; width: number; height: number; data: Uint8ClampedArray }
  | { type: "error"; message: string };

env.allowLocalModels = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = "/ort/";
  env.backends.onnx.wasm.numThreads = 1;
}

type Segmenter = (image: RawImage) => Promise<RawImage[]>;
let ready: Promise<Segmenter> | null = null;

const post = (message: CutoutMessage, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(message, transfer);

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return Boolean(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function load(device: "webgpu" | "wasm"): Promise<Segmenter> {
  const segmenter = await pipeline("background-removal", MODEL, {
    device,
    revision: REVISION,
    progress_callback: (info: ProgressInfo) => {
      if (info.status === "progress" && info.file.endsWith(".onnx"))
        post({ type: "progress", stage: "download", percent: Math.round(info.progress) });
    },
  });
  return segmenter as unknown as Segmenter;
}

async function cutout(image: Blob): Promise<RawImage> {
  const input = await RawImage.fromBlob(image);
  const gpu = await hasWebGpu();
  ready ??= load(gpu ? "webgpu" : "wasm");
  try {
    const segmenter = await ready;
    post({ type: "progress", stage: "cutout" });
    return (await segmenter(input))[0];
  } catch (error) {
    ready = null;
    if (!gpu) throw error;
    // A placa de vídeo não deu conta: tenta de novo em WebAssembly, mais lento.
    ready = load("wasm");
    const segmenter = await ready;
    post({ type: "progress", stage: "cutout" });
    return (await segmenter(input))[0];
  }
}

self.onmessage = async (event: MessageEvent<CutoutRequest>) => {
  try {
    const output = await cutout(event.data.image);
    const data = new Uint8ClampedArray(output.rgba().data);
    post({ type: "done", width: output.width, height: output.height, data }, [data.buffer]);
  } catch (error) {
    ready = null;
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
