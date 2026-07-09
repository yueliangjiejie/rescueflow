# 部署指南

> 目标:把 RescueFlow 三端(群众端 H5、管理后台、后端)尽快跑起来对外服务。

---

## 前置准备(密钥清单)

| 依赖 | 用途 | 申请入口 | 是否必须 |
|---|---|---|---|
| **MongoDB** | 数据存储 | CloudBase 数据库 / MongoDB Atlas 免费版 / 本地 | ✅ 必须 |
| **微信 AppID + Secret** | H5 网页授权登录 | mp.weixin.qq.com(需已认证服务号) | ⚠️ 登录必需,V1 可暂匿名 |
| **腾讯地图 Key** | 定位 + 地址逆解析 | lbs.qq.com | ⚠️ 定位必需,失败会降级 |
| **AI API Key** | 语音转写/结构化/紧急度 | OpenAI 或国产(智谱/通义/文心) | ⚠️ 不配则降级为人工 |
| **H5 域名(已备案)** | 微信内可访问 | 域名注册商 + 工信部备案 | ⚠️ 微信内访问必需 |

> 未配置的服务会**自动降级**,登记流程不会中断(先存原文,人工处理)。

---

## 方案 A:本地开发 / 快速试跑

```bash
# 1. 配置环境
cp .env.example .env
# 编辑 .env,至少填 MONGODB_URI

# 2. 启动 MongoDB(本地或云)
#    本地: brew install mongodb-community && brew services start mongodb-community

# 3. 安装 + 启动后端
npm install
npm run dev:server    # http://localhost:3000

# 4. 启动群众端(另开终端)
npm run dev:h5        # http://localhost:5173

# 5. 启动管理后台(另开终端)
npm run dev:admin     # http://localhost:5174
#    默认管理员: admin / admin123(仅开发态自动创建)
```

## 方案 B:Docker 单容器(推荐灾时部署)

后端同时托管 H5 + 管理后台静态文件,一个容器对外提供服务。

```bash
# 构建
docker build -t rescueflow .

# 运行(把 .env 里的变量用 -e 注入)
docker run -d --name rescueflow \
  -p 80:3000 \
  -e MONGODB_URI="mongodb://云数据库连接串" \
  -e AI_API_KEY="sk-xxx" \
  -e TENCENT_MAP_KEY="xxx" \
  -e JWT_SECRET="强随机串" \
  -v rescueflow-uploads:/app/uploads \
  rescueflow
```

访问:
- 群众端 H5:`http://服务器IP/`
- 管理后台:`http://服务器IP/admin`

## 方案 C:腾讯云 CloudBase(原设计)

```bash
# 1. 安装 CLI
npm install -g @cloudbase/cli

# 2. 登录 + 创建环境
tcb login
tcb env create rescueflow

# 3. 部署后端为云函数(入口: cloudbase/index.handler)
tcb fn deploy rescueflow-api --entry server/cloudbase/index.js

# 4. H5 / 管理后台构建后,上传到 CloudBase 静态网站托管
npm -w vue-h5 run build
npm -w vue-admin run build
tcb hosting deploy vue-h5/dist --dir /
tcb hosting deploy vue-admin/dist --dir /admin
```

---

## 微信内访问注意事项

- H5 在微信内打开**需要已备案域名 + 公众号 JS-SDK 鉴权**。
- 若暂无备案域名:**临时方案** —— 用浏览器直接打开 H5 地址(扫码/复制链接),功能不受影响,仅分享体验弱化。
- 后续补备案域名 + 服务号后,接入网页授权登录,体验完整。

## 安全检查清单(上线前)

- [ ] `.env` 不提交;`JWT_SECRET` 改为强随机值
- [ ] MongoDB 连接串启用认证 + 仅允许应用 IP
- [ ] 管理后台默认账号 `admin/admin123` 已改密或删除
- [ ] 对象存储 / uploads 目录权限收紧
- [ ] CORS 仅放行自有域名(生产把 cors 配置收紧)
- [ ] HTTPS(用 CDN/反代强制 https)
