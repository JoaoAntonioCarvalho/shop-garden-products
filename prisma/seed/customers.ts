import bcrypt from "bcryptjs";
import { generateCpf } from "../../src/lib/validators/cpf";
import {
  createRng,
  daysAgo,
  db,
  faker,
  intBetween,
  log,
  pad,
  pick,
  weighted,
  type Rng,
} from "./helpers";

export const TEST_CUSTOMER = { email: "cliente@example.com", password: "Cliente@123" };
export const TEST_STAFF = { email: "expedicao@example.com", password: "Equipe@123" };

export type Region = "SP_CAPITAL" | "GRANDE_SP" | "RJ" | "OTHER";

export type SeededCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  region: Region;
  address: {
    recipientName: string;
    cep: string;
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    state: string;
  };
};

const spDistricts = [
  "Pinheiros",
  "Vila Mariana",
  "Moema",
  "Perdizes",
  "Itaim Bibi",
  "Jardim Paulista",
  "Santana",
  "Lapa",
  "Butantã",
  "Tatuapé",
];
const grandeSp: Array<[city: string, cepPrefix: string]> = [
  ["Santo André", "09"],
  ["São Bernardo do Campo", "09"],
  ["Osasco", "06"],
  ["Guarulhos", "07"],
  ["Barueri", "06"],
  ["São Caetano do Sul", "09"],
];
const rjDistricts = ["Botafogo", "Tijuca", "Copacabana", "Barra da Tijuca", "Flamengo", "Leblon"];
const others: Array<[city: string, state: string, cepPrefix: string, district: string]> = [
  ["Belo Horizonte", "MG", "30", "Savassi"],
  ["Curitiba", "PR", "80", "Batel"],
  ["Porto Alegre", "RS", "90", "Moinhos de Vento"],
  ["Salvador", "BA", "40", "Barra"],
  ["Brasília", "DF", "70", "Asa Sul"],
  ["Campinas", "SP", "13", "Cambuí"],
  ["Florianópolis", "SC", "88", "Centro"],
  ["Recife", "PE", "50", "Boa Viagem"],
];

function addressFor(rng: Rng, region: Region, name: string): SeededCustomer["address"] {
  const tail = () => `${pad(intBetween(rng, 0, 999), 3)}${pad(intBetween(rng, 0, 999), 3)}`;
  const base = {
    recipientName: name,
    street: faker.location.street(),
    number: String(intBetween(rng, 10, 2400)),
    complement: rng() < 0.45 ? `Apto ${intBetween(rng, 11, 184)}` : null,
  };
  if (region === "SP_CAPITAL") {
    return {
      ...base,
      cep: `0${intBetween(rng, 1, 5)}${tail()}`,
      district: pick(rng, spDistricts),
      city: "São Paulo",
      state: "SP",
    };
  }
  if (region === "GRANDE_SP") {
    const [city, prefix] = pick(rng, grandeSp);
    return { ...base, cep: `${prefix}${tail()}`, district: "Centro", city, state: "SP" };
  }
  if (region === "RJ") {
    return {
      ...base,
      cep: `22${tail()}`,
      district: pick(rng, rjDistricts),
      city: "Rio de Janeiro",
      state: "RJ",
    };
  }
  const [city, state, prefix, district] = pick(rng, others);
  return { ...base, cep: `${prefix}${tail()}`, district, city, state };
}

export async function seedUsers() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@netshopgarden.com.br").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      "Defina ADMIN_PASSWORD no .env antes de rodar o seed (senha inicial do administrador).",
    );
  }

  // A senha do admin só é definida na criação: rodar o seed de novo não desfaz uma troca de senha.
  await db.user.upsert({
    where: { email: adminEmail },
    create: {
      name: "Administrador",
      email: adminEmail,
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
  await db.user.upsert({
    where: { email: TEST_STAFF.email },
    create: {
      name: "Equipe de expedição",
      email: TEST_STAFF.email,
      role: "STAFF",
      passwordHash: await bcrypt.hash(TEST_STAFF.password, 12),
      emailVerifiedAt: new Date(),
      isSample: true,
    },
    update: {},
  });
  log("Usuários da equipe", "admin + expedição");
}

export async function seedCustomers(): Promise<SeededCustomer[]> {
  const rng = createRng(80);
  const now = new Date();
  const testHash = await bcrypt.hash(TEST_CUSTOMER.password, 12);
  const customers: SeededCustomer[] = [];
  const rows = [];
  const addresses = [];

  for (let i = 0; i <= 80; i++) {
    const isTestLogin = i === 0;
    const id = `seed-cliente-${pad(i, 3)}`;
    const region: Region = isTestLogin
      ? "SP_CAPITAL"
      : weighted(rng, [
          ["SP_CAPITAL", 50],
          ["GRANDE_SP", 15],
          ["RJ", 15],
          ["OTHER", 20],
        ] as const);
    const female = rng() < 0.82;
    const firstName = faker.person.firstName(female ? "female" : "male");
    const name = isTestLogin ? "Cliente de Teste" : `${firstName} ${faker.person.lastName()}`;
    const email = isTestLogin
      ? TEST_CUSTOMER.email
      : `${faker.helpers
          .slugify(name)
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")}.${i}@example.com`;
    const phone = `11${9}${pad(intBetween(rng, 40000000, 99999999), 8)}`;
    const cpf = generateCpf(pad(100000000 + i * 7919, 9));
    const address = addressFor(rng, region, name);
    const optIn = rng() < 0.4;
    const createdAt = daysAgo(intBetween(rng, 5, 400), now);

    customers.push({ id, name, email, phone, cpf, region, address });
    rows.push({
      id,
      name,
      email,
      phone,
      cpf,
      role: "CUSTOMER" as const,
      passwordHash: isTestLogin ? testHash : null,
      emailVerifiedAt: isTestLogin || rng() < 0.7 ? createdAt : null,
      birthDate:
        rng() < 0.5
          ? new Date(
              Date.UTC(intBetween(rng, 1958, 2002), intBetween(rng, 0, 11), intBetween(rng, 1, 28)),
            )
          : null,
      marketingEmailOptIn: optIn,
      marketingWhatsappOptIn: optIn && rng() < 0.5,
      optInAt: optIn ? createdAt : null,
      isSample: true,
      createdAt,
    });
    addresses.push({
      id: `seed-endereco-${pad(i, 3)}`,
      userId: id,
      label: "Casa",
      recipientPhone: phone,
      isDefault: true,
      ...address,
    });
  }

  await db.user.createMany({ data: rows, skipDuplicates: true });
  await db.address.createMany({ data: addresses, skipDuplicates: true });
  log("Clientes de teste", customers.length);
  return customers;
}
