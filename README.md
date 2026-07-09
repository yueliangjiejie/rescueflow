# RescueFlow

> AI 应急信息协同平台 —— 让需要帮助的人,更快地被看见。

**不是**救援指挥平台、官方报警平台;**而是**信息登记 / 整理 / 核实 / 流转 / 留痕。

> ⚠️ 合规声明:本平台为民间信息协同工具,**不替代 110 / 119 / 120** 等官方紧急渠道,**不承诺救援**。信息需人工核实,仅收集最小必要信息并全程留痕。

---

## 项目结构(monorepo, npm workspaces)

```
RescueFlow/
├── shared/        # 三端共享:常量 / 枚举 / 编号生成 / 数据契约
├── server/        # 后端 Node.js + Express(可部署为腾讯云 CloudBase 云函数)
├── vue-h5/        # 群众端 H5(Vue3 + Vite + Vant)【阶段1】
├── vue-admin/     # 管理后台(Vue3 + Vite + Element Plus)【阶段2】
├── .env.example   # 环境变量模板
└── package.json   # monorepo 根
```

## 快速开始

```bash
# 1. 安装依赖(若 npm 缓存有权限问题,加 --cache /tmp/npm)
npm install

# 2. 配置环境变量
cp .env.example .env   # 按需填写 MongoDB / 微信 / 地图 / AI 密钥

# 3. 启动后端
npm run dev:server     # http://localhost:3000/api/health

# (阶段1起)前端
npm run dev:h5
npm run dev:admin
```

## 核心设计要点

- **编号体系**(V0.1 第7节):`HELP-GX-2026-000001`,并发安全的原子自增序号,一件事一个编号。
- **状态机**:待核实 → 已核实 → 已转交 → 处理中 → 已完成 → 归档;异常分支细分(重复/不实/超范围/垃圾)。
- **留痕可验证**:audit_logs append-only + **哈希链**,任意篡改会导致后续哈希全部失配。
- **断网补传**:群众端本地缓存,联网补传(store-and-forward)。
- **降级优先**:AI / 地图任一环节失败,先存原文、人工处理,登记永不中断。
- **SLA 超时**:按紧急度设截止时间(critical 30min / high 2h / medium 8h / low 24h),超时标记。
- **隐私脱敏**:手机号 / 姓名默认脱敏,仅授权角色且留痕后可解码。
- **特殊人员加权**:老人 / 孕妇 / 残疾 / 儿童 / 急病标记直接影响列表排序。

## 阶段进度

- [x] 阶段 0:脚手架 + 数据模型 + 编号 + 留痕 + SLA + 脱敏(服务层)
- [x] 阶段 1:群众端 H5 登记链路 + 后端入库 + AI 适配 + 断网补传 + 降级
- [x] 阶段 2:管理后台核实流转 + 状态机 + 五级可信度 + Excel 导出 + 留痕时间线
- [x] 阶段 3:JWT 鉴权 + RBAC + SLA 轮询调度器 + 留痕链校验 + 合规服务
- [x] 阶段 4:CloudBase 云函数包装 + Dockerfile + 静态托管 + 部署文档

## 文档

- [部署指南](docs/DEPLOY.md) —— 本地 / Docker / CloudBase 三种方案 + 密钥清单
- [API 参考](docs/API.md) —— 全部接口说明

## 启动

```bash
npm install
cp .env.example .env   # 填 MONGODB_URI 等
npm run dev:server     # 后端 :3000
npm run dev:h5         # 群众端 :5173
npm run dev:admin      # 管理后台 :5174(默认账号 admin / admin123)
```

**未配置的服务自动降级**:AI/地图/微信登录缺失时,登记流程不中断,先存原文由人工处理。这是灾区可用性的关键设计。

---

## 基于开源项目的优化(第二版)

参考 GitHub 上同类项目后,吸收以下设计做了增强:

| 借鉴来源 | 吸收的能力 | 落点 |
|---|---|---|
| **Ushahidi** | 多灾种自定义表单(Form/Stage/Attribute 三层),加新灾种零代码 | `Form` 模型 + `/api/forms`,内置"洪涝/震情"两套表单 |
| **Ushahidi** | 核实做成"流程阶段"而非布尔字段(记录 who/when/how) | Help.`verification` 字段 + required Stage 闸门 |
| **DRAP**(同栈) | 志愿者技能-任务匹配派单 | `Volunteer`/`Skill` 模型 + `/api/volunteers/match` |
| **DRAP** | 成果量化(已转移/已救治/失联人数) | Help.`outcome` 字段 + `/resolve` API |
| **DRAP** | 联系方式可见性(比纯脱敏更尊重用户) | Help.`person.contactPreference` |
| **DRAP 教训** | 引用字段用 ObjectId(修复其 String 引用缺陷)、RBAC 全覆盖(修复其接口裸奔) | 模型规范 + `authRequired/requireRole` |
| **Leaflet + OSM** | 免费地图,零 key,灾时不依赖付费服务 | 后台"灾情地图"页(`/map`) |
| **河南"救命文档"** | 志愿者并行核实的"认领"机制 + "是否脱险"命脉标记 | Help.`claimedBy` + `resolved` 字段,列表醒目展示 |

**API 从 15 个增至 31 个**;新增能力:多灾种表单、技能匹配、认领、脱险/成果、灾情地图。

---

## 关键缺口补全(第三版:工程完善)

针对灾时真实可用性,补全了之前审计出的关键缺口:

| 缺口 | 补全方案 | 文件 |
|---|---|---|
| 🔴 **留痕并发竞态**(断链 bug) | MongoDB 事务 + 唯一索引 + 冲突重试三重保障 | `services/auditService.js` |
| 🔴 **重复检测**(救命文档最痛问题) | 地理邻近 + 时间窗口 + 文本 Jaccard 三维度,手机号强信号;只提示不拦截,人工合并 | `services/duplicateService.js` + 登记时自动检测 + `/duplicates` `/merge` API |
| 🔴 **无限流**(灾时会被打挂) | 全局 300/min + 管理 60/min + 登录 20/min(防爆破)+ 群众端放宽 100/min | `middlewares/rateLimit.js` |
| 🟠 **语音转文字是空函数** | 腾讯云一句话识别(无 SDK 依赖,HMAC 签名),失败降级 | `services/asrService.js` |
| 🟠 **文件只存本地磁盘** | COS 适配层(配置即用 COS,否则降级本地) | `services/storageService.js` |

**降级原则贯穿始终**:ASR/COS/AI 任一未配置,系统自动降级为本地/人工,登记流程不中断。这是灾区可用性的核心设计。

**可降级配置项**:AI_API_KEY / TENCENT_SECRET_ID+ASR_APP_ID / COS_SECRET_ID+BUCKET —— 全部可选,缺了不报错,只是该能力降级。

许可证:**Apache-2.0**
