-- Tabela de frete por faixa de peso e peso máximo por regra (tabela fixa de PAC e SEDEX).
ALTER TABLE "ShippingRule" ADD COLUMN "weightTiers" JSONB,
ADD COLUMN "maxWeightGrams" INTEGER;
