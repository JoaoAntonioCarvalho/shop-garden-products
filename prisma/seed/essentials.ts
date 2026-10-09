/**
 * Carga inicial de produção: só o que a loja precisa para funcionar, sem dados de teste.
 * Cria o administrador (ADMIN_EMAIL e ADMIN_PASSWORD), as categorias, as coleções, os
 * redirecionamentos do site antigo, as regras de frete, os cupons, os blocos da home e as páginas.
 * Não cria produtos, clientes, pedidos nem avaliações. Idempotente.
 *
 * Uso: pnpm db:seed:essentials (o banco é o de DATABASE_URL)
 */
import { seedUsers } from "./customers";
import { db } from "./helpers";
import { seedPages } from "./pages";
import { seedCategoryTree, seedCollections } from "./products";
import { seedRedirects } from "./redirects";
import { seedContentBlocks, seedCoupons, seedShipping } from "./settings";

async function main() {
  console.log("Carga inicial de produção da Net Shop Garden");
  await seedUsers({ testStaff: false });
  const categoryIds = await seedCategoryTree();
  await seedCollections();
  await seedRedirects();
  await seedShipping();
  await seedCoupons(categoryIds);
  await seedContentBlocks(categoryIds);
  await seedPages();
  console.log(`\nAdministrador: ${process.env.ADMIN_EMAIL}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
