import { ReceiptView } from "@/components/session/receipt-view";

export const dynamic = "force-dynamic";

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="panel">
      <ReceiptView id={params.id} />
    </div>
  );
}
