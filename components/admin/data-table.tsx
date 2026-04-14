'use client'

import React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import SkeletonTable from './skeleton-table'
import { useAdminTheme } from './admin-theme-provider'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyState?: React.ReactNode
  onRowClick?: (row: T) => void
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  bulkActions?: React.ReactNode
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyState,
  onRowClick,
  selectable,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  sortBy,
  sortDir,
  onSort,
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  onPageSizeChange,
}: DataTableProps<T>) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'
  const totalPages = Math.ceil(total / pageSize)

  const tableBg = isDark ? '#0A0A0A' : '#FAFAFA'
  const headerBg = isDark ? '#000000' : '#F5F5F5'
  const borderColor = isDark ? '#1A1A1A' : '#E5E5E5'
  const hoverBg = isDark ? '#111111' : '#F0F0F0'
  const textPrimary = isDark ? '#F5F5F5' : '#0A0A0A'
  const textSecondary = isDark ? '#71717A' : '#71717A'

  function toggleRow(id: string) {
    if (!onSelectionChange) return
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  function toggleAll() {
    if (!onSelectionChange) return
    const allIds = data.map((row) => row.id as string)
    if (allIds.every((id) => selectedIds.includes(id))) {
      onSelectionChange(selectedIds.filter((id) => !allIds.includes(id)))
    } else {
      onSelectionChange([...new Set([...selectedIds, ...allIds])])
    }
  }

  if (loading) {
    return (
      <div
        className="rounded-lg border p-4 transition-all duration-200"
        style={{ backgroundColor: tableBg, borderColor }}
      >
        <SkeletonTable rows={5} cols={columns.length} />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-lg border p-8 text-center transition-all duration-200"
        style={{ backgroundColor: tableBg, borderColor }}
      >
        {emptyState ?? <p className="text-sm" style={{ color: textSecondary }}>No results</p>}
      </div>
    )
  }

  const allPageSelected = data.every((row) => selectedIds.includes(row.id as string))

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all duration-200"
      style={{ backgroundColor: tableBg, borderColor }}
    >
      {/* Bulk actions toolbar */}
      {selectable && selectedIds.length > 0 && bulkActions && (
        <div
          className="flex items-center gap-3 px-4 py-2"
          style={{ backgroundColor: headerBg, borderBottom: `1px solid ${borderColor}` }}
        >
          <span className="text-xs" style={{ color: textSecondary }}>{selectedIds.length} selected</span>
          {bulkActions}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: headerBg, color: textSecondary }} className="text-xs uppercase">
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAll}
                    className="rounded"
                    style={{ borderColor, backgroundColor: tableBg }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium tracking-wider"
                >
                  {col.sortable && onSort ? (
                    <button
                      onClick={() => onSort(col.key)}
                      className="flex items-center gap-1 transition-colors"
                      onMouseEnter={(e) => { e.currentTarget.style.color = textPrimary }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = textSecondary }}
                    >
                      {col.header}
                      {sortBy === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )
                      ) : (
                        <ChevronDown className="w-3 h-3 opacity-30" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const rowId = row.id as string
              const isSelected = selectedIds.includes(rowId)
              return (
                <tr
                  key={rowId ?? i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className="transition-colors duration-150"
                  style={{
                    borderTop: i > 0 ? `1px solid ${borderColor}` : undefined,
                    backgroundColor: isSelected ? hoverBg : undefined,
                    cursor: onRowClick ? 'pointer' : undefined,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? hoverBg : '' }}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(rowId)}
                        className="rounded"
                        style={{ borderColor, backgroundColor: tableBg }}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3" style={{ color: textPrimary }}>
                      {col.render
                        ? col.render(row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(onPageChange || onPageSizeChange) && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: textSecondary }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="border rounded px-2 py-1"
              style={{ backgroundColor: tableBg, borderColor, color: textPrimary }}
            >
              {[25, 50, 100].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: textSecondary }}>
            <span>
              {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 rounded active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }}
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: isDark ? '#1A1A1A' : '#E5E5E5' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
