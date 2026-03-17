"use client";

import { useState } from "react";

import { CONTRACT_TYPE_LABELS, INDUSTRY_LABELS, PARTY_POSITION_LABELS, type ContractType, type IndustryType, type PartyPosition } from "@/types";
import { useContractStore } from "@/store/useContractStore";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { Select } from "@/components/ui/Select";

const CONTRACT_OPTIONS = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const INDUSTRY_OPTIONS = Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({ value, label }));
const POSITION_OPTIONS = Object.entries(PARTY_POSITION_LABELS).map(([value, label]) => ({ value, label }));

interface UploadFormProps {
  onUploaded?: (contractId: string) => void;
}

export function UploadForm({ onUploaded }: UploadFormProps) {
  const uploadContract = useContractStore((state) => state.upload_contract);
  const isUploading = useContractStore((state) => state.is_uploading);
  const [file, setFile] = useState<File | null>(null);
  const [industry, setIndustry] = useState<IndustryType>("saas");
  const [contractType, setContractType] = useState<ContractType>("service");
  const [partyPosition, setPartyPosition] = useState<PartyPosition>("provider");
  const [focusAreas, setFocusAreas] = useState("liability, termination, payment");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("업로드할 계약서 파일을 선택해 주세요.");
      return;
    }

    setError(null);

    const contract = await uploadContract({
      file,
      industry,
      contract_type: contractType,
      party_position: partyPosition,
      focus_areas: focusAreas.split(",").map((token) => token.trim()).filter(Boolean),
    });

    if (contract) {
      setFile(null);
      onUploaded?.(contract.id);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">문서 업로드</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">계약서를 올리고 분석을 시작하세요</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          루트 앱 기준 MVP 흐름입니다. 환경변수가 없으면 mock 워크스페이스에서, 있으면 Supabase 함수 기준으로 같은 화면 흐름을 확인할 수 있습니다.
        </p>
      </div>

      <FileUpload value={file} onChange={setFile} error={error ?? undefined} />

      <div className="grid gap-4 md:grid-cols-3">
        <Select label="업종" options={INDUSTRY_OPTIONS} value={industry} onChange={(event) => setIndustry(event.target.value as IndustryType)} />
        <Select label="계약 유형" options={CONTRACT_OPTIONS} value={contractType} onChange={(event) => setContractType(event.target.value as ContractType)} />
        <Select label="우리 입장" options={POSITION_OPTIONS} value={partyPosition} onChange={(event) => setPartyPosition(event.target.value as PartyPosition)} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">중점 검토 영역</span>
        <textarea
          className="min-h-28 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={focusAreas}
          onChange={(event) => setFocusAreas(event.target.value)}
          placeholder="예: liability, termination, payment"
        />
        <span className="text-xs text-slate-500">쉼표로 구분해 분석 우선순위를 힌트로 전달합니다.</span>
      </label>

      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">MVP에서는 업로드 후 분석 진행 페이지로 바로 이동합니다.</p>
        <Button type="submit" isLoading={isUploading}>
          {isUploading ? "업로드 중..." : "분석 시작"}
        </Button>
      </div>
    </form>
  );
}
