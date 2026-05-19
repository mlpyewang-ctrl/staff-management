# 劳务派遣员工管理系统 — 部署指南

## 一、环境要求

| 环境 | 要求 |
|------|------|
| 打包机 | Windows 10+，Node.js 20+，npm 9+，PowerShell |
| 生产服务器 | CentOS 7.9（或兼容 glibc 2.17 的 Linux），Node.js 20（glibc-217 非官方构建版） |
| 数据库 | PostgreSQL 12+（可部署在独立服务器） |

> **注意**：项目使用 `bcryptjs`（纯 JS）而非 `bcrypt`（C++ 原生），因此 Windows 打包的 `node_modules` 可直接在 Linux 运行。Prisma 已配置 `binaryTargets = ["native", "rhel-openssl-1.0.x"]`，CentOS 7 查询引擎已包含在离线包中。

---

## 二、数据库准备

在生产服务器或独立数据库服务器上创建 PostgreSQL 数据库：

```sql
CREATE DATABASE staff_management OWNER staff;
```

确认数据库连接串格式：

```
postgresql://用户名:密码@主机:端口/staff_management?schema=public
```

---

## 三、本地开发部署

### 1. 克隆代码并安装依赖

```bash
cd staff-management
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填写以下关键变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥，执行 `openssl rand -base64 32` 生成 |
| `NEXTAUTH_URL` | 应用访问地址，本地开发填 `http://localhost:3000` |

### 3. 同步数据库表结构

```bash
npm run db:push
```

### 4. 初始化数据

#### 4.1 初始化基础数据（公司、部门、岗位、用户）

```bash
npm run db:seed
```

> `prisma/seed.ts` 会读取 `prisma/seed-data.json`，导入公司、部门、岗位和用户数据。

#### 4.2 初始化节假日日历（必须）

**⚠️ 日历数据是请假、加班、薪资计算的基础，首次部署必须执行。**

```bash
npm run db:holidays:2026
```

该命令会读取 `scripts/calendar/2026.json`，将全年放假、调休、补班日期写入 `Holiday` 表：

- **法定节假日**（rat=3，如元旦、春节、国庆等）
- **周末调休**（rat=2，如周末补假）
- **调休上班/补班**（rat=1.5，如周六周日调休上班）

执行后会输出：

```
已清理 N 条旧记录
准备导入 39 条节假日记录...
✓ 成功导入 39 条记录
  按类型分布:
    法定节假日( rat=3 ): 13 天
    周末调休  ( rat=2 ): 20 天
    调休上班  ( rat=1.5): 6 天
```

### 5. 启动开发服务

```bash
npm run dev
```

访问：`http://localhost:3000`

---

## 四、生产环境部署（离线 Native 方式）

### 1. 联网机器打包

在 Windows 打包机上执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-offline-native.ps1
```

打包脚本会自动完成：
1. `npm ci --omit=dev` 安装生产依赖
2. 下载 Prisma CentOS 7 引擎（rhel-openssl-1.0.x）
3. `npm run build` 构建 Next.js 应用
4. 复制所有必要文件到 `.offline-native-bundle/`
5. 生成 `.tar.gz` 压缩包

打包完成后，会在 `.offline-native-bundle/` 下生成：

```text
.offline-native-bundle/
└─ staff-management-20260428-123456.tar.gz
   # 包内包含：
   # ├─ package.json / next.config.js / .env.prod.example
   # ├─ prisma/          ← Schema 与 seed 数据
   # ├─ public/          ← 静态资源
   # ├─ scripts/         ← 含 init-holidays-2026.ts 与 calendar/2026.json
   # ├─ .next/           ← Next.js 构建产物
   # └─ node_modules/    ← 生产依赖（含 Prisma CentOS 引擎）
