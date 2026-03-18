'use server'

import { prisma } from '@/lib/prisma'
import { userProfileSchema } from '@/lib/validations'

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      position: true,
    },
  })

  return user
}

export async function updateUserProfile(userId: string, formData: FormData) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c6fae'},body:JSON.stringify({sessionId:'9c6fae',runId:'pre-fix',hypothesisId:'A',location:'src/server/actions/user.ts:22',message:'updateUserProfile formData snapshot',data:{userId,keys:Array.from(formData.keys()),departmentId:formData.get('departmentId')===null?null:'(present)',positionId:formData.get('positionId')===null?null:'(present)',salary:formData.get('salary')===null?null:'(present)',level:formData.get('level')===null?null:'(present)',startDate:formData.get('startDate')===null?null:'(present)'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const getString = (key: string) => {
      const v = formData.get(key)
      return typeof v === 'string' ? v : undefined
    }

    const validated = userProfileSchema.parse({
      name: getString('name'),
      idCard: getString('idCard'),
      phone: getString('phone'),
      salary: getString('salary'),
      level: getString('level'),
      departmentId: getString('departmentId'),
      positionId: getString('positionId'),
      startDate: getString('startDate'),
    })

    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c6fae'},body:JSON.stringify({sessionId:'9c6fae',runId:'pre-fix',hypothesisId:'B',location:'src/server/actions/user.ts:44',message:'updateUserProfile validated summary',data:{userId,departmentId:validated.departmentId??null,positionId:validated.positionId??null,hasSalary:validated.salary!==undefined,hasLevel:!!validated.level,startDate:validated.startDate??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const startDate =
      validated.startDate && validated.startDate !== ''
        ? new Date(validated.startDate)
        : undefined

    // If positionId is provided, get the salary and level from the position
    let salaryData = validated.salary
    let levelData = validated.level

    if (validated.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: validated.positionId },
      })
      // #region agent log
      fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c6fae'},body:JSON.stringify({sessionId:'9c6fae',runId:'pre-fix',hypothesisId:'B',location:'src/server/actions/user.ts:63',message:'position lookup result',data:{userId,positionId:validated.positionId,found:!!position},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (position) {
        salaryData = position.salary
        levelData = position.level || undefined
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: validated.name,
        idCard: validated.idCard || null,
        phone: validated.phone || null,
        salary: salaryData,
        level: levelData || null,
        departmentId: validated.departmentId || null,
        positionId: validated.positionId || null,
        startDate: startDate,
      },
    })

    return { success: '个人信息已更新', user }
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7875/ingest/9ebff9d1-0e95-46e2-b9d7-c6c26881e0ee',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c6fae'},body:JSON.stringify({sessionId:'9c6fae',runId:'pre-fix',hypothesisId:'A',location:'src/server/actions/user.ts:80',message:'updateUserProfile error',data:{userId,errorName:(error as any)?.name,errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: '更新失败，请稍后重试' }
  }
}

