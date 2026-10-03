import type { Metadata } from "next";
import { AddressManager } from "@/components/store/account/account-forms";
import { requireAccountUser } from "@/lib/account-guard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Endereços" };

export default async function AddressesPage() {
  const user = await requireAccountUser("/conta/enderecos");
  const addresses = await db.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      recipientName: true,
      recipientPhone: true,
      cep: true,
      street: true,
      number: true,
      complement: true,
      district: true,
      city: true,
      state: true,
      reference: true,
      isDefault: true,
    },
  });
  return (
    <div>
      <h1 className="type-h1 text-moss-900">Endereços</h1>
      <div className="mt-6">
        <AddressManager addresses={addresses} defaultName={user.name} />
      </div>
    </div>
  );
}
