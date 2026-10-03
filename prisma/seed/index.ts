/**
 * Seed da Net Shop Garden. Idempotente: pode rodar várias vezes sem duplicar nada.
 * Tudo o que é de teste leva isSample = true e pode ser removido pelo admin de uma vez.
 */
import { seedCustomers, seedUsers, TEST_CUSTOMER, TEST_STAFF } from "./customers";
import { db } from "./helpers";
import { recomputeAggregates, seedMarketing } from "./marketing";
import { seedOrders } from "./orders";
import { seedPages } from "./pages";
import { seedCategoryTree, seedCollections, seedProducts } from "./products";
import { seedRedirects } from "./redirects";
import { seedReviews } from "./reviews";
import { seedContentBlocks, seedCoupons, seedShipping } from "./settings";

async function main() {
  const startedAt = Date.now();
  console.log("Seed da Net Shop Garden");

  await seedUsers();
  const categoryIds = await seedCategoryTree();
  const variants = await seedProducts(categoryIds);
  await seedCollections();
  await seedRedirects();
  await seedShipping();
  await seedCoupons(categoryIds);
  const customers = await seedCustomers();
  await seedOrders(customers, variants);
  await seedReviews();
  await seedContentBlocks(categoryIds);
  await seedPages();
  await seedMarketing(customers, variants);
  await recomputeAggregates();

  console.log(`\nConcluído em ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log(`  Admin:   ${process.env.ADMIN_EMAIL} (senha em ADMIN_PASSWORD no .env)`);
  console.log(`  Equipe:  ${TEST_STAFF.email} / ${TEST_STAFF.password}`);
  console.log(`  Cliente: ${TEST_CUSTOMER.email} / ${TEST_CUSTOMER.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
