"use client"

import React, { useState } from 'react'
import { buildQueryString } from '@/lib/utils/query'

import { toMsg } from '@/lib/errors'
import type { ACTIVITY_CODES, SUBMISSION_STATUSES } from '@elevate/types'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Alert } from '@elevate/ui'

interface ExportFilters {
  startDate: string
  endDate: string
  activity: 'ALL' | (typeof ACTIVITY_CODES)[number]
  status: 'ALL' | (typeof SUBMISSION_STATUSES)[number]
  cohort: string
}

type ExportType = 'submissions' | 'users' | 'leaderboard' | 'points'

export function ClientPage({ initialCohorts }: { initialCohorts: string[] }) {
  const [filters, setFilters] = useState<ExportFilters>({
    startDate: '',
    endDate: '',
    activity: 'ALL',
    status: 'ALL',
    cohort: 'ALL',
  })

  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [cohorts] = useState<string[]>(initialCohorts || [])
  const [error, setError] = useState<string | null>(null)

  const toErrorMessage = (context: string, err: unknown) => toMsg(context, err)

  const handleExport = async (type: ExportType) => {
    setLoading((prev) => ({ ...prev, [type]: true }))
    setError(null)

    try {
      const query = buildQueryString({
        type,
        format: 'csv',
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        activity: filters.activity !== 'ALL' ? filters.activity : undefined,
        status: filters.status !== 'ALL' ? filters.status : undefined,
        cohort: filters.cohort !== 'ALL' ? filters.cohort : undefined,
      })
      const url = `/api/admin/exports?${query}`
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener noreferrer'
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (error: unknown) {
      const msg = toErrorMessage('Export data', error)
      setError(msg)
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }))
    }
  }

  const exportItems: Array<{
    id: ExportType
    title: string
    description: string
    icon: string
    supportedFilters: Array<keyof ExportFilters>
  }> = [
    { id: 'submissions', title: 'Submissions Export', description: 'Export all submission data with user details, status, and review information', icon: '📝', supportedFilters: ['startDate', 'endDate', 'activity', 'status', 'cohort'] },
    { id: 'users', title: 'Users Export', description: 'Export user data with roles, points, submission counts, and badge counts', icon: '👥', supportedFilters: ['cohort'] },
    { id: 'leaderboard', title: 'Leaderboard Export', description: 'Export current leaderboard rankings with point totals', icon: '🏆', supportedFilters: ['cohort'] },
    { id: 'points', title: 'Points Ledger Export', description: 'Export complete points transaction history', icon: '💯', supportedFilters: ['startDate', 'endDate', 'cohort'] },
  ]

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Exports</h1>
        <p className="text-gray-600">Export system data to CSV files for analysis and reporting</p>
      </div>

      <div className="bg-white p-6 rounded-lg border mb-6">
        <h2 className="text-lg font-semibold mb-4">Export Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <Input id="start-date" type="date" value={filters.startDate} onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} />
          </div>

          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <Input id="end-date" type="date" value={filters.endDate} onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} />
          </div>

          <div>
            <label htmlFor="activity" className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <Select value={filters.activity} onValueChange={(v) => setFilters((prev) => ({ ...prev, activity: v as ExportFilters['activity'] }))}>
              <SelectTrigger id="activity">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="LEARN">LEARN</SelectItem>
                <SelectItem value="BUILD">BUILD</SelectItem>
                <SelectItem value="SHARE">SHARE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select value={filters.status} onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v as ExportFilters['status'] }))}>
              <SelectTrigger id="status">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="cohort" className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <Select value={filters.cohort} onValueChange={(v) => setFilters((prev) => ({ ...prev, cohort: v }))}>
              <SelectTrigger id="cohort">
                <SelectValue placeholder="All cohorts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportItems.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-lg border">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">{item.icon}</span>
              <h3 className="text-lg font-semibold">{item.title}</h3>
            </div>
            <p className="text-gray-600 mb-4">{item.description}</p>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">Supports: {item.supportedFilters.join(', ')}</div>
              <Button onClick={() => void handleExport(item.id)} disabled={!!loading[item.id]}>
                {loading[item.id] ? 'Exporting…' : 'Export CSV'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
