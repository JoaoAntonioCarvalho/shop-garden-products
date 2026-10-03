"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toggleWishlistAction } from "@/server/actions/account";

type WishlistContextValue = {
  has: (productId: string) => boolean;
  toggle: (
    productId: string,
    next: boolean,
  ) => Promise<{ ok: boolean; message?: string; needsLogin?: boolean }>;
  count: number;
};

const WishlistContext = createContext<WishlistContextValue>({
  has: () => false,
  toggle: async () => ({
    ok: false,
    needsLogin: true,
    message: "Entre na sua conta para guardar favoritos.",
  }),
  count: 0,
});

export const useWishlist = () => useContext(WishlistContext);

/** Favoritos do cliente logado, para os corações dos cards e o contador do cabeçalho. */
export function WishlistProvider({
  initialIds,
  loggedIn,
  children,
}: {
  initialIds: string[];
  loggedIn: boolean;
  children: ReactNode;
}) {
  const [ids, setIds] = useState(() => new Set(initialIds));

  const toggle = useCallback<WishlistContextValue["toggle"]>(
    async (productId, next) => {
      if (!loggedIn)
        return {
          ok: false,
          needsLogin: true,
          message: "Entre na sua conta para guardar favoritos.",
        };
      const result = await toggleWishlistAction(productId, next);
      if (result.ok) {
        setIds((current) => {
          const updated = new Set(current);
          if (next) updated.add(productId);
          else updated.delete(productId);
          return updated;
        });
      }
      return result;
    },
    [loggedIn],
  );

  const value = useMemo(
    () => ({ has: (productId: string) => ids.has(productId), toggle, count: ids.size }),
    [ids, toggle],
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
