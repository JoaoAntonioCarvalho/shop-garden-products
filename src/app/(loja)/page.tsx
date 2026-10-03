import { storeConfig } from "@/config/store.config";

// Home provisória. As seções configuráveis entram na fase 3.
export default function Home() {
  return (
    <div className="container-store section-y">
      <h1 className="type-h1 text-moss-900">{storeConfig.name}</h1>
      <p className="mt-4 measure type-body-lg text-ink-muted">{storeConfig.tagline}.</p>
    </div>
  );
}
