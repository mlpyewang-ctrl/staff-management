'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { getStaffJobAssignments, getUserProfileChangeHistory } from '@/server/actions/user'

type StaffList = Awaited<ReturnType<typeof getStaffJobAssignments>>
type HistoryDetail = Awaited<ReturnType<typeof getUserProfileChangeHistory>>
type HistoryUser = NonNullable<HistoryDetail>
type ChangeLog = HistoryUser['profileChangeLogs'][number]

interface ChangeEntry {
  label: string
  before: string
  after: string
}

function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }

  return parsed.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActionLabel(actionType: string) {
  if (actionType === 'JOB_ASSIGNMENT_UPDATE') {
    return '任职信息'
  }

  return '个人信息'
}

function getActionTone(actionType: string) {
  if (actionType === 'JOB_ASSIGNMENT_UPDATE') {
    return 'bg-blue-100 text-blue-700'
  }

  return 'bg-emerald-100 text-emerald-700'
}

function extractChangeEntries(log: ChangeLog): ChangeEntry[] {
  const rawChanges = log.changes as unknown

  if (!Array.isArray(rawChanges)) {
    return []
  }

  return rawChanges.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const candidate = item as Partial<ChangeEntry>
    if (
      typeof candidate.label !== 'string' ||
      typeof candidate.before !== 'string' ||
      typeof candidate.after !== 'string'
    ) {
      return []
    }

    return [{ label: candidate.label, before: candidate.before, after: candidate.after }]
  })
}

export default function ProfileHistoryPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<StaffList>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [history, setHistory] = useState<HistoryDetail>(null)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    const loadUsers = async () => {
      if (session?.user?.role !== 'ADMIN') {
        setLoading(false)
        return
      }

      const userList = await getStaffJobAssignments()
      setUsers(userList)
      setSelectedUserId(userList[0]?.id || '')
      setLoading(false)
    }

    loadUsers()
  }, [session?.user?.role])

  useEffect(() => {
    const loadHistory = async () => {
      if (!selectedUserId || session?.user?.role !== 'ADMIN') {
        setHistory(null)
        return
      }

      setHistoryLoading(true)
      const detail = await getUserProfileChangeHistory(selectedUserId)
      setHistory(detail)
      setHistoryLoading(false)
    }

    loadHistory()
  }, [selectedUserId, session?.user?.role])

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [selectedUserId, users]
  )

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">个人信息变更记录</h1>
        <p className="text-gray-600">仅管理员可以访问此页面。</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">个人信息变更记录</h1>
        <p className="mt-1 text-gray-600">查看员工个人信息和任职信息的操作留痕。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>选择员工</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <Label htmlFor="userId">员工</Label>
            <Select id="userId" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.username})
                </option>
              ))}
            </Select>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">加载员工中...</div>
          ) : selectedUser ? (
            <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <div className="font-medium text-gray-900">{selectedUser.name}</div>
              <div className="mt-1">{selectedUser.username}</div>
              <div className="mt-1">
                {selectedUser.department?.name || '未分配部门'} / {selectedUser.position?.name || '未设置岗位'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">暂无员工数据</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>变更日志</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {historyLoading ? (
            <div className="text-sm text-gray-500">加载记录中...</div>
          ) : history?.profileChangeLogs.length ? (
            history.profileChangeLogs.map((item) => {
              const changeEntries = extractChangeEntries(item)

              return (
                <div key={item.id} className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getActionTone(item.actionType)}`}>
                          {getActionLabel(item.actionType)}
                        </span>
                        <span className="text-sm text-gray-500">{item.summary}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        操作人：{item.actor.name} ({item.actor.username})
                      </div>
                      {item.remark ? <div className="text-sm text-gray-600">备注：{item.remark}</div> : null}
                    </div>
                    <div className="text-sm text-gray-500">{formatDateTime(item.createdAt)}</div>
                  </div>

                  <div className="space-y-2">
                    {changeEntries.map((change) => (
                      <div key={change.label} className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">{change.label}</div>
                        <div className="mt-1 grid gap-1 md:grid-cols-2">
                          <div>变更前：{change.before}</div>
                          <div>变更后：{change.after}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-sm text-gray-500">暂无变更记录</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
