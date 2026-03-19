# 劳务派遣员工管理系统

一个基于 Next.js 的劳务派遣员工管理系统，支持员工管理、加班申请、请假申请、调休管理、薪资结算和可配置审批流程等功能。

## 技术栈

- **前端**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL (Docker)
- **ORM**: Prisma
- **认证**: NextAuth.js

## 环境要求

- Node.js 18+
- Docker & Docker Compose (或 Colima on macOS)
- npm 或 yarn

## 快速启动

### 1. 启动数据库

```bash
# 启动 PostgreSQL 容器
docker-compose up -d

# 查看容器状态
docker-compose ps
```

### 2. 安装依赖

```bash
npm install
```

### 3. 同步数据库结构

```bash
npm run db:push
```

### 4. 初始化测试数据

```bash
npm run db:seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 一键启动脚本

```bash
# 启动数据库、同步结构、初始化数据、启动服务
docker-compose up -d && npm install && npm run db:push && npm run db:seed && npm run dev
```

## 数据库管理

```bash
# 打开 Prisma Studio (可视化数据库管理)
npm run db:studio
```

## 测试账号

所有账号密码均为: `password123`

### 管理员

| 邮箱 | 姓名 | 部门 | 角色 |
|------|------|------|------|
| admin@zltech.com | 系统管理员 | 人事部 | ADMIN |

### 部门经理

| 邮箱 | 姓名 | 部门 | 角色 |
|------|------|------|------|
| tech.manager@zltech.com | 张技术 | 技术部 | MANAGER |
| hr.manager@zltech.com | 李人事 | 人事部 | MANAGER |

### 普通员工

| 邮箱 | 姓名 | 部门 | 岗位 | 角色 |
|------|------|------|------|------|
| wang.qiang@zltech.com | 王强 | 技术部 | 工程师 | EMPLOYEE |
| zhao.li@zltech.com | 赵丽 | 技术部 | 初级工程师 | EMPLOYEE |
| chen.ming@zltech.com | 陈明 | 技术部 | 高级工程师 | EMPLOYEE |
| liu.fang@zltech.com | 刘芳 | 人事部 | 人事专员 | EMPLOYEE |
| sun.wei@zltech.com | 孙伟 | 财务部 | 财务专员 | EMPLOYEE |
| zhou.jie@zltech.com | 周杰 | 财务部 | 财务专员 | EMPLOYEE |

## 功能模块

### 员工功能
- 个人信息管理
- 加班申请（草稿/提交/退回后修改）
- 请假申请（草稿/提交/退回后修改）
- 绩效自评
- 调休管理

### 经理功能
- 部门员工管理
- 审批加班/请假申请
- 绩效考核评价

### 管理员功能
- 公司管理
- 部门管理
- 岗位管理
- 用户管理
- 审批流程配置
- 薪资管理（新增）
- 所有审批操作

### 新增功能

#### 薪资管理（仅管理员）
- 自动计算月度薪资
- 加班费计算（工作日1.5倍、周末2倍、节假日3倍）
- 超过36小时加班自动转调休
- 薪资详情展示小时薪资、计调休时长、转加班费时长、总加班时长
- 薪资列表按月份下拉筛选
- 薪资导出 CSV（可直接用 Excel 打开）
- 薪资状态管理（草稿/已确认/已支付）

#### 调休管理（所有用户）
- 查看累计调休时长
- 申请调休（一天8h/半天4h）
- 调休使用记录
- 调休来源记录

#### 日历模块（所有用户）
- 仪表盘显示日历
- 标注法定节假日

## 审批流规则

### 默认流程

- 同部门申请默认按“部门经理 -> 管理员”顺序审批
- 审批流程可在“审批流程配置”页面按部门维护

### 状态流转

- 员工保存申请时状态为 `DRAFT`
- 员工提交申请后状态为 `PENDING`
- 非最后一岗审批通过后，申请保持 `PENDING` 并流转到下一岗
- 最后一岗审批通过后，申请状态置为 `COMPLETED`
- 当前审批岗拒绝后，申请退回上一岗；如果当前就是第一岗，则退回申请人并恢复为 `DRAFT`

### 退回后修改

- 退回给申请人的单据支持继续编辑
- 申请人修改后再次提交时，会重新发起审批流程
- 已完成的单据不可再编辑

## 项目结构

```
staff-management/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── seed.ts                # 测试数据脚本
├── scripts/
│   └── init-db.js             # 数据库初始化脚本
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # 需要登录的页面（路由组）
│   │   │   ├── dashboard/     # 所有功能页面
│   │   │   │   ├── approval-flows/   # 审批流程配置
│   │   │   │   ├── approvals/        # 审批中心
│   │   │   │   ├── compensatory/     # 调休管理
│   │   │   │   ├── departments/      # 部门管理
│   │   │   │   ├── leave/            # 请假管理
│   │   │   │   ├── overtime/         # 加班申请
│   │   │   │   ├── performance/      # 绩效管理
│   │   │   │   ├── positions/        # 岗位管理
│   │   │   │   ├── profile/          # 个人信息
│   │   │   │   └── salary/           # 薪资管理
│   │   │   └── layout.tsx    # Dashboard 布局
│   │   ├── api/              # API 路由
│   │   │   └── auth/[...nextauth]/  # NextAuth 认证
│   │   ├── auth/             # 登录/注册页面
│   │   ├── globals.css       # 全局样式
│   │   ├── layout.tsx        # 根布局
│   │   └── page.tsx          # 首页
│   ├── components/
│   │   ├── layout/           # 布局组件（header, sidebar）
│   │   ├── providers.tsx     # Context Providers
│   │   └── ui/               # UI 基础组件
│   ├── lib/
│   │   ├── __tests__/        # 工具函数测试
│   │   ├── approval-constants.ts  # 审批相关常量
│   │   ├── approval-workflow.ts   # 审批流节点与状态计算
│   │   ├── prisma.ts         # Prisma 客户端
│   │   ├── utils.ts          # 工具函数
│   │   └── validations.ts    # Zod 验证规则
│   ├── server/actions/       # Server Actions（后端逻辑）
│   │   ├── __tests__/        # Server Actions 测试
│   │   ├── approval.ts       # 审批操作
│   │   ├── approvalFlow.ts   # 审批流程
│   │   ├── auth.ts           # 认证
│   │   ├── compensatory.ts   # 调休管理
│   │   ├── department.ts     # 部门管理
│   │   ├── holiday.ts        # 节假日管理
│   │   ├── leave.ts          # 请假管理
│   │   ├── overtime.ts       # 加班管理
│   │   ├── performance.ts    # 绩效管理
│   │   ├── position.ts       # 岗位管理
│   │   ├── salary.ts         # 薪资管理
│   │   └── user.ts           # 用户管理
│   ├── test/                 # 测试配置
│   │   └── setup.ts          # 测试环境设置
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   └── middleware.ts         # Next.js 中间件（认证）
├── vitest.config.ts          # Vitest 配置
├── docker-compose.yml        # Docker 配置
├── .env                      # 环境变量
├── package.json
└── README.md
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run db:push` | 同步数据库结构 |
| `npm run db:seed` | 初始化测试数据 |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm run test` | 运行测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `docker-compose up -d` | 启动数据库容器 |
| `docker-compose down` | 停止数据库容器 |

