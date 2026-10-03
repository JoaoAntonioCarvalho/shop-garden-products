// Substituto de "next/cache" nos testes: sem servidor do Next não há cache para usar nem invalidar.
export const unstable_cache =
  <Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) =>
  (...args: Args) =>
    fn(...args);
export const revalidateTag = () => undefined;
export const updateTag = () => undefined;
export const revalidatePath = () => undefined;
