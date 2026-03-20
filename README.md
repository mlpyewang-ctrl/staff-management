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
- 部署：`Docker`、`Docker Compose`

## 本地开发

### 环境要求

- `Node.js 18+`，推荐 `Node.js 20`
- `npm 9+`
- `Docker` / `Docker Compose`

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
| `POSTGRES_*` | 本地 Docker PostgreSQL 配置 |

生成 `NEXTAUTH_SECRET`：

```bash
openssl rand -base64 32
```

### 启动本地环境

```bash
docker compose up -d
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
| `npm run test` | 运行测试 |
| `npm run db:push` | 同步 Prisma Schema 到数据库 |
| `npm run db:seed` | 初始化示例数据 |
| `npm run db:studio` | 打开 Prisma Studio |
| `docker compose up -d` | 启动本地 PostgreSQL |
| `docker compose down` | 停止本地 PostgreSQL |

## 测试账号

默认测试密码：`password123`

| 角色 | 邮箱 |
| --- | --- |
| 管理员 | `admin@zltech.com` |
| 技术部主管 | `tech.manager@zltech.com` |
| 人事部主管 | `hr.manager@zltech.com` |
| 员工示例 | `wang.qiang@zltech.com`、`zhao.li@zltech.com`、`chen.ming@zltech.com` |

## 离线服务器部署

你的场景是离线服务器，所以推荐使用“联网环境提前打包镜像 + 离线服务器直接 `docker load` 运行”的方式。

这套方案已经在仓库里准备好：

- `Dockerfile`：构建应用镜像
- `docker-compose.prod.yml`：生产部署编排
- `.env.prod.example`：生产环境变量模板
- `scripts/docker-entrypoint.sh`：容器启动时自动执行 `prisma db push`
- `scripts/build-offline-bundle.ps1`：Windows 联网环境打包脚本
- `scripts/build-offline-bundle.sh`：Linux/macOS 联网环境打包脚本
- `scripts/install-offline-bundle.sh`：离线服务器导入并启动脚本

### 方案说明

在有网络的机器上：
1. 拉取基础镜像依赖（如 `postgres:16-alpine`）
2. 构建应用镜像
3. 将应用镜像和数据库镜像导出为 `.tar`
4. 连同 `docker-compose.prod.yml`、`.env.prod.example` 一起打成离线发布目录

在离线服务器上：
1. 拷贝离线发布目录
2. 配置 `.env.prod`
3. 执行 `docker load`
4. 直接 `docker compose up -d`

也就是说，离线服务器不需要联网拉依赖、不需要联网拉镜像。

## 1. 联网机器打离线包

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-offline-bundle.ps1
```

### Linux / macOS

```bash
sh ./scripts/build-offline-bundle.sh
```

执行完成后，会生成一个类似下面的目录：

```text
.offline-bundle/
└─ 20260320-143000/
   ├─ bundle-info.txt
   ├─ docker-compose.prod.yml
   ├─ .env.prod.example
   ├─ images/
   │  ├─ app-image.tar
   │  └─ postgres-image.tar
   └─ scripts/
      ├─ docker-entrypoint.sh
      └─ install-offline-bundle.sh
```

默认镜像：
- 应用镜像：`staff-management-app:offline`
- 数据库镜像：`postgres:16-alpine`

如果你要改镜像名，可在脚本里传参或设置环境变量。

## 2. 拷贝到离线服务器

把生成的整个离线目录拷到服务器，例如：

```text
/opt/staff-management-offline/
```

拷贝方式不限：
- U 盘
- 局域网共享
- 堡垒机中转
- `scp` 到一台可达机器后再转存

## 3. 在离线服务器上启动

进入离线目录：

```bash
cd /opt/staff-management-offline/20260320-143000
```

复制环境变量模板：

```bash
cp .env.prod.example .env.prod
```

然后修改 `.env.prod`，重点确认这些值：

| 变量 | 说明 |
| --- | --- |
| `APP_PORT` | 对外端口，默认 `3000` |
| `POSTGRES_PORT` | 数据库对外端口，默认 `5432` |
| `POSTGRES_USER` | PostgreSQL 用户 |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 |
| `POSTGRES_DB` | PostgreSQL 数据库名 |
| `DATABASE_URL` | 应用连接数据库的地址，默认走 compose 内部 `postgres` 服务 |
| `NEXTAUTH_SECRET` | 生产密钥，必须替换 |
| `NEXTAUTH_URL` | 访问地址，如 `http://服务器IP:3000` |
| `RUN_DB_PUSH` | 启动时自动同步表结构，默认 `true` |
| `RUN_DB_SEED` | 是否初始化种子数据，默认 `false` |

启动：

```bash
sh scripts/install-offline-bundle.sh
```

这个脚本会自动执行：

```bash
docker load -i images/postgres-image.tar
docker load -i images/app-image.tar
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 查看状态

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

### 查看日志

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f app
```

### 停止服务

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod down
```

## 4. 后续版本更新

如果有新版本，重复一遍“联网机器打包 -> 拷贝到离线服务器 -> 重新 load + up -d”即可。

推荐更新方式：

1. 在联网机器重新执行离线打包脚本
2. 把新的离线目录拷到服务器
3. 进入新目录后再次执行：

```bash
sh scripts/install-offline-bundle.sh
```

Docker 会用新镜像替换旧容器。

## 生产环境文件说明

### `docker-compose.prod.yml`

- 同时启动 `app` 和 `postgres`
- `app` 默认使用本地镜像 `staff-management-app:offline`
- `postgres` 默认使用本地镜像 `postgres:16-alpine`

### `.env.prod.example`

默认示例：

```env
APP_PORT=3000
POSTGRES_PORT=5432
POSTGRES_IMAGE=postgres:16-alpine
POSTGRES_USER=staff
POSTGRES_PASSWORD=change_me
POSTGRES_DB=staff_management
TZ=Asia/Shanghai

IMAGE_NAME=staff-management-app
IMAGE_TAG=offline

DATABASE_URL=postgresql://staff:change_me@postgres:5432/staff_management?schema=public
NEXTAUTH_SECRET=replace_with_a_random_secret
NEXTAUTH_URL=http://your-server-ip:3000

RUN_DB_PUSH=true
RUN_DB_SEED=false
```

## 项目结构

```text
staff-management/
├─ prisma/                    # Prisma schema 与种子数据
├─ scripts/                   # 启动、部署、离线打包脚本
├─ src/
│  ├─ app/                    # Next.js App Router 页面
│  ├─ components/             # UI 与布局组件
│  ├─ lib/                    # 工具函数、认证、校验
│  ├─ server/actions/         # Server Actions
│  ├─ test/                   # 测试初始化
│  └─ types/                  # 类型定义
├─ .github/workflows/         # GitHub Actions 工作流（可选）
├─ docker-compose.yml         # 本地 PostgreSQL
├─ docker-compose.prod.yml    # 生产部署编排
├─ Dockerfile                 # 应用镜像
└─ README.md
```

## 注意事项

- 当前仓库没有 Prisma Migration 文件，生产环境默认通过 `prisma db push` 同步表结构
- 如果后续改为正式 migration，建议将容器启动逻辑改为 `prisma migrate deploy`
- 离线服务器首次部署前，请先确认已安装 `Docker` 和 `Docker Compose`
- 如果服务器完全不能联网，`postgres` 镜像也必须通过离线包带过去，所以不要只拷应用镜像
- `.offline-bundle/` 目录建议不要提交到 Git

## 验证

建议在打包前先执行：

```bash
npm run build
npm test
```
