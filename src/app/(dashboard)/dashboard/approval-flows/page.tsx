'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getDepartments } from '@/server/actions/department'
import { getApprovalFlows, saveApprovalFlow } from '@/server/actions/approvalFlow'
import { getStaffJobAssignments } from '@/server/actions/user'
import { APPLICATION_TYPES, APPLICATION_TYPE_LABELS, ApplicationType } from '@/lib/approval-constants'
import { normalizeApprovalFlowSteps } from '@/lib/approval-workflow'

interface DepartmentOption {
  id: string
  name: string
}

interface ApprovalUserOption {
  id: string
  name: string
  role: string
  department?: {
    id: string
    name: string
  } | null
}

interface ApprovalFlowRecord {
  id: string
  departmentId: string
  name: string
  types: string
  config: string
  department?: DepartmentOption | null
}

interface ApprovalNodeForm {
  step: number
  name: string
  approverUserId: string
  approverUserName: string
  approverRole: string
}

interface ApprovalFlowFormState {
  departmentId: string
  name: string
  nodes: ApprovalNodeForm[]
}

const defaultNodes = (): ApprovalNodeForm[] => [
  {
    step: 1,
    name: '第1步审批',
    approverUserId: '',
    approverUserName: '',
    approverRole: '',
  },
  {
    step: 2,
    name: '第2步审批',
    approverUserId: '',
    approverUserName: '',
    approverRole: '',
  },
]

const createEmptyForm = (): ApprovalFlowFormState => ({
  departmentId: '',
  name: '',
  nodes: defaultNodes(),
})

function roleLabel(role: string) {
  if (role === 'ADMIN') {
    return '管理员'
  }

  if (role === 'MANAGER') {
    return '部门主管'
  }

  return '员工'
}

function parseTypes(types: string): ApplicationType[] {
  try {
    const parsed = JSON.parse(types)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is ApplicationType => APPLICATION_TYPES.includes(item as ApplicationType))
  } catch {
    return []
  }
}

function parseNodes(config: string): ApprovalNodeForm[] {
  return normalizeApprovalFlowSteps(config).map((step) => ({
    step: step.step,
    name: step.name,
    approverUserId: step.approverUserId || '',
    approverUserName: step.approverUserName || '',
    approverRole: step.role || '',
  }))
}

function formatNodeTarget(node: ApprovalNodeForm, users: ApprovalUserOption[]) {
  const matchedUser = users.find((item) => item.id === node.approverUserId)

  if (!matchedUser) {
    return '未选择员工'
  }

  return `${matchedUser.name}（${roleLabel(matchedUser.role)}${matchedUser.department?.name ? ` / ${matchedUser.department.name}` : ''}）`
}

function getFlowSummary(flow: ApprovalFlowRecord) {
  const steps = normalizeApprovalFlowSteps(flow.config)

  if (steps.length === 0) {
    return '-'
  }

  return steps
    .map((step) => {
      const target = step.approverUserName || step.approverUserId || '未选择员工'
      return `${step.step}. ${step.name} · ${target}`
    })
    .join(' / ')
}

function reindexNodes(nodes: ApprovalNodeForm[]) {
  return nodes.map((node, index) => ({
    ...node,
    step: index + 1,
  }))
}

