import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PaginationControlsProps {
  className?: string
  currentPage: number
  itemLabel?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSize: number
  pageSizeOptions?: number[]
  totalItems: number
  totalPages: number
}

export function PaginationControls({
  className,
  currentPage,
  itemLabel = '条记录',
  onPageChange,
  onPageSizeChange,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  totalItems,
  totalPages,
}: PaginationControlsProps) {
  return (
    <div className={cn('flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center">
        <span>{`共 ${totalItems} ${itemLabel}`}</span>
        <div className="flex items-center gap-2">
          <span>每页</span>
          <Select
            className="h-9 w-24"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} 条
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">{`第 ${currentPage} / ${totalPages} 页`}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          下一页
        </Button>
      </div>
    </div>
  )
}