## 测试

项目使用 Vitest 作为测试框架，包含以下测试：

- **验证规则测试** (`src/lib/__tests__/validations.test.ts`)：测试所有 Zod 验证规则
- **审批流测试** (`src/lib/__tests__/approval-workflow.test.ts`)：测试审批节点推进、退回上一岗和退回申请人逻辑
- **Server Actions 测试** (`src/server/actions/__tests__/auth.test.ts`)：测试认证相关 Server Actions

```bash
# 运行所有测试
npm run test

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 环境变量配置

### 开发环境

1. 复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

2. 生成 `NEXTAUTH_SECRET`：

```bash
# macOS / Linux
openssl rand -base64 32

# Windows (PowerShell)
# 方法一：如果有 openssl
openssl rand -base64 32

# 方法二：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

3. 将生成的密钥填入 `.env` 文件的 `NEXTAUTH_SECRET`。

### 生产环境

在生产环境中，需要配置以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:password@host:5432/dbname` |
| `NEXTAUTH_SECRET` | JWT 加密密钥（**必须**随机生成） | 长度至少 32 字符的随机字符串 |
| `NEXTAUTH_URL` | 应用访问地址 | `https://your-domain.com` |

#### 生成 NEXTAUTH_SECRET

**重要**：生产环境必须使用强随机密钥，不要使用示例中的值！

