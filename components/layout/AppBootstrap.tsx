"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/useAuthStore";
import { useContractStore } from "@/store/useContractStore";

export function AppBootstrap() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const initializeContracts = useContractStore((state) => state.initialize);

  useEffect(() => {
    void initializeAuth();
    void initializeContracts();
  }, [initializeAuth, initializeContracts]);

  return null;
}
