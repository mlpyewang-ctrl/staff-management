# 劳务派遣员工管理系统

一个基于 `Next.js 14 + Prisma + PostgreSQL` 的劳务派遣员工管理系统，覆盖员工档案、部门岗位、加班、请假、调休、绩效、审批流和薪资管理等场景。

## 功能概览

### 员工端
- 个人信息维护
- 加班申请、请假申请、调休申请
- 绩效自评与记录查看
- 查看个人部门、岗位、职级、薪资信息

### 主管端
- 审批本部门流程中的申请单
- 查看审批中心待办
- 参与绩效考核流程

### 管理员端
- 部门管理、岗位管理、人员岗位管理
- 审批流配置
- 薪资生成、薪资明细、按月导出 Excel
- 统一维护员工岗位、部门和岗位职级，避免个人或主管随意修改

## 技术栈

- 前端：`Next.js 14`、`React 18`、`TypeScript`
- UI：`Tailwind CSS`
- 数据库：`PostgreSQL`
- ORM：`Prisma`
- 认证：`NextAuth.js`
- 测试：`Vitest`

## 本地开发

### 环境要求

- `Node.js 18+`，推荐 `Node.js 20`
- `npm 9+`
- `PostgreSQL`（本地或远程）

### 初始化环境变量

```bash
cp .env.example .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

关键变量：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥 |
| `NEXTAUTH_URL` | 应用访问地址 |

生成 `NEXTAUTH_SECRET`：

```bash
openssl rand -base64 32
```

### 启动本地环境

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

访问：`http://localhost:3000`

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发环境 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run test` | 运行测试 |
| `npm run db:push` | 同步 Prisma Schema 到数据库 |
| `npm run db:seed` | 初始化示例数据 |
| `npm run db:studio` | 打开 Prisma Studio |

## 测试账号

默认测试密码：`password123`

| 角色 | 邮箱 |
| --- | --- |
| 管理员 | `admin@zltech.com` |
| 技术部主管 | `tech.manager@zltech.com` |
| 人事部主管 | `hr.manager@zltech.com` |
| 员工示例 | `wang.qiang@zltech.com`、`zhao.li@zltech.com`、`chen.ming@zltech.com` |

## 离线服务器部署（Native 方式）

本项目使用 **Native 原生部署**：在联网 Windows 机器上打包，拷贝到离线 Linux 服务器（如 CentOS 7.9）直接运行 Node.js。

### 环境要求

- 联网打包机：Windows 10+，已安装 Node.js 20 + npm
- 离线服务器：CentOS 7.9，安装 [unofficial-builds.nodejs.org](https://unofficial-builds.nodejs.org/) 的 `linux-x64-glibc-217` 版本 Node.js
- 数据库：外部 PostgreSQL（可部署在独立服务器）

### 1. 联网机器打包

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-offline-native.ps1
```

执行完成后，会在 `.offline-native-bundle/` 下生成：

```text
.offline-native-bundle/
└─ 20260428-123456/
   ├─ package.json
   ├─ package-lock.json
   ├─ next.config.js
   ├─ .env.prod.example
   ├─ .env.example
   ├─ prisma/
   ├─ public/
   ├─ .next/
   └─ node_modules/
└─ staff-management-20260428-123456.tar.gz
```

### 2. 拷贝到离线服务器

把 `.tar.gz` 包拷贝到离线服务器任意目录：

```bash
# 服务器上解压
tar -xzf staff-management-20260428-123456.tar.gz
cd staff-management-20260428-123456
```

### 3. 配置环境变量

```bash
cp .env.prod.example .env
```

编辑 `.env`，重点配置：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 外部 PostgreSQL 连接串 |
| `NEXTAUTH_SECRET` | 生产密钥，必须替换 |
| `NEXTAUTH_URL` | 访问地址，如 `http://服务器IP:3000` |
| `TZ` | 时区，默认 `Asia/Shanghai` |
| `RUN_DB_PUSH` | 启动时自动同步表结构，默认 `true` |
| `RUN_DB_SEED` | 是否初始化种子数据，默认 `false` |

### 4. 启动服务

```bash
chmod +x node_modules/.bin/*
npm start
```

应用默认监听 `3000` 端口，访问 `http://服务器IP:3000`。

### 5. 后续版本更新

重复打包 → 拷贝 → 解压 → 覆盖旧目录 → `npm start` 即可。

> 首次部署会自动 `prisma db push` 同步表结构。如需初始化数据，可临时设置 `RUN_DB_SEED=true`。

## 项目结构

```text
staff-management/
├─ prisma/                    # Prisma schema 与种子数据
├─ scripts/                   # 部署与离线打包脚本
│  └─ build-offline-native.ps1 # Native 离线打包脚本
├─ src/
│  ├─ app/                    # Next.js App Router 页面
│  ├─ components/             # UI 与布局组件
│  ├─ lib/                    # 工具函数、认证、校验
│  ├─ server/actions/         # Server Actions
│  ├─ test/                   # 测试初始化
│  └─ types/                  # 类型定义
├─ .env.example               # 本地开发环境变量模板
├─ .env.prod.example          # 生产环境变量模板
├─ next.config.js             # Next.js 配置
└─ README.md
```

## 注意事项

- 当前仓库没有 Prisma Migration 文件，生产环境默认通过 `prisma db push` 同步表结构
- 如果后续改为正式 migration，建议将启动逻辑改为 `prisma migrate deploy`
- 离线服务器需提前安装 Node.js（glibc-217 非官方构建版本）
- `.offline-native-bundle/` 目录不要提交到 Git
- 项目使用 `bcryptjs`（纯 JS）替代 `bcrypt`（C++ 原生），因此 Windows 打包的 `node_modules` 可直接在 Linux 运行
- Prisma 已配置 `binaryTargets = ["native", "rhel-openssl-1.0.x"]`，CentOS 7 查询引擎已包含在 bundle 中

## 验证

建议在打包前先执行：

```bash
npm run build
npm test
```
