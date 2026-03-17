'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx'
const MAX_SIZE_MB = 20
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface FileUploadProps {
  value?: File | null
  onChange: (file: File | null) => void
  error?: string
  className?: string
}

export function FileUpload({ value, onChange, error, className }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const validate = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'PDF 또는 Word 문서(.pdf, .doc, .docx)만 업로드 가능합니다.'
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `파일 크기는 ${MAX_SIZE_MB}MB 이하여야 합니다.`
    }
    return null
  }

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file)
      if (err) {
        setLocalError(err)
        onChange(null)
      } else {
        setLocalError(null)
        onChange(file)
      }
    },
    [onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const displayError = error ?? localError

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : value
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50',
          displayError && 'border-red-400 bg-red-50'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {value ? (
          <>
            <svg className="mb-3 h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">{value.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {(value.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              className="mt-2 text-xs text-red-500 underline hover:text-red-700"
            >
              파일 제거
            </button>
          </>
        ) : (
          <>
            <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-gray-700">
              파일을 드래그하거나 <span className="text-blue-600">클릭하여 선택</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX · 최대 {MAX_SIZE_MB}MB</p>
          </>
        )}
      </div>
      {displayError && <p className="text-xs text-red-600">{displayError}</p>}
    </div>
  )
}
