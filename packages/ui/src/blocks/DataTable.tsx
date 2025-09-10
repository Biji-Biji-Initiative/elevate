'use client'

import React, { useState, useMemo, useCallback } from 'react'

import { Button } from '../components/ui/button'


export interface Column<T, V = unknown> {
  key: keyof T | string
  header: string
  render?: (row: T, value: V) => React.ReactNode
  sortable?: boolean
  width?: string
  accessor?: (row: T) => V
  sortAccessor?: (row: T) => string | number | Date
  sortComparator?: (a: V, b: V) => number
}

// Helper types and factories for strong typing
export type ColumnOf<T> = Column<T>

// Factory to build typed column arrays with inference
export const createColumns = <T,>() => <C extends readonly Column<T, unknown>[]>(cols: C) => cols

export interface DataTableProps<
  T = Record<string, unknown>,
  C extends readonly Column<T, unknown>[] = readonly Column<T, unknown>[],
  Id extends string | number = string,
> {
  data: T[]
  columns: C
  loading?: boolean
  pagination?: {
    page: number
    limit: number
    total: number
    onPageChange: (page: number) => void
  }
  selection?: {
    selectedRows: Set<Id>
    onSelectionChange: (selectedRows: Set<Id>) => void
    getRowId: (row: T) => Id
  }
  sorting?: {
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    onSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  }
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
}

export function DataTable<
  T extends Record<string, unknown> = Record<string, unknown>,
  C extends readonly Column<T, unknown>[] = readonly Column<T, unknown>[],
  Id extends string | number = string,
