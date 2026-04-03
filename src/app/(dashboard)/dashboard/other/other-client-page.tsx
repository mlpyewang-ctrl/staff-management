'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PaginationControls } from '@/components/ui/pagination-controls'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, getPaginationState } from '@/lib/pagination'
import { formatDateTime } from '@/lib/utils'
import { getOtherApplications } from '@/server/actions/otherApplication'
import type { Role } from '@/types'

type OtherApplicationsData = Awaited<ReturnType<typeof getOtherApplications>>
type OtherApplicationItem = OtherApplicationsData[number]

const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已退回',
  COMPLETED: '已完成',
}

const statusVariant: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'default',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  COMPLETED: 'success',
}

const typeMap: Record<string, string> = {
  RESIGNATION_HANDOVER: '离职交接',
  RESUME_UPDATE: '履历更新',
  PARTY_INFO_UPDATE: '党员信息更新',
}

interface OtherClientPageProps {
  initialApplications: OtherApplicationsData
  viewerId: string
  viewerRole: Role
}

export function OtherClientPage({
  initialApplications,
  viewerId,
  viewerRole,
}: OtherClientPageProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const canCreate = Boolean(viewerId)
  const canEdit = viewerRole === 'EMPLOYEE'

  useEffect(() => {
    setApplications(initialApplications)
  }, [initialApplications])

  const pagination = useMemo(
    () => getPaginationState(applications.length, page, pageSize),
    [applications.length, page, pageSize]
  )

  const paginatedApplications = useMemo(
    () => applications.slice(pagination.startIndex, pagination.endIndex),
    [applications, pagination.endIndex, pagination.startIndex]
  )

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    if (pagination.currentPage !== page) {
      setPage(pagination.currentPage)
    }
  }, [page, pagination.currentPage])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">其他事项申请</h1>
          <p className="mt-1 text-gray-600">提交离职交接、履历更新、党员信息更新等申请。</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/dashboard/other/new">新增申请</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>申请记录</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>事项类型</TableHead>
                <TableHead>申请标题</TableHead>
                {viewerRole !== 'EMPLOYEE' && <TableHead>申请人</TableHead>}
                <TableHead>申请内容</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>创建时间</TableHead>
                {canEdit && <TableHead>操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={viewerRole === 'EMPLOYEE' ? 7 : 8} className="py-8 text-center text-gray-500">
                    暂无申请记录
                  </TableCell>
                </TableRow>
              ) : (
                paginatedApplications.map((application) => (
                  <OtherApplicationRow
                    key={application.id}
                    application={application}
                    canEdit={canEdit}
                    showApplicant={viewerRole !== 'EMPLOYEE'}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardContent className="pt-0">
          <PaginationControls
            currentPage={pagination.currentPage}
            itemLabel="条申请记录"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalItems={applications.length}
            totalPages={pagination.totalPages}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function OtherApplicationRow({
  application,
  canEdit,
  showApplicant,
}: {
  application: OtherApplicationItem
  canEdit: boolean
  showApplicant: boolean
}) {
  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline">{typeMap[application.type] || application.type}</Badge>
      </TableCell>
      <TableCell className="font-medium">{application.title}</TableCell>
      {showApplicant && <TableCell>{application.userName}</TableCell>}
      <TableCell className="max-w-xs truncate">{application.content}</TableCell>
      <TableCell>
        <Badge variant={statusVariant[application.status] || 'default'}>
          {statusMap[application.status] || application.status}
        </Badge>
      </TableCell>
      <TableCell className="max-w-xs truncate">{application.remark || '-'}</TableCell>
      <TableCell>{formatDateTime(new Date(application.createdAt))}</TableCell>
      {canEdit && (
        <TableCell>
          {application.status === 'DRAFT' ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/other/${application.id}`}>编辑</Link>
            </Button>
          ) : (
            <span className="text-xs text-gray-400">审批中 / 已完成</span>
          )}
        </TableCell>
      )}
    </TableRow>
  )
}
