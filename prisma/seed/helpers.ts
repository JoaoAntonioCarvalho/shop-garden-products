import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { fakerPT_BR as faker } from "@faker-js/faker";
import { PrismaClient } from "../../src/generated/prisma/client";

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Semente fixa: o seed gera sempre os mesmos dados.
faker.seed(1999);
export { faker };

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)];

export const intBetween = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

/** Escolhe por peso: weighted(rng, [["a", 80], ["b", 20]]). */
export function weighted<T>(rng: Rng, options: ReadonlyArray<readonly [T, number]>): T {
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [value, weight] of options) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return options[options.length - 1][0];
}

export const pad = (value: number, size: number) => String(value).padStart(size, "0");

export const daysAgo = (days: number, base: Date = new Date()) =>
  new Date(base.getTime() - days * 86_400_000);

export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

/** Data (sem hora) em UTC, como o Prisma grava colunas @db.Date. */
export const dateOnly = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export function log(step: string, detail: string | number = "") {
  console.log(`  ${step.padEnd(34, ".")} ${detail}`);
}
