"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getImageProps } from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BotanicalCaption } from "@/components/store/botanical-sheet";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { BannerData } from "@/server/services/content";

type HeroProps = { banners: BannerData[]; whatsapp: string };

function HeroImage({ banner, priority }: { banner: BannerData; priority: boolean }) {
  const desktop = banner.imageDesktop;
  const mobile = banner.imageMobile ?? desktop;
  if (!desktop || !mobile) return <div className="aspect-4/5 bg-cream-100 md:aspect-16/7" />;

  const common = { alt: desktop.alt, sizes: "100vw", priority };
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: desktop.url, width: 2400, height: 1050 });
  const { props: mobileProps } = getImageProps({
    ...common,
    src: mobile.url,
    width: 1200,
    height: 1500,
  });

  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- o alt vem nas props geradas por getImageProps */}
      <img
        {...mobileProps}
        className="aspect-4/5 w-full animate-fade-in object-cover md:aspect-16/7"
      />
    </picture>
  );
}

function Cta({
  label,
  url,
  type,
  message,
  whatsapp,
  variant,
}: {
  label: string | null;
  url: string | null;
  type: "LINK" | "WHATSAPP";
  message: string | null;
  whatsapp: string;
  variant: "primary" | "secondary";
}) {
  if (!label) return null;
  if (type === "WHATSAPP") {
    return (
      <WhatsAppButton
        number={whatsapp}
        message={message || "Olá! Vim pelo site e gostaria de ajuda."}
        position="hero"
        variant="secondary"
        size="lg"
      >
        {label}
      </WhatsAppButton>
    );
  }
  return url ? (
    <Link href={url} className={buttonClasses(variant, "lg")}>
      {label}
    </Link>
  ) : null;
}

/** Hero editorial. Com mais de um banner, a troca é manual: setas e indicadores, sem rotação automática. */
export function Hero({ banners, whatsapp }: HeroProps) {
  const [index, setIndex] = useState(0);
  if (banners.length === 0) return null;
  const banner = banners[index];
  const many = banners.length > 1;
  const go = (next: number) => setIndex((next + banners.length) % banners.length);

  return (
    <section
      aria-roledescription={many ? "carrossel" : undefined}
      aria-label="Destaques"
      className="relative bg-cream-100"
    >
      <div className="relative">
        <HeroImage key={banner.id} banner={banner} priority={index === 0} />
        {banner.imageCaption ? (
          <BotanicalCaption
            commonName={banner.imageCaption}
            scientificName={banner.imageCaptionScientific}
            className="absolute right-4 bottom-4 md:right-8 md:bottom-8"
          />
        ) : null}
      </div>

      {/* O texto fica em HTML, sobre uma área de cor sólida: contraste garantido e editável no admin. */}
      <div className="md:absolute md:inset-0 md:flex md:items-center">
        <div className="container-store">
          <div
            aria-live="polite"
            className="py-8 md:max-w-[560px] md:rounded-photo md:bg-cream-50 md:p-10"
          >
            <h1 className="type-h1 text-moss-900 lg:type-display">{banner.title}</h1>
            {banner.subtitle ? (
              <p className="mt-4 type-body-lg text-ink-muted">{banner.subtitle}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta
                label={banner.ctaLabel}
                url={banner.ctaUrl}
                type={banner.ctaType}
                message={banner.whatsappMessage}
                whatsapp={whatsapp}
                variant="primary"
              />
              <Cta
                label={banner.secondaryCtaLabel}
                url={banner.secondaryCtaUrl}
                type={banner.secondaryCtaType}
                message={banner.secondaryWhatsappMessage}
                whatsapp={whatsapp}
                variant="secondary"
              />
            </div>

            {many ? (
              <div className="mt-6 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  aria-label="Destaque anterior"
                  className="-ml-3 flex size-11 items-center justify-center rounded-control text-moss-700 hover:bg-moss-100"
                >
                  <ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-5" />
                </button>
                {banners.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Ver destaque ${i + 1} de ${banners.length}`}
                    aria-current={i === index ? "true" : undefined}
                    className="flex size-11 items-center justify-center"
                  >
                    <span
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === index ? "w-6 bg-moss-700" : "w-1.5 bg-moss-500",
                      )}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  aria-label="Próximo destaque"
                  className="flex size-11 items-center justify-center rounded-control text-moss-700 hover:bg-moss-100"
                >
                  <ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
