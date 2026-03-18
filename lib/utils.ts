import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Contract, ReportData, Severity } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

export function formatRelativeDate(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return formatDate(dateString);
}

export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function getContractTitle(contract: Pick<Contract, "file_name">): string {
  return stripFileExtension(contract.file_name);
}

export function formatScore(score: number | null): string {
  return score === null ? "N/A" : `${score}/100`;
}

export function getSeverityWeight(severity: Severity): number {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSuggestionDecisionLabel(accepted: boolean | null): string {
  if (accepted === true) return "Accepted";
  if (accepted === false) return "Needs review";
  return "Pending";
}

export function buildReportClipboardText(report: ReportData): string {
  const topRisks = report.risks.slice(0, 3).map((risk, index) => {
    const suggestion = risk.suggestions?.[0];
    const decision = suggestion ? getSuggestionDecisionLabel(suggestion.accepted) : "No suggestion";
    return `${index + 1}. [${risk.severity.toUpperCase()}] ${risk.title} (${decision})`;
  });

  return [
    "ClauseGuard Risk Report",
    `Contract: ${report.contract.file_name}`,
    `Generated: ${formatDate(report.contract.created_at)}`,
    `Overall score: ${formatScore(report.summary.overall_score)}`,
    `High: ${report.summary.high_count} | Medium: ${report.summary.medium_count} | Low: ${report.summary.low_count}`,
    "",
    "Top risks",
    ...(topRisks.length ? topRisks : ["- No risks found"]),
  ].join("\n");
}
