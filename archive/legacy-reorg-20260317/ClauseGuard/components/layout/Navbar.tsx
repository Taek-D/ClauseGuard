'use client'

import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/Button'

export function Navbar() {
  const { user, signOut } = useAuthStore()

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">ClauseGuard</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            대시보드
          </Link>
          <Link href="/dashboard/contracts" className="text-sm text-gray-600 hover:text-gray-900">
            계약서
          </Link>
        </nav>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">
                {user.contractsUsed} / {user.contractsLimit === -1 ? '무제한' : user.contractsLimit}건
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
              {user.name[0]}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
