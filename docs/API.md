# API 参考

> Base URL: `/api` · 响应统一格式:`{ code, message, data }`(`code=0` 成功)

## 群众端

### 登记求助
`POST /api/helps`

```jsonc
// body
{
  "rawText": "我家在XX村3组,水快淹到2楼了,有老人和小孩,请求转移",
  "method": "manual",            // voice | manual | image
  "reporterRelation": "self",   // self | other
  "person": {
    "name": "张三",
    "phone": "13812345678",     // 必填
    "specialPersons": ["elderly", "child"],  // 特殊人员标记(影响排序)
    "headcount": 3
  },
  "location": { "lng": 108.32, "lat": 22.82, "raw": "XX村3组" },
  "attachments": ["HELP-..."],   // 上传后返回的附件 code
  "consent": true,               // 必须勾选
  "submittedAt": "2026-07-08T10:00:00Z",
  "source": "h5"
}
// 201
{ "code":0, "data":{ "code":"HELP-GX-2026-000001", "urgency":"high" } }
```

### 上传附件
`POST /api/helps/upload` (multipart,字段名 `file`)
返回 `{ data: { code, url, type } }`,把 `code` 放进登记请求的 `attachments`。

## 管理后台

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录,返回 JWT |
| GET | `/api/admin/helps` | 列表(`?status=&urgency=&page=&pageSize=`) |
| GET | `/api/admin/helps/:code` | 详情(脱敏) |
| GET | `/api/admin/helps/:code/audit` | 留痕链(哈希链) |
| POST | `/api/admin/helps/:code/verify` | 核实 + 评可信度 |
| POST | `/api/admin/helps/:code/transfer` | 转交(`transferredTo`) |
| POST | `/api/admin/helps/:code/abnormal` | 标记异常(`reason`: duplicate/false/out_of_scope/spam) |
| POST | `/api/admin/helps/:code/transition` | 通用流转(`toStatus`) |
| GET | `/api/admin/helps/:code/reveal` | 解码明文联系方式(**写 VIEW 留痕**) |
| GET | `/api/admin/export` | 导出 Excel(`?status=&urgency=&revealPhone=true`) |

## 合规与留痕

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/compliance/notice` | 合规声明文案 |
| GET | `/api/audit/verify?entityType=help&entityId=HELP-...` | 校验留痕链完整性 |
| GET | `/api/health/status` | 各依赖就绪情况 |

## 角色与权限(RBAC)

| 角色 | 能力 |
|---|---|
| `volunteer` | 查看(脱敏)、核实 |
| `operator` | 全部业务操作 + 导出 + 查看明文(留痕) |
| `admin` | 全部 + 用户/角色管理 |

> 开发态可用请求头 `x-actor-id` / `x-actor-role` 临时信任;生产环境启用 JWT。
