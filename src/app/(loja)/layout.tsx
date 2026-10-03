import { MaintenanceGate } from "@/components/store/maintenance-gate";
import { StoreShell } from "@/components/store/store-shell";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <MaintenanceGate>
      <StoreShell>{children}</StoreShell>
    </MaintenanceGate>
  );
}