```bash
# 推荐方式
openssl rand -base64 32
```

#### 部署平台配置示例

**Vercel / Netlify / Railway 等 PaaS 平台**：

在平台的环境变量设置页面添加：
- `NEXTAUTH_SECRET` = 你的随机密钥
- `NEXTAUTH_URL` = 你的生产域名
- `DATABASE_URL` = 生产数据库连接字符串

**Docker 部署**：

```bash
docker run -d \
  -e NEXTAUTH_SECRET="your-production-secret" \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e DATABASE_URL="postgresql://..." \
  -p 3000:3000 \
  your-image
```

**Docker Compose**：

```yaml
services:
  app:
    environment:
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - DATABASE_URL=${DATABASE_URL}
```

### 环境变量完整示例

```env
# 数据库配置
DATABASE_URL="postgresql://staff:staff_password@127.0.0.1:5432/staff_management?schema=public"

# NextAuth 配置
NEXTAUTH_SECRET="your-generated-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"  # 生产环境改为 https://your-domain.com
```

### 常见问题

**Q: 启动时报 `JWEDecryptionFailed: decryption operation failed`**

A: 这通常是因为：
1. `NEXTAUTH_SECRET` 未配置或使用了占位符
2. 更换了 `NEXTAUTH_SECRET` 但浏览器有旧的登录 cookie

解决方法：
1. 确保 `.env` 中有正确的 `NEXTAUTH_SECRET`
2. 清除浏览器 cookie（F12 → Application → Cookies → Clear）
3. 重启开发服务器

## 测试数据说明

种子数据脚本 (`prisma/seed.ts`) 会创建:

- 1 个公司: 智联科技有限公司
- 3 个部门: 技术部、人事部、财务部
- 5 个岗位: 高级工程师、工程师、初级工程师、人事专员、财务专员
- 9 个用户: 1 管理员 + 2 经理 + 6 员工
- 每个用户的假期余额
- 每个部门的审批流程配置
- 示例加班申请、请假申请、绩效考核记录
- **新增：2024-2026年法定节假日数据**
- **新增：测试加班申请数据（覆盖不同场景）**
- **新增：测试薪资记录数据**
- **新增：调休余额数据**

### 测试场景覆盖

| 场景 | 说明 |
|------|------|
| 加班 < 36h | 全部计入加班费 |
| 加班 > 36h | 超出部分自动转调休 |
| 混合加班类型 | 按优先级转调休（节假日>周末>工作日） |
| 调休使用 | 申请调休，走审批流程 |
| 审批通过 | 中间岗通过后流转下一岗，最后一岗通过后置为完成 |
| 审批退回 | 拒绝时退回上一岗，首岗拒绝则退回申请人并允许修改 |
| 薪资导出 | CSV 导出测试（可直接用 Excel 打开） |

### 测试用户调休数据

| 用户 | 累计调休 | 说明 |
|------|---------|------|
| 陈明 | 12h | 从上月加班结转 |
| 赵丽 | 8h | 从上月加班结转 |

### 测试用户薪资说明

| 用户 | 月份 | 特点 |
|------|------|------|
| 王强 | 2026-01 | 有已确认薪资记录，适合验证普通计薪场景 |
| 陈明 | 2026-01 | 有已支付薪资记录，适合验证超 36h 转调休场景 |
| 赵丽 | 2026-01 | 有草稿薪资记录，适合验证详情页与状态流转 |

## stop 服务
docker-compose down
