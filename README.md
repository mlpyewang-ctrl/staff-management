# 劳务派遣员工管理系统

一个基于 Next.js 的劳务派遣员工管理系统，支持员工管理、加班申请、请假申请、绩效考核等功能。

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
- 加班申请
- 请假申请
- 绩效自评

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
- 所有审批操作

## 项目结构

```
staff-management/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   ├── seed.ts                # 测试数据脚本
│   └── dev.db                 # SQLite 数据库文件（开发用）
├── scripts/
│   └── init-db.js             # 数据库初始化脚本
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # 需要登录的页面（路由组）
│   │   │   ├── dashboard/     # 所有功能页面
│   │   │   │   ├── approval-flows/   # 审批流程配置
│   │   │   │   ├── approvals/        # 审批中心
│   │   │   │   ├── departments/      # 部门管理
│   │   │   │   ├── leave/            # 请假管理
│   │   │   │   ├── overtime/         # 加班申请
│   │   │   │   ├── performance/      # 绩效管理
│   │   │   │   ├── positions/        # 岗位管理
│   │   │   │   └── profile/          # 个人信息
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
│   │   ├── prisma.ts         # Prisma 客户端
│   │   ├── utils.ts          # 工具函数
│   │   └── validations.ts    # Zod 验证规则
│   ├── server/actions/       # Server Actions（后端逻辑）
│   │   ├── __tests__/        # Server Actions 测试
│   │   ├── approval.ts       # 审批操作
│   │   ├── approvalFlow.ts   # 审批流程
│   │   ├── auth.ts           # 认证
│   │   ├── department.ts     # 部门管理
│   │   ├── leave.ts          # 请假管理
│   │   ├── overtime.ts       # 加班管理
│   │   ├── performance.ts    # 绩效管理
│   │   ├── position.ts       # 岗位管理
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

## stop 服务
docker-compose down