"use client";

import { useRouter } from "next/navigation";

import { UploadForm } from "@/components/contract/UploadForm";

export default function UploadPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <UploadForm onUploaded={(contractId) => router.push(`/dashboard/contracts/${contractId}/analysis`)} />
    </div>
  );
}
