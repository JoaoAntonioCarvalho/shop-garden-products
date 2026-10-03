import { cn } from "@/lib/cn";

type LogoProps = {
  /** Nome da loja, vindo da configuração. */
  name: string;
  /** Em fundos musgo usa creme. */
  tone?: "moss" | "cream";
  className?: string;
};

/**
 * Logotipo provisório em texto, com uma folha de traço fino.
 * Para trocar pelo logo definitivo, substitua este componente e public/brand/logo.svg.
 */
// TODO(dono): enviar o logo definitivo
export function Logo({ name, tone = "moss", className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-serif text-[24px] leading-none font-semibold whitespace-nowrap md:text-[27px]",
        tone === "moss" ? "text-moss-700" : "text-cream-50",
        className,
      )}
    >
      <svg
        viewBox="0 0 32 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-[1.15em] w-auto flex-none"
      >
        <path d="M5 34C5 20 13 9 27 6c1 14-7 25-22 28Z" />
        <path d="M5 34c5-10 11-17 18-23" />
      </svg>
      {name}
    </span>
  );
}
