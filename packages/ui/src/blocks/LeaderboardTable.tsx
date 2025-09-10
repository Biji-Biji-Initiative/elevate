'use client'

import React, { useState, useMemo } from 'react'

import type { LeaderboardEntryDTO } from '@elevate/types'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

import { LoadingSpinner } from './LoadingSpinner'
import { ProfileCard } from './ProfileCard'

// Use LeaderboardEntryDTO from @elevate/types
// type LeaderboardEntryDTO is imported from @elevate/types

export interface LeaderboardTableProps {
  data: readonly LeaderboardEntryDTO[]
  period: 'all' | '30d'
  loading?: boolean
  onPeriodChange: (period: 'all' | '30d') => void
  showSearch?: boolean
  showPagination?: boolean
  getProfilePath?: (handle: string) => string
  Link?: React.ComponentType<{
    href: string
    className?: string
    children: React.ReactNode
  }>
}

export function LeaderboardTable({
  data,
  period,
  loading = false,
  onPeriodChange,
  showSearch = true,
  showPagination = true,
  getProfilePath,
  Link,
}: LeaderboardTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')

  const itemsPerPage = 20

  // Filter data based on search query with type safety
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data

    const query = searchQuery.toLowerCase()
    return data.filter((entry) => {
      const name = entry.user.name?.toLowerCase() ?? ''
      const handle = entry.user.handle?.toLowerCase() ?? ''
      const school = entry.user.school?.toLowerCase() ?? ''

      return (
        name.includes(query) || handle.includes(query) || school.includes(query)
      )
    })
  }, [data, searchQuery])

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    if (!showPagination) return filteredData

    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage, showPagination])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setCurrentPage(1) // Reset to first page when searching
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900">Leaderboard</h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onPeriodChange('all')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                period === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => onPeriodChange('30d')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                period === '30d'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {showSearch && (
            <div className="relative">
              <Input
                type="text"
                placeholder="Search educators..."
                value={searchQuery}
                onChange={handleSearch}
                className="pl-10 w-64"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          )}

          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2 py-1 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white shadow-sm'
                  : 'hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Results info */}
      {searchQuery && (
        <div className="text-sm text-gray-600">
          Showing {filteredData.length} result
          {filteredData.length !== 1 ? 's' : ''} for "{searchQuery}"
        </div>
      )}

      {/* No results */}
      {filteredData.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No educators found
          </h3>
          <p className="text-gray-600">Try adjusting your search criteria.</p>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && paginatedData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedData.map((entry, idx) => {
            const profileCardProps: React.ComponentProps<typeof ProfileCard> = {
              user: {
                id: entry.user.id,
                name: entry.user.name || '',
                handle: entry.user.handle || '',
                school: entry.user.school || null,
                avatarUrl: entry.user.avatarUrl || null,
                earnedBadges: entry.user.earnedBadges || [],
                totalPoints: entry.user.totalPoints,
              },
              rank: idx + 1 + (currentPage - 1) * itemsPerPage,
              showRank: true,
              compact: true,
              ...(getProfilePath && { getProfilePath }),
              ...(Link && { Link }),
            }
            return <ProfileCard key={entry.user.id} {...profileCardProps} />
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && paginatedData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Educator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Badges
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((entry, idx) => {
                  const profilePath = getProfilePath
                    ? getProfilePath(entry.user.handle || '')
                    : `/u/${entry.user.handle}`

                  return (
                    <tr key={entry.user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                          <span className="text-sm font-bold text-gray-600">
                            #{idx + 1 + (currentPage - 1) * itemsPerPage}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {(entry.user.name || '').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3">
                            <a
                              href={profilePath}
                              className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {entry.user.name}
                            </a>
                            <div className="text-xs text-gray-500">
                              @{entry.user.handle}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {entry.user.school || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-blue-600">
                        {entry.user.totalPoints?.toLocaleString() || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-1">
                          {entry.user.earnedBadges
                            ?.slice(0, 3)
                            .map(
                              (earnedBadge: {
                                badge: { code: string; name: string }
                              }) => (
                                <div
                                  key={earnedBadge.badge.code}
                                  className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center"
                                  title={earnedBadge.badge.name}
                                >
                                  <span className="text-xs">🏆</span>
                                </div>
                              ),
                            )}
                          {entry.user.earnedBadges &&
                            entry.user.earnedBadges.length > 3 && (
                              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-xs text-gray-600">
                                  +{entry.user.earnedBadges.length - 3}
                                </span>
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <Button
              variant="ghost"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>

          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, filteredData.length)}
                </span>{' '}
                of <span className="font-medium">{filteredData.length}</span>{' '}
                results
              </p>
            </div>
            <div>
              <nav
                className="isolate inline-flex -space-x-px rounded-md shadow-sm"
                aria-label="Pagination"
              >
                <Button
                  variant="ghost"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md"
                >
                  Previous
                </Button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum =
                    currentPage <= 3
                      ? i + 1
                      : currentPage >= totalPages - 2
                      ? totalPages - 4 + i
                      : currentPage - 2 + i

                  if (pageNum < 1 || pageNum > totalPages) return null

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'ghost'}
                      onClick={() => setCurrentPage(pageNum)}
                      className="relative inline-flex items-center"
                    >
                      {pageNum}
                    </Button>
                  )
                })}

                <Button
                  variant="ghost"
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md"
                >
                  Next
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
