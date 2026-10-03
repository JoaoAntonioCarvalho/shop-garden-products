import { Skeleton } from "@/components/ui/feedback";

/**
 * Esqueleto exibido enquanto a página carrega. Fica só nas rotas que nunca respondem 404: um
 * loading acima de uma página que chama notFound() faria o endereço inexistente responder 200.
 */
export default function StoreLoading() {
  return (
    <div className="container-store pt-6 pb-16" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando
      </p>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-6 h-10 w-72 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-4/5" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
