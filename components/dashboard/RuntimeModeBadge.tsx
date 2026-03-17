"use client";

import { useAuthStore } from "@/store/useAuthStore";

import { Badge } from "@/components/ui/Badge";

export function RuntimeModeBadge() {
  const runtimeMode = useAuthStore((state) => state.runtime_mode);

  return (
    <Badge variant={runtimeMode === "supabase" ? "completed" : "info"}>
      {runtimeMode === "supabase" ? "Supabase Live" : "Mock Workspace"}
    </Badge>
  );
}