>({
  data,
  columns,
  loading = false,
  pagination,
  selection,
  sorting,
  onRowClick,
  emptyMessage = 'No data available',
  className = ''
}: DataTableProps<T, C, Id>) {
  const [localSort, setLocalSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null)

  const sortedData = useMemo(() => {
    if (!sorting && !localSort) return data

    const sortConfig = sorting ? 
      { key: sorting.sortBy || '', order: sorting.sortOrder || 'asc' } : 
      localSort

    if (!sortConfig) return data

    return [...data].sort((a, b) => {
      // Find the column configuration for the sort key
      const column = columns.find(col => String(col.key) === sortConfig.key)
      
      let aVal: unknown
      let bVal: unknown
      
      // Use sortComparator if available
      if (column?.sortComparator) {
        const aRaw = column.sortAccessor ? column.sortAccessor(a) : 
                    column.accessor ? column.accessor(a) : 
                    getNestedValue(a, sortConfig.key)
        const bRaw = column.sortAccessor ? column.sortAccessor(b) : 
                    column.accessor ? column.accessor(b) : 
                    getNestedValue(b, sortConfig.key)
        
        const result = (column.sortComparator as ((a: unknown, b: unknown) => number))(aRaw, bRaw)
        return sortConfig.order === 'asc' ? result : -result
      }
      
      // Use sortAccessor if available, then accessor, then getNestedValue
      if (column?.sortAccessor) {
        aVal = column.sortAccessor(a)
        bVal = column.sortAccessor(b)
      } else if (column?.accessor) {
        aVal = column.accessor(a)
        bVal = column.accessor(b)
      } else {
        aVal = getNestedValue(a, sortConfig.key)
        bVal = getNestedValue(b, sortConfig.key)
      }
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortConfig.order === 'asc' ? 1 : -1
      if (bVal == null) return sortConfig.order === 'asc' ? -1 : 1
      
      // Handle Date objects
      if (aVal instanceof Date && bVal instanceof Date) {
        const result = aVal.getTime() - bVal.getTime()
        return sortConfig.order === 'asc' ? result : -result
      }
      
      // Handle numeric strings
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        const result = aNum - bNum
        return sortConfig.order === 'asc' ? result : -result
      }
      
      // Convert values to comparable types with type safety
      const aComparable = isComparable(aVal) ? aVal : String(aVal ?? '')
      const bComparable = isComparable(bVal) ? bVal : String(bVal ?? '')
      
      if (aComparable < bComparable) return sortConfig.order === 'asc' ? -1 : 1
      if (aComparable > bComparable) return sortConfig.order === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sorting, localSort, columns])

  const handleSort = useCallback((columnKey: string) => {
    if (sorting) {
      const newOrder = sorting.sortBy === columnKey && sorting.sortOrder === 'asc' ? 'desc' : 'asc'
      sorting.onSort(columnKey, newOrder)
    } else {
      const newOrder = localSort?.key === columnKey && localSort.order === 'asc' ? 'desc' : 'asc'
      setLocalSort({ key: columnKey, order: newOrder })
    }
  }, [sorting, localSort])

  const handleSelectAll = () => {
    if (!selection) return

    const allIds = data.map(row => selection.getRowId(row))
    const allSelected = allIds.every(id => selection.selectedRows.has(id))
    
    if (allSelected) {
      selection.onSelectionChange(new Set())
    } else {
      selection.onSelectionChange(new Set(allIds))
    }
  }

  const handleRowSelect = (rowId: Id) => {
    if (!selection) return

    const newSelection = new Set(selection.selectedRows)
    if (newSelection.has(rowId)) {
      newSelection.delete(rowId)
    } else {
      newSelection.add(rowId)
    }
    selection.onSelectionChange(newSelection)
  }

  const getSortIcon = (columnKey: string) => {
    const currentSort = sorting ? 
      { key: sorting.sortBy, order: sorting.sortOrder } : 
      localSort

    if (!currentSort || currentSort.key !== columnKey) {
      return '↕️'
    }
    
    return currentSort.order === 'asc' ? '↑' : '↓'
  }

  if (loading) {
    return (
      <div className={`border rounded-lg bg-white ${className}`}>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg bg-white overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selection && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={data.length > 0 && data.every(row => selection.selectedRows.has(selection.getRowId(row)))}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  style={{ width: column.width }}
                  onClick={column.sortable !== false ? () => handleSort(String(column.key)) : undefined}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable !== false && (
                      <span className="text-gray-400">{getSortIcon(String(column.key))}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length + (selection ? 1 : 0)} 
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => {
                const rowId: Id = selection ? selection.getRowId(row) : (index as unknown as Id)
                const isSelected = selection ? selection.selectedRows.has(rowId) : false
                
                return (
                  <tr
                    key={String(rowId)}
                    className={`
                      hover:bg-gray-50 transition-colors
                      ${isSelected ? 'bg-blue-50' : ''}
                      ${onRowClick ? 'cursor-pointer' : ''}
                    `}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selection && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={isSelected}
                          onChange={() => handleRowSelect(rowId)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    {columns.map((column) => {
                      const value = column.accessor
                        ? column.accessor(row)
                        : getNestedValue(row, String(column.key))

                      let displayValue: React.ReactNode
                      if (column.render) {
                        displayValue = column.render(row, value as unknown)
                      } else {
                        displayValue =
                          value === null || value === undefined
                            ? '-'
                            : typeof value === 'string' || typeof value === 'number'
                              ? String(value)
                              : String(value)
                      }
                      
                      return (
                        <td key={String(column.key)} className="px-4 py-3 text-sm text-gray-900">
                          {displayValue}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              variant="ghost"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
            >
              Next
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {((pagination.page - 1) * pagination.limit) + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <Button
                  variant="ghost"
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  style={{ borderRadius: '6px 0 0 6px' }}
                >
                  Previous
                </Button>
                
                {generatePageNumbers(pagination.page, Math.ceil(pagination.total / pagination.limit)).map((pageNum) => (
                  typeof pageNum === 'string' ? (
                    <span key={pageNum} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={`page-${pageNum}`}
                      variant={pageNum === pagination.page ? 'default' : 'ghost'}
                      onClick={() => typeof pageNum === 'number' && pagination.onPageChange(pageNum)}
                      style={{ borderRadius: 0 }}
                    >
                      {pageNum}
                    </Button>
                  )
                ))}
                
                <Button
                  variant="ghost"
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                  style={{ borderRadius: '0 6px 6px 0' }}
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

function getNestedValue<T>(obj: T, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  
  return path.split('.').reduce((current: unknown, key: string) => {
    if (!current || typeof current !== 'object' || current === null) {
      return undefined
    }
    
    // Type-safe property access
    if (key in current && isObject(current)) {
      return current[key]
    }
    
    return undefined
  }, obj as unknown)
}

// Type guard for safe object access
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

// Type guard for string or number values
function isComparable(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

function generatePageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = []
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    pages.push(1)
    
    if (currentPage <= 4) {
      for (let i = 2; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('ellipsis-right')
    } else if (currentPage >= totalPages - 3) {
      pages.push('ellipsis-left')
      for (let i = totalPages - 4; i <= totalPages - 1; i++) {
        pages.push(i)
      }
    } else {
      pages.push('ellipsis-left')
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i)
      }
      pages.push('ellipsis-right')
    }
    
    pages.push(totalPages)
  }
  
  return pages
}
