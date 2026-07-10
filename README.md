# 体验档案小程序

这是一个纯前端微信小程序，用于记录个人旅行体验。当前包含酒店测评、米其林餐厅测评、公开评论预留字段、AA 旅行记账，以及完整的本地备份和隐私导出。

## 当前功能

### 酒店与餐厅档案

- 原生底部导航区分“体验档案”和“AA 账本”。
- 首页记录中心：记录、时间线、城市、标签四个视图。
- 首页展示最近体验、最近草稿和最近账本；备份与 PDF 统一放在“数据管理”。
- 支持新增、查看、编辑、复制、删除记录。
- 支持酒店记录：行政酒廊、早餐、泳池评分。
- 支持米其林餐厅记录：菜品、服务、酒水/饮品、环境评分。
- 支持草稿、快速记录、自定义标签、搜索、筛选、排序。
- 搜索和筛选会同步作用于列表、时间线、城市和标签统计，并支持一键清除。
- 支持用 canvas 生成多页 PDF 并打开预览。

### 公开评论预留

当前不连接后端，但本地记录已经预留未来同步和公开评论字段：

- `placeId`, `placeName`, `placeAlias`
- `cloudRecordId`, `publicReviewId`
- `visibility`: `private` / `unlisted` / `public`
- `publishStatus`: `local` / `pending` / `published` / `rejected` / `hidden`
- `visitMonth`, `publicNote`, `privateNote`

公开预览默认不展示精确日期、会员等级、价格和私密备注。

### AA 账本

AA 账本用于多人旅行支出分摊：

- 新建账本，维护成员、目的地、日期和备注。
- 成员使用稳定 ID 保存，改名不会改变历史支出归属。
- 有历史支出或转账的成员可以归档，不能静默删除；归档成员不再进入新支出的默认范围。
- 在账本详情里新增支出。
- 支持编辑、删除已有支出。
- 每笔支出记录付款人、金额、分类、日期、参与平分人。
- 支持同一笔支出只由部分成员平分。
- 参与平分人支持一键全选和清空。
- 账本详情显示分类统计。
- 账本列表显示待结算转账次数。
- 账本详情采用状态优先布局：总额、人均、待转账次数和结算建议优先展示，支出表单默认收起。
- 支出表单可从主按钮展开，编辑支出时自动展开并回填。
- 自动计算每个成员已付、应摊、净额。
- 自动生成推荐转账方案。
- 支持按实际到账金额确认部分或完整转账。
- 支持撤销已确认转账，并保留结算历史。
- 转账金额不能超过当前待结算金额；全部平衡后显示“已结清”。
- 金额内部统一按“分”存储，避免浮点计算误差。
- 本地账本和支出 id 使用时间戳加随机后缀，避免连续快速录入时同毫秒冲突。
- 账本使用 `schemaVersion: 2`，旧姓名数组和历史支出会在首次读取时自动迁移。
- 金额、成员引用、转账方向和日期在写入前统一校验，迁移失败不会覆盖原缓存。

账本本地缓存 key：

```js
trip_split_ledgers
```

### 数据管理与隐私导出

- 完整 JSON 备份同时包含酒店、餐厅、账本、成员、支出和结算记录。
- 完整备份格式为 `schemaVersion: 2`，继续兼容旧版仅包含体验记录的 v1 文件。
- 导入前展示记录、账本和支出数量，支持合并或覆盖。
- 恢复同时写入两个缓存；任一写入失败时自动回滚到导入前数据。
- 同一备份重复合并会跳过已有内容，ID 冲突时会稳定重映射关联字段。
- PDF 支持“私人版”和“脱敏版”。
- 脱敏版把精确日期降为月份，隐藏会员等级、价格、私密备注和真实成员姓名。

完整备份的核心结构：

```js
{
  schemaVersion: 2,
  app: "experience-review-miniprogram",
  exportedAt: "...",
  records: [],
  ledgers: []
}
```

## 主要目录

```text
miniprogram/
  pages/index/          首页体验档案
  pages/record/         酒店/餐厅记录新增、详情、编辑
  pages/data/           完整备份、恢复和隐私 PDF
  pages/ledger/index/   AA 账本列表
  pages/ledger/edit/    AA 账本新增/编辑
  pages/ledger/detail/  AA 账本详情、支出录入、结算
  utils/hotelScore.js
  utils/hotelReviewStore.js
  utils/pdfReport.js
  utils/tripLedgerStore.js
  utils/ledgerMigration.js
  utils/ledgerValidation.js
  utils/appBackup.js
  utils/privacyPolicy.js
```

## 本地调试

```bash
cd miniprogram
npm i
```

然后进入微信开发者工具，选择：

```text
工具 -> 构建 npm
```

也可以用微信开发者工具 CLI：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli build-npm --project /Users/shi/WeChatProjects/miniprogram-1
```

## 本地检查

AA 账本金额、迁移、结算与备份回归测试：

```bash
npm test
```

该测试会 mock 小程序 `wx` 和 `Page`，覆盖：

- 多人分摊和推荐转账方案
- 分分钱余数分配
- 金额输入解析
- v1 账本无损迁移和迁移失败保护
- 成员改名、归档、删除引用保护
- 部分结算、完整结算和撤销转账
- 余额守恒、无待结算转账和超额转账拦截
- 完整备份预检、v1 兼容、重复导入和 ID 重映射
- 两个缓存写入失败时的自动回滚
- 私人副本与脱敏副本不修改原始数据
- 页面事件流：创建账本、录入支出、确认部分结算、撤销结算和日期错误提示

常用语法检查：

```bash
node --check miniprogram/utils/hotelReviewStore.js
node --check miniprogram/utils/tripLedgerStore.js
node --check miniprogram/utils/ledgerMigration.js
node --check miniprogram/utils/ledgerValidation.js
node --check miniprogram/utils/appBackup.js
node --check miniprogram/utils/privacyPolicy.js
node --check miniprogram/pages/index/index.js
node --check miniprogram/pages/record/record.js
node --check miniprogram/pages/data/index.js
node --check miniprogram/pages/ledger/index/index.js
node --check miniprogram/pages/ledger/edit/edit.js
node --check miniprogram/pages/ledger/detail/detail.js
```

## 旧 WebAR Demo 说明

项目里仍保留了原 WebAR demo 的部分页面和 npm 包，但当前入口已经切换为旅行体验档案：

```json
{
  "pages": [
    "pages/index/index",
    "pages/record/record",
    "pages/data/index",
    "pages/ledger/index/index",
    "pages/ledger/edit/edit",
    "pages/ledger/detail/detail"
  ]
}
```

原 demo 的默认 LICENSE 仅供测试时使用，有效期 14 天。若后续重新启用 WebAR 能力，需要参考腾讯云文档替换正式 LICENSE 和 APP_ID。
