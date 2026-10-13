-- Regras dos Correios não levam produto volumoso; a Jadlog, a entrega própria e a retirada levam.
ALTER TABLE "ShippingRule" ADD COLUMN "acceptsBulky" BOOLEAN NOT NULL DEFAULT true;
