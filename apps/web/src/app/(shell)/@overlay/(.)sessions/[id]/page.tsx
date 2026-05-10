import { OverlayShell } from "@/components/session/overlay-shell";
import { ReceiptView } from "@/components/session/receipt-view";

export const dynamic = "force-dynamic";

export default function InterceptedSessionPage({ params }: { params: { id: string } }) {
  return (
    <OverlayShell id={params.id}>
      <ReceiptView id={params.id} />
    </OverlayShell>
  );
}
