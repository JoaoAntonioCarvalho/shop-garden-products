-- Clientes e pedidos trazidos do site antigo.
ALTER TYPE "OrderChannel" ADD VALUE 'LEGACY';

ALTER TABLE "User" ADD COLUMN "legacyImportedAt" TIMESTAMP(3);
