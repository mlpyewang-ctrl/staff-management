'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getDepartments } from '@/server/actions/department'
import { getApprovalFlows, saveApprovalFlow } from '@/server/actions/approvalFlow'
import { APPLICATION_TYPES, APPLICATION_TYPE_LABELS, ApplicationType } from '@/lib/approval-constants'

export default function ApprovalFlowsDashboardPage() {
  const { data: session } = useSession()
  const [departments, setDepartments] = useState<any[]>([])
  const [flows, setFlows] = useState<any[]>([])
  const [editingFlow, setEditingFlow] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [selectedTypes, setSelectedTypes] = useState<ApplicationType[]>([])

  useEffect(() => {
    const load = async () => {
      const [depts, fs] = await Promise.all([getDepartments(), getApprovalFlows()])
      setDepartments(depts)
      setFlows(fs)
    }
    load()
  }, [])

  // 当编辑流程时，设置已选类型
  useEffect(() => {
    if (editingFlow?.types) {
      try {
        const types = JSON.parse(editingFlow.types)
        setSelectedTypes(types)
      } catch {
        setSelectedTypes([])
      }
    } else {
      setSelectedTypes([])
    }
  }, [editingFlow])

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">审批流程配置</h1>
        <p className="text-gray-600">仅管理员可以访问此页面。</p>
      </div>
    )
  }

  const handleTypeToggle = (type: ApplicationType) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    if (editingFlow) {
      formData.set('id', editingFlow.id)
    }
    // 添加类型数据
    formData.set('types', JSON.stringify(selectedTypes))

    const result = await saveApprovalFlow(formData)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else if (result.success) {
      setMessage({ type: 'success', text: result.success })
      const fs = await getApprovalFlows()
      setFlows(fs)
      setEditingFlow(null)
      setSelectedTypes([])
      form.reset()
    }

    setLoading(false)
  }

  // 解析流程的类型用于显示
  const getFlowTypes = (flow: any): string => {
    try {
      const types: string[] = JSON.parse(flow.types)
      return types.map(t => APPLICATION_TYPE_LABELS[t as ApplicationType] || t).join('、') || '-'
    } catch {
      return '-'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">审批流程配置</h1>
          <p className="text-gray-600 mt-1">为不同部门配置审批流程</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingFlow ? '编辑审批流程' : '新增审批流程'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="departmentId">部门</Label>
                <select
                  id="departmentId"
                  name="departmentId"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  defaultValue={editingFlow?.departmentId || ''}
                  required
                >
                  <option value="">请选择部门</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">流程名称</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingFlow?.name || ''}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>申请类型（可多选）</Label>
              <div className="flex flex-wrap gap-3">
                {APPLICATION_TYPES.map((type) => (
                  <label
                    key={type}
                    className={`inline-flex items-center px-4 py-2 rounded-md border cursor-pointer transition-colors ${
                      selectedTypes.includes(type)
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedTypes.includes(type)}
                      onChange={() => handleTypeToggle(type)}
                    />
                    {APPLICATION_TYPE_LABELS[type]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                同一部门下，每种类型只能属于一个审批流程
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="config">审批配置（JSON）</Label>
              <textarea
                id="config"
                name="config"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={4}
                defaultValue={
                  editingFlow?.config
                    ? editingFlow.config
                    : JSON.stringify({ approverRole: 'MANAGER' }, null, 2)
                }
              />
              <p className="text-xs text-gray-500">
                例如：{" "}
                {`{ "approverRole": "MANAGER" }`} 表示该部门由主管审批。
              </p>
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex space-x-2">
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
              {editingFlow && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingFlow(null)
                    setSelectedTypes([])
                  }}
                >
                  取消编辑
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>审批流程列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>部门</TableHead>
                <TableHead>流程名称</TableHead>
                <TableHead>申请类型</TableHead>
                <TableHead>配置摘要</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    暂无审批流程
                  </TableCell>
                </TableRow>
              ) : (
                flows.map((flow) => (
                  <TableRow key={flow.id}>
                    <TableCell>{flow.department?.name || '-'}</TableCell>
                    <TableCell>{flow.name}</TableCell>
                    <TableCell>{getFlowTypes(flow)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {flow.config}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingFlow(flow)}
                      >
                        编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