```

### 2. 拷贝到离线服务器

将 `.tar.gz` 包拷贝到 CentOS 服务器并解压：

```bash
tar -xzf staff-management-20260428-123456.tar.gz
cd staff-management-20260428-123456
chmod +x node_modules/.bin/*
```

### 3. 配置环境变量

```bash
cp .env.prod.example .env
```

编辑 `.env`，重点配置：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 外部 PostgreSQL 连接串 |
| `NEXTAUTH_SECRET` | 生产密钥，**必须替换**，执行 `openssl rand -base64 32` 生成 |
| `NEXTAUTH_URL` | 访问地址，如 `http://服务器IP:3000` |
| `TZ` | 时区，默认 `Asia/Shanghai` |
| `RUN_DB_PUSH` | 启动时自动同步表结构，默认 `true` |
| `RUN_DB_SEED` | 启动时自动初始化种子数据，默认 `false` |

### 4. 初始化数据库

**首次部署时必须执行以下两步：**

#### 4.1 同步表结构

```bash
npx prisma db push
```

#### 4.2 初始化基础数据

```bash
npx tsx prisma/seed.ts
```

#### 4.3 初始化节假日日历（⚠️ 必须）

```bash
node scripts/init-holidays-2026.js
```

### 5. 启动服务

```bash
npm start
```

应用默认监听 `3000` 端口，访问 `http://服务器IP:3000`。

建议使用 `pm2` 或 `systemd` 管理进程：

```bash
# 使用 pm2（需提前安装）
pm2 start npm --name "staff-management" -- start
pm2 save
pm2 startup
```

---

## 五、日历初始化与年度更新

### 日历数据的作用

`Holiday` 表是系统的核心基础数据，直接影响：

| 业务 | 关联方式 |
|------|----------|
| **请假** | 根据 `isOffDay` 排除放假日期、计入补班日期，计算实际请假天数 |
| **加班** | 根据 `rat` 自动判断加班类型（工作日/周末/节假日），关联薪资系数 |
| **薪资** | 根据加班类型计算不同倍率的加班费（工作日 1.5x、周末 2x、节假日 3x） |

### 每年更新日历

国务院通常在每年 11-12 月发布次年放假安排。更新步骤：

1. **准备新一年的 JSON 文件**

   将 `scripts/calendar/2026.json` 复制为 `scripts/calendar/2027.json`，按国务院文件更新日期、rat 和 isOffDay。

   JSON 格式：

   ```json
   {
     "year": 2027,
     "days": [
       {
         "name": "元旦",
         "date": "2027-01-01",
         "isOffDay": true,
         "rat": 3
       },
       {
         "name": "元旦",
         "date": "2027-01-02",
         "isOffDay": true,
         "rat": 2
       },
       {
         "name": "元旦",
         "date": "2027-01-03",
         "isOffDay": false,
         "rat": 1.5
       }
     ]
   }
   ```

   字段说明：

   | 字段 | 说明 |
   |------|------|
   | `name` | 节日名称 |
   | `date` | 日期，格式 `YYYY-MM-DD` |
   | `isOffDay` | `true`=放假，`false`=调休上班（补班） |
   | `rat` | 薪资系数：`3`=法定节假日、`2`=周末调休、`1.5`=工作日/补班 |

2. **新建/修改初始化脚本**

   复制 `scripts/init-holidays-2026.js` 为 `scripts/init-holidays-2027.js`，将路径中的 `2026.json` 改为 `2027.json`。

3. **在 package.json 中添加命令**

   ```json
   "db:holidays:2027": "tsx scripts/init-holidays-2027.ts"
   ```

4. **执行初始化**

   ```bash
   npm run db:holidays:2027
   ```

   脚本会先清理 `year=2027` 的旧记录，再导入新数据，可安全重复运行。

---

## 六、常用维护命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发环境 |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务 |
| `npm run db:push` | 同步 Prisma Schema 到数据库 |
| `npm run db:seed` | 初始化基础数据 |
| `node scripts/init-holidays-2026.js` | 初始化 2026 年节假日 |
| `npm run db:studio` | 打开 Prisma Studio 可视化查看数据 |
| `npm run test` | 运行测试 |

---

## 七、验证清单

首次部署后，请确认以下项目：

- [ ] `npm run db:push` 成功同步所有表结构
- [ ] `npm run db:seed` 成功导入公司、部门、岗位、用户
- [ ] `npm run db:holidays:2026` 成功导入 39 条节假日记录
- [ ] `.env` 中 `NEXTAUTH_SECRET` 已替换为随机密钥
- [ ] 页面能正常登录，各角色权限正确
- [ ] 请假时跨放假日期天数计算正确
- [ ] 加班时类型自动判断正确（工作日/周末/节假日）
- [ ] 薪资生成时加班费按正确倍率计算

---

## 八、注意事项

1. **当前仓库没有 Prisma Migration 文件**，生产环境默认通过 `prisma db push` 同步表结构。如果后续需要改为正式 migration，建议将启动逻辑改为 `prisma migrate deploy`。
2. 离线服务器需提前安装 [unofficial-builds.nodejs.org](https://unofficial-builds.nodejs.org/) 的 `linux-x64-glibc-217` 版本 Node.js。
3. `.offline-native-bundle/` 目录不要提交到 Git。
4. 建议打包前先执行 `npm run build && npm test` 确保代码无问题。
5. **日历数据每年必须更新**，否则次年请假/加班/薪资计算会出现偏差。
