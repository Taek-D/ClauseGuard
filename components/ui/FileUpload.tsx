"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-hwp",
];

const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.hwp";
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface FileUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  className?: string;
}

export function FileUpload({ value, onChange, error, className }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = useCallback((file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(file.type) && extension !== "hwp") {
      return "PDF, DOC, DOCX, HWP 파일만 업로드할 수 있습니다.";
    }

    if (file.size > MAX_SIZE_BYTES) {
      return `파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`;
    }

    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validate(file);
      if (validationError) {
        setLocalError(validationError);
        onChange(null);
        return;
      }

      setLocalError(null);
      onChange(file);
    },
    [onChange, validate],
  );

  const displayError = error ?? localError;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDragging
            ? "border-blue-400 bg-blue-50"
            : value
              ? "border-emerald-400 bg-emerald-50"
              : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50",
          displayError && "border-rose-400 bg-rose-50",
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const droppedFile = event.dataTransfer.files[0];
          if (droppedFile) {
            handleFile(droppedFile);
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(event) => {
            const nextFile = event.target.files?.[0];
            if (nextFile) {
              handleFile(nextFile);
            }
          }}
        />
        {value ? (
          <>
            <svg className="mb-3 h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm font-medium text-slate-900">{value.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {(value.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
              className="mt-3 text-xs font-medium text-rose-600 hover:text-rose-700"
            >
              파일 제거
            </button>
          </>
        ) : (
          <>
            <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 0 1-.88-7.9A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M15 13l-3-3m0 0-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-slate-700">
              파일을 드래그하거나 <span className="text-blue-600">클릭해서 선택</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX, HWP · 최대 {MAX_SIZE_MB}MB</p>
          </>
        )}
      </div>
      {displayError ? <p className="text-xs text-rose-600">{displayError}</p> : null}
    </div>
  );
}
