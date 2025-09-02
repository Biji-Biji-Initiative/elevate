'use client'

import React, { useState } from 'react'
import { Button, Input } from '@elevate/ui'

interface ExportFilters {
  startDate: string
  endDate: string
  activity: string
  status: string
  cohort: string
}

export default function ExportsPage() {
  const [filters, setFilters] = useState<ExportFilters>({
    startDate: '',
    endDate: '',
    activity: 'ALL',
    status: 'ALL',
    cohort: 'ALL'
  })
  
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const handleExport = async (type: string) => {
    setLoading(prev => ({ ...prev, [type]: true }))
    
    try {
      const params = new URLSearchParams({
        type,
        format: 'csv',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value && value !== 'ALL')
        )
      })

      const response = await fetch(`/api/admin/exports?${params}`)
      
      if (response.ok) {
        // Trigger download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Get filename from response headers
        const contentDisposition = response.headers.get('content-disposition')
        const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `${type}-export.csv`
        a.download = filename
        
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const data = await response.json()
        alert(`Export failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data')
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }))
    }
  }

  const exportItems = [
    {
      id: 'submissions',
      title: 'Submissions Export',
      description: 'Export all submission data with user details, status, and review information',
      icon: '📝',
      supportedFilters: ['startDate', 'endDate', 'activity', 'status', 'cohort']
    },
    {
      id: 'users',
      title: 'Users Export',
      description: 'Export user data with roles, points, submission counts, and badge counts',
      icon: '👥',
      supportedFilters: ['cohort']
    },
    {
      id: 'leaderboard',
      title: 'Leaderboard Export',
      description: 'Export current leaderboard rankings with point totals',
      icon: '🏆',
      supportedFilters: ['cohort']
    },
    {
      id: 'points',
      title: 'Points Ledger Export',
      description: 'Export complete points transaction history',
      icon: '💯',
      supportedFilters: ['startDate', 'endDate', 'cohort']
    }
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Data Exports</h1>
        <p className="text-gray-600">Export system data to CSV files for analysis and reporting</p>
      </div>

      {/* Global Filters */}
      <div className="bg-white p-6 rounded-lg border mb-6">
        <h2 className="text-lg font-semibold mb-4">Export Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.activity}
              onChange={(e) => setFilters(prev => ({ ...prev, activity: e.target.value }))}
            >
              <option value="ALL">All Activities</option>
              <option value="LEARN">Learn</option>
              <option value="EXPLORE">Explore</option>
              <option value="AMPLIFY">Amplify</option>
              <option value="PRESENT">Present</option>
              <option value="SHINE">Shine</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.cohort}
              onChange={(e) => setFilters(prev => ({ ...prev, cohort: e.target.value }))}
            >
              <option value="ALL">All Cohorts</option>
              <option value="Batch 1">Batch 1</option>
              <option value="Batch 2">Batch 2</option>
              <option value="Batch 3">Batch 3</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm text-gray-600">
            Set global filters that will be applied to all exports (where applicable).
            Individual export cards show which filters are supported.
          </p>
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportItems.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-lg border hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{item.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Applicable Filters:</p>
              <div className="flex flex-wrap gap-2">
                {item.supportedFilters.map((filter) => (
                  <span
                    key={filter}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs capitalize"
                  >
                    {filter.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                ))}
              </div>
            </div>

            <Button
              variant="default"
              onClick={() => handleExport(item.id)}
              disabled={loading[item.id]}
              style={{ width: '100%' }}
            >
              {loading[item.id] ? 'Exporting...' : `Export ${item.title.split(' ')[0]}`}
            </Button>
          </div>
        ))}
      </div>

      {/* Export History */}
      <div className="mt-8 bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Recent Exports</h2>
        
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">📊</div>
          <p>Export history is not yet implemented.</p>
          <p className="text-sm mt-2">Future versions will show recent export activity and allow re-downloading files.</p>
        </div>
      </div>

      {/* Export Guidelines */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-900 mb-2">Export Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Large exports may take several minutes to process</li>
          <li>• Date filters use submission/creation timestamps</li>
          <li>• All exports include audit trail information where applicable</li>
          <li>• Files are automatically named with timestamp and filters applied</li>
          <li>• Sensitive data (like email addresses) may be limited based on your role</li>
        </ul>
      </div>
    </div>
  )
}

