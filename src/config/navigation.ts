import { categoryHref, categoryTree, type CategoryNode } from "./category-tree";

export type NavLink = { label: string; href: string };

export type NavItem = NavLink & {
  children?: NavLink[];
  /** Imagem editorial exibida à direita no mega menu. */
  image?: { url: string; alt: string; caption?: string };
  isSecondary?: boolean;
};

export type StoreNavigation = {
  /** Menu principal, na ordem da seção 8.1. */
  main: NavItem[];
  /** Categorias principais, para o rodapé e para páginas vazias. */
  categories: NavLink[];
};

/**
 * Monta o menu a partir das categorias: Plantas naturais, Orquídeas (atalho para a subcategoria,
 * por ser o carro-chefe), demais categorias, Presentes e Novidades.
 */
export function buildNavigation(tree: CategoryNode[]): StoreNavigation {
  const main: NavItem[] = [];

  for (const category of tree) {
    main.push({
      label: category.name,
      href: categoryHref(category.slug),
      isSecondary: category.isSecondary,
      children: category.children?.map((child) => ({
        label: child.name,
        href: categoryHref(`${category.slug}/${child.slug}`),
      })),
    });
    if (
      category.slug === "plantas-naturais" &&
      category.children?.some((c) => c.slug === "orquideas")
    ) {
      main.push({ label: "Orquídeas", href: categoryHref("plantas-naturais/orquideas") });
    }
  }

  main.push({ label: "Presentes", href: "/presentes" });
  main.push({ label: "Novidades", href: "/colecao/novidades" });

  return {
    main,
    categories: tree.map((category) => ({
      label: category.name,
      href: categoryHref(category.slug),
    })),
  };
}

export const defaultNavigation = buildNavigation(categoryTree);

export const footerHelpLinks: NavLink[] = [
  { label: "Ajuda", href: "/ajuda" },
  { label: "Entrega e prazos", href: "/entrega" },
  { label: "Trocas e devoluções", href: "/trocas-e-devolucoes" },
  { label: "Pagamentos", href: "/pagamentos" },
  { label: "Rastrear pedido", href: "/rastreio" },
  { label: "Não encontrou o que procura?", href: "/solicitar-produto" },
];

export const footerInstitutionalLinks: NavLink[] = [
  { label: "Sobre", href: "/sobre" },
  { label: "Avaliações", href: "/avaliacoes" },
  { label: "Política de privacidade", href: "/privacidade" },
  { label: "Política de cookies", href: "/cookies" },
  { label: "Termos de uso", href: "/termos" },
];
