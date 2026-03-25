export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 50]

export function getTotalPages(totalItems: number, pageSize: number) {
  if (pageSize <= 0) {
    return 1
  }

  return Math.max(1, Math.ceil(totalItems / pageSize))
}

export function getPaginationState(totalItems: number, currentPage: number, pageSize: number) {
  const totalPages = getTotalPages(totalItems, pageSize)
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    currentPage: safeCurrentPage,
    endIndex,
    pageSize,
    startIndex,
    totalItems,
    totalPages,
  }
}
