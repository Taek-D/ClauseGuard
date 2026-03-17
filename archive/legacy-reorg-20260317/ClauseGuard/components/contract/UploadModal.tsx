'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FileUpload } from '@/components/ui/FileUpload'
import { useContractStore } from '@/store/useContractStore'
import { CONTRACT_TYPE_LABELS, INDUSTRY_LABELS } from '@/types'
import type { ContractType, Industry } from '@/types'

const CONTRACT_TYPE_OPTIONS = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const INDUSTRY_OPTIONS = Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({
  value,
  label,
}))

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface FormState {
  file: File | null
  title: string
  contractType: ContractType | ''
  industry: Industry | ''
  counterparty: string
  effectiveDate: string
  expiryDate: string
}

const INITIAL_STATE: FormState = {
  file: null,
  title: '',
  contractType: '',
  industry: '',
  counterparty: '',
  effectiveDate: '',
  expiryDate: '',
}

interface FormErrors {
  file?: string
  title?: string
  contractType?: string
  industry?: string
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [errors, setErrors] = useState<FormErrors>({})
  const { isUploading, uploadContract } = useContractStore()

  const set = (field: keyof FormState, value: string | File | null) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!form.file) next.file = '파일을 선택해주세요.'
    if (!form.title.trim()) next.title = '제목을 입력해주세요.'
    if (!form.contractType) next.contractType = '계약 유형을 선택해주세요.'
    if (!form.industry) next.industry = '산업을 선택해주세요.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || !form.file || !form.contractType || !form.industry) return

    const contract = await uploadContract({
      file: form.file,
      title: form.title.trim(),
      contractType: form.contractType as ContractType,
      industry: form.industry as Industry,
      counterparty: form.counterparty || undefined,
      effectiveDate: form.effectiveDate || undefined,
      expiryDate: form.expiryDate || undefined,
    })

    if (contract) {
      setForm(INITIAL_STATE)
      setErrors({})
      onSuccess?.()
      onClose()
    }
  }

  const handleClose = () => {
    if (isUploading) return
    setForm(INITIAL_STATE)
    setErrors({})
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="계약서 업로드" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FileUpload
          value={form.file}
          onChange={(file) => {
            set('file', file)
            if (file && !form.title) {
              set('title', file.name.replace(/\.[^.]+$/, ''))
            }
          }}
          error={errors.file}
        />

        <Input
          label="제목"
          placeholder="계약서 제목을 입력하세요"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="계약 유형"
            placeholder="선택"
            options={CONTRACT_TYPE_OPTIONS}
            value={form.contractType}
            onChange={(e) => set('contractType', e.target.value)}
            error={errors.contractType}
          />
          <Select
            label="산업"
            placeholder="선택"
            options={INDUSTRY_OPTIONS}
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
            error={errors.industry}
          />
        </div>

        <Input
          label="상대방 (선택)"
          placeholder="계약 상대방 회사명"
          value={form.counterparty}
          onChange={(e) => set('counterparty', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="계약 시작일 (선택)"
            type="date"
            value={form.effectiveDate}
            onChange={(e) => set('effectiveDate', e.target.value)}
          />
          <Input
            label="계약 종료일 (선택)"
            type="date"
            value={form.expiryDate}
            onChange={(e) => set('expiryDate', e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isUploading}>
            취소
          </Button>
          <Button type="submit" isLoading={isUploading}>
            {isUploading ? '업로드 중...' : '업로드 및 분석 시작'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
