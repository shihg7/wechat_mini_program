# 体验档案小程序

这是一个纯前端微信小程序，用于记录个人旅行体验。当前包含酒店测评、米其林餐厅测评、公开评论预留字段，以及 AA 旅行记账。

## 当前功能

### 酒店与餐厅档案

- 首页记录中心：记录、时间线、城市、标签四个视图。
- 支持新增、查看、编辑、复制、删除记录。
- 支持酒店记录：行政酒廊、早餐、泳池评分。
- 支持米其林餐厅记录：菜品、服务、酒水/饮品、环境评分。
- 支持草稿、快速记录、自定义标签、搜索、筛选、排序。
- 支持 JSON 备份/恢复。
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
- 在账本详情里新增支出。
- 每笔支出记录付款人、金额、分类、日期、参与平分人。
- 支持同一笔支出只由部分成员平分。
- 自动计算每个成员已付、应摊、净额。
- 自动生成最少转账次数的结算建议。
- 金额内部统一按“分”存储，避免浮点计算误差。

账本本地缓存 key：

```js
trip_split_ledgers
```

## 主要目录

```text
miniprogram/
  pages/index/          首页体验档案
  pages/record/         酒店/餐厅记录新增、详情、编辑
  pages/ledger/index/   AA 账本列表
  pages/ledger/edit/    AA 账本新增/编辑
  pages/ledger/detail/  AA 账本详情、支出录入、结算
  utils/hotelScore.js
  utils/hotelReviewStore.js
  utils/pdfReport.js
  utils/tripLedgerStore.js
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

常用语法检查：

```bash
node --check miniprogram/utils/hotelReviewStore.js
node --check miniprogram/utils/tripLedgerStore.js
node --check miniprogram/pages/index/index.js
node --check miniprogram/pages/record/record.js
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
    "pages/ledger/index/index",
    "pages/ledger/edit/edit",
    "pages/ledger/detail/detail"
  ]
}
```

原 demo 的默认 LICENSE 仅供测试时使用，有效期 14 天。若后续重新启用 WebAR 能力，需要参考腾讯云文档替换正式 LICENSE 和 APP_ID。