export default function ApprovalFlowsDashboardPage() {
  const { data: session } = useSession()
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [users, setUsers] = useState<ApprovalUserOption[]>([])
  const [flows, setFlows] = useState<ApprovalFlowRecord[]>([])
  const [editingFlow, setEditingFlow] = useState<ApprovalFlowRecord | null>(null)
  const [formState, setFormState] = useState<ApprovalFlowFormState>(createEmptyForm())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success' | ''; text: string }>({ type: '', text: '' })
  const [selectedTypes, setSelectedTypes] = useState<ApplicationType[]>([])

  useEffect(() => {
    const load = async () => {
      const [depts, fs, staffUsers] = await Promise.all([getDepartments(), getApprovalFlows(), getStaffJobAssignments()])
      setDepartments(depts)
      setFlows(fs)
      setUsers(staffUsers)
    }

    load()
  }, [])

  useEffect(() => {
    if (!editingFlow) {
      setFormState(createEmptyForm())
      setSelectedTypes([])
      return
    }

    setFormState({
      departmentId: editingFlow.departmentId,
      name: editingFlow.name,
      nodes: parseNodes(editingFlow.config),
    })
    setSelectedTypes(parseTypes(editingFlow.types))
  }, [editingFlow])

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        ...user,
        label: `${user.name}（${roleLabel(user.role)}${user.department?.name ? ` / ${user.department.name}` : ''}）`,
      })),
    [users]
  )

  const flowLabels = useMemo(
    () =>
      flows.map((flow) => ({
        ...flow,
        labels: parseTypes(flow.types).map((type) => APPLICATION_TYPE_LABELS[type]),
      })),
    [flows]
  )

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">审批流程配置</h1>
        <p className="text-gray-600">仅管理员可以访问该页面。</p>
      </div>
    )
  }

  const handleTypeToggle = (type: ApplicationType) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]))
  }

  const updateNode = (index: number, patch: Partial<ApprovalNodeForm>) => {
    setFormState((current) => {
      const nextNodes = [...current.nodes]
      nextNodes[index] = {
        ...nextNodes[index],
        ...patch,
      }

      return {
        ...current,
        nodes: reindexNodes(nextNodes),
      }
    })
  }

  const addNode = () => {
    setFormState((current) => ({
      ...current,
      nodes: reindexNodes([
        ...current.nodes,
        {
          step: current.nodes.length + 1,
          name: `第${current.nodes.length + 1}步审批`,
          approverUserId: '',
          approverUserName: '',
          approverRole: '',
        },
      ]),
    }))
  }

  const removeNode = (index: number) => {
    setFormState((current) => {
      const nextNodes = current.nodes.filter((_, nodeIndex) => nodeIndex !== index)

      return {
        ...current,
        nodes: nextNodes.length > 0 ? reindexNodes(nextNodes) : defaultNodes(),
      }
    })
  }

  const moveNode = (index: number, direction: -1 | 1) => {
    setFormState((current) => {
      const targetIndex = index + direction

      if (targetIndex < 0 || targetIndex >= current.nodes.length) {
        return current
      }

      const nextNodes = [...current.nodes]
      const [movedNode] = nextNodes.splice(index, 1)
      nextNodes.splice(targetIndex, 0, movedNode)

      return {
        ...current,
        nodes: reindexNodes(nextNodes),
      }
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      if (!formState.departmentId || !formState.name.trim()) {
        setMessage({ type: 'error', text: '请先填写部门和流程名称' })
        return
      }

      if (selectedTypes.length === 0) {
        setMessage({ type: 'error', text: '请至少选择一种申请类型' })
        return
      }

      const nodes = formState.nodes.map((node, index) => {
        const matchedUser = users.find((item) => item.id === node.approverUserId)

        if (!matchedUser) {
          throw new Error(`第 ${index + 1} 个节点请选择审批员工`)
        }

        return {
          step: index + 1,
          name: node.name.trim() || `${matchedUser.name}审批`,
          approverType: 'USER',
          approverUserId: matchedUser.id,
          approverUserName: matchedUser.name,
          role: matchedUser.role.toUpperCase(),
        }
      })

      const formData = new FormData()
      formData.set('departmentId', formState.departmentId)
      formData.set('name', formState.name.trim())
      if (editingFlow) {
        formData.set('id', editingFlow.id)
      }
      formData.set('types', JSON.stringify(selectedTypes))
      formData.set('config', JSON.stringify(nodes))

      const result = await saveApprovalFlow(formData)

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({ type: 'success', text: result.success || '审批流程已保存' })
      const fs = await getApprovalFlows()
      setFlows(fs)
      setEditingFlow(null)
      setFormState(createEmptyForm())
      setSelectedTypes([])
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存审批流程失败' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">审批流程配置</h1>
        <p className="mt-1 text-gray-600">图形化配置审批节点，并按指定员工审批。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingFlow ? '编辑审批流程' : '新增审批流程'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="departmentId">部门</Label>
                <Select
                  id="departmentId"
                  value={formState.departmentId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      departmentId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">请选择部门</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">流程名称</Label>
                <Input
                  id="name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>申请类型</Label>
              <div className="flex flex-wrap gap-3">
                {APPLICATION_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeToggle(type)}
                    className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                      selectedTypes.includes(type)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {APPLICATION_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">同一个部门下，同一类型只能配置一个流程。</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>节点配置</Label>
                  <p className="text-xs text-gray-500">每个节点只选择具体员工，不按角色审批。</p>
                </div>
                <Button type="button" variant="outline" onClick={addNode}>
                  新增节点
                </Button>
              </div>

              <div className="space-y-4">
                {formState.nodes.map((node, index) => {
                  const isLast = index === formState.nodes.length - 1

                  return (
                    <div key={node.step} className="relative pl-12">
                      {!isLast && <div className="absolute left-5 top-10 h-full w-px bg-slate-200" />}
                      <div className="absolute left-0 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                        {node.step}
                      </div>
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">节点 {node.step}</Badge>
                                <Badge variant="success">指定员工</Badge>
                              </div>
                              <Input
                                value={node.name}
                                placeholder="例如：主厨审批"
                                onChange={(event) =>
                                  updateNode(index, {
                                    name: event.target.value,
                                  })
                                }
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={index === 0}
                                onClick={() => moveNode(index, -1)}
                              >
                                上移
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isLast}
                                onClick={() => moveNode(index, 1)}
                              >
                                下移
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => removeNode(index)}>
                                删除
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>审批员工</Label>
                            <Select
                              value={node.approverUserId}
                              onChange={(event) => {
                                const matchedUser = users.find((item) => item.id === event.target.value)

                                updateNode(index, {
                                  approverUserId: matchedUser?.id || '',
                                  approverUserName: matchedUser?.name || '',
                                  approverRole: matchedUser?.role?.toUpperCase() || '',
                                  name: node.name.trim() || (matchedUser ? `${matchedUser.name}审批` : node.name),
                                })
                              }}
                            >
                              <option value="">请选择员工</option>
                              {userOptions.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.label}
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            当前节点：{node.name || '未命名'} · {formatNodeTarget(node, users)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })}
              </div>
            </div>

            {message.text && (
              <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存审批流程'}
              </Button>
              {editingFlow && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingFlow(null)
                    setFormState(createEmptyForm())
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
                <TableHead>节点摘要</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flowLabels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-gray-500">
                    暂无审批流程
                  </TableCell>
                </TableRow>
              ) : (
                flowLabels.map((flow) => (
                  <TableRow key={flow.id}>
                    <TableCell>{flow.department?.name || '-'}</TableCell>
                    <TableCell>{flow.name}</TableCell>
                    <TableCell>{flow.labels.join('、') || '-'}</TableCell>
                    <TableCell className="max-w-[360px] text-sm text-gray-600">{getFlowSummary(flow)}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setEditingFlow(flow)}>
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
