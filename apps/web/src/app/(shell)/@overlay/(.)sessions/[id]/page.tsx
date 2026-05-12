"use client";

import { useRouter } from "next/navigation";
import { OverlayShell } from "@/components/session/overlay-shell";
import { ReceiptView } from "@/components/session/receipt-view";

export default function InterceptedSessionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  return (
    <OverlayShell id={params.id}>
      <ReceiptView id={params.id} onClose={() => router.back()} />
    </OverlayShell>
  );
}
