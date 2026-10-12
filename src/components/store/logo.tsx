import { cn } from "@/lib/cn";

type LogoProps = {
  /** Nome da loja, vindo da configuração: é o texto alternativo da imagem. */
  name: string;
  /** Em fundos musgo usa a versão creme, de uma cor só. */
  tone?: "moss" | "cream";
  className?: string;
};

/**
 * Logo da loja: o desenho do site antigo, vetorizado, com "shop" no lugar de "shopping".
 * Os arquivos ficam em public/brand (há também as versões com ".com.br": logo-com-br.svg).
 */
export function Logo({ name, tone = "moss", className }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem ganho com next/image
    <img
      src={tone === "moss" ? "/brand/logo.svg" : "/brand/logo-cream.svg"}
      alt={name}
      width={596}
      height={268}
      className={cn("block h-11 w-auto flex-none self-start md:h-[52px]", className)}
    />
  );
}
