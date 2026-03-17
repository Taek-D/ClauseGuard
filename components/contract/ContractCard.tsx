"use client";

import Link from "next/link";

import { RiskBadge } from "@/components/analysis/RiskBadge";
import { ContractStatusBadge } from "@/components/contract/ContractStatusBadge";
import { Button } from "@/components/ui/Button";
import { CONTRACT_TYPE_LABELS, INDUSTRY_LABELS, type Contract } from "@/types";
import { formatFileSize, formatRelativeDate, getContractTitle } from "@/lib/utils";

interface ContractCardProps {
  contract: Contract;
  onDelete?: (contractId: string) => void;
}

export function ContractCard({ contract, onDelete }: ContractCardProps) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition-shadow hover:shadow-lg hover:shadow-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Link href={`/dashboard/contracts/${contract.id}`} className="inline-block">
            <h3 className="text-lg font-semibold text-slate-950 transition-colors hover:text-blue-700">
              {getContractTitle(contract)}
            </h3>
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{CONTRACT_TYPE_LABELS[contract.contract_type]}</span>
            <span>·</span>
            <span>{INDUSTRY_LABELS[contract.industry]}</span>
            <span>·</span>
            <span>{formatFileSize(contract.file_size_bytes)}</span>
            {contract.page_count ? (
              <>
                <span>·</span>
                <span>{contract.page_count}페이지</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <ContractStatusBadge status={contract.status} />
          {contract.risk_level ? <RiskBadge severity={contract.risk_level} showDot /> : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          <p>{contract.file_name}</p>
          <p className="mt-1 text-xs">업로드 {formatRelativeDate(contract.created_at)}</p>
        </div>

        <div className="flex gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <Link href={`/dashboard/contracts/${contract.id}`}>
            <Button variant="outline" size="sm">
              리포트 보기
            </Button>
          </Link>
          {onDelete ? (
            <Button variant="ghost" size="sm" onClick={() => onDelete(contract.id)}>
              삭제
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
