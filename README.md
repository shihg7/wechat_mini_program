# 体验档案小程序

这是一个纯前端微信小程序，用于记录个人旅行体验。当前包含酒店测评、米其林餐厅测评、体验照片、个人旅行洞察、AA 旅行记账，以及完整的本地备份和隐私导出。

## 当前功能

### 酒店与餐厅档案

- 原生底部导航区分“体验档案”和“AA 账本”。
- 首页记录中心：记录、地点、时间线、城市、标签五个视图。
- 首页展示最近体验、最近草稿和最近账本；备份与 PDF 统一放在“数据管理”。
- 支持新增、查看、编辑、复制、删除记录。
- 支持酒店记录：行政酒廊、早餐、泳池评分。
- 支持米其林餐厅记录：菜品、服务、酒水/饮品、环境评分。
- 支持草稿、快速记录、自定义标签、搜索、筛选、排序。
- 同一家酒店或餐厅可关联多次入住/用餐，地点页展示到访次数、个人均分、最高分和评分变化。
- 新增记录时按类型、名称和城市提示可能重复地点，必须由用户确认关联，不会自动合并。
- 支持编辑地点、维护别名、手动合并重复地点；有到访记录的地点不能直接删除。
- 支持可选微信地图位置；拒绝位置权限后仍可手工填写城市、地区和地址。
- 快速草稿标记为“未评分”，地点和首页统计只计算已完成且已评分的记录。
- 搜索和筛选会同步作用于列表、时间线、城市和标签统计，并支持一键清除。
- 支持用 canvas 生成多页 PDF 并打开预览。
- 每条体验最多保存 9 张照片，支持相册/拍照、分类、说明、排序和设置封面。
- 照片使用 `wx.saveFile` 保存在小程序本地持久目录；失效路径会显示明确占位，不会渲染破损图片。
- 首页、地点页和到访记录会展示体验封面。
- 旅行洞察支持年份筛选、酒店/餐厅构成、个人最佳、月度频次、评分轨迹、常去城市、常用标签和复访升降。

### 公开评论预留

当前不连接后端，但本地地点与记录已经预留未来同步和公开评论字段：

- `placeId`, `placeName`, `placeAlias`
- `cloudRecordId`, `publicReviewId`
- `visibility`: `private` / `unlisted` / `public`
- `publishStatus`: `local` / `pending` / `published` / `rejected` / `hidden`
- `visitMonth`, `publicNote`, `privateNote`

地点独立保存在 `experience_places`，包含本地 `id`、可选 `cloudPlaceId`、名称、别名、城市、地址和经纬度。公开预览和脱敏导出不会包含精确地址、经纬度或内部同步 ID。

公开预览默认不展示精确日期、会员等级、价格和私密备注。

### AA 账本

AA 账本用于多人旅行支出分摊：

- 新建账本，维护成员、目的地、日期和备注。
- 成员使用稳定 ID 保存，改名不会改变历史支出归属。
- 有历史支出或转账的成员可以归档，不能静默删除；归档成员不再进入新支出的默认范围。
- 在账本详情里新增支出。
- 支持编辑、删除已有支出。
- 每笔支出记录付款人、金额、分类、日期、参与分摊人。
- 支持同一笔支出只由部分成员分摊。
- 支持人均、固定金额、百分比、份数四种分摊方式。
- 固定金额合计必须等于支出金额，百分比合计必须为 100%，份数必须是正整数。
- 所有分摊最终固化为整数分，比例和份数的尾差按稳定成员顺序分配。
- 参与分摊人支持一键全选和清空。
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
- 账本使用 `schemaVersion: 3`，旧姓名数组、历史支出和 v2 均分记录会在首次读取时自动迁移。
- 金额、成员引用、转账方向和日期在写入前统一校验，迁移失败不会覆盖原缓存。

账本本地缓存 key：

```js
trip_split_ledgers
```

### 数据管理与隐私导出

- 完整 JSON 备份同时包含酒店、餐厅、地点、账本、成员、支出和结算记录。
- 完整备份格式为 `schemaVersion: 4`，继续兼容 v1 记录备份、v2 记录加账本备份和 v3 地点备份。
- v1 / v2 导入时会为没有地点对象的记录生成独立地点，不会按同名自动合并。
- 导入前展示记录、账本和支出数量，支持合并或覆盖。
- 恢复同时写入记录、地点、账本三个缓存；任一写入失败时自动回滚到导入前数据。
- 同一备份重复合并会跳过已有内容，ID 冲突时会稳定重映射关联字段。
- PDF 支持“私人版”和“脱敏版”。
- 脱敏版把精确日期降为月份，隐藏会员等级、价格、私密备注和真实成员姓名。
- JSON 备份包含照片路径、分类和说明，但不嵌入图片二进制；跨设备恢复不会带回照片文件。
- 同一设备恢复时若照片仍存在可继续使用，失效文件会在页面中标记。

完整备份的核心结构：

```js
{
  schemaVersion: 4,
  app: "experience-review-miniprogram",
  exportedAt: "...",
  records: [],
  places: [],
  ledgers: [],
  media: {
    binariesIncluded: false
  }
}
```

## 主要目录

```text
miniprogram/
  pages/index/          首页体验档案
  pages/record/         酒店/餐厅记录新增、详情、编辑
  pages/place/          地点详情、多次到访、编辑和合并
  pages/insights/       个人旅行年度洞察
  pages/data/           完整备份、恢复和隐私 PDF
  pages/ledger/index/   AA 账本列表
  pages/ledger/edit/    AA 账本新增/编辑
  pages/ledger/detail/  AA 账本详情、支出录入、结算
  utils/hotelScore.js
  utils/hotelReviewStore.js
  utils/placeStore.js
  utils/mediaStore.js
  utils/travelInsights.js
  utils/pdfReport.js
  utils/tripLedgerStore.js
  utils/ledgerMigration.js
  utils/ledgerValidation.js
  utils/appBackup.js
  utils/privacyPolicy.js
```

## 本地调试

使用微信开发者工具直接打开项目根目录即可编译。当前小程序没有运行时 npm 依赖，不需要执行“构建 npm”。

根目录的 npm 依赖只用于自动化测试：

```bash
npm install
npm test
```

## 本地检查

地点档案、照片、旅行洞察、AA 金额、迁移、结算与备份回归测试：

```bash
npm test
```

该测试会 mock 小程序 `wx` 和 `Page`，覆盖：

- 多人分摊和推荐转账方案
- 分分钱余数分配
- 固定金额、比例和份数分摊
- 100 笔随机支出的金额守恒
- 金额输入解析
- v1 账本无损迁移和迁移失败保护
- 成员改名、归档、删除引用保护
- 部分结算、完整结算和撤销转账
- 余额守恒、无待结算转账和超额转账拦截
- 完整备份预检、v1 兼容、重复导入和 ID 重映射
- 三个缓存写入失败时的自动回滚
- 私人副本与脱敏副本不修改原始数据
- 旧记录地点迁移幂等且不会按同名自动合并
- 相似地点建议、重复到访、地点统计、合并和删除保护
- 快速草稿未评分、地图授权成功和拒绝后的手工回退
- 照片持久化、路径失效和文件清理
- 年度筛选、个人最佳、月度趋势和复访评分变化
- v1 / v2 / v3 / v4 备份兼容和三缓存回滚
- 页面事件流：创建账本、录入支出、确认部分结算、撤销结算和日期错误提示

常用语法检查：

```bash
node --check miniprogram/utils/hotelReviewStore.js
node --check miniprogram/utils/placeStore.js
node --check miniprogram/utils/tripLedgerStore.js
node --check miniprogram/utils/ledgerMigration.js
node --check miniprogram/utils/ledgerValidation.js
node --check miniprogram/utils/appBackup.js
node --check miniprogram/utils/privacyPolicy.js
node --check miniprogram/utils/mediaStore.js
node --check miniprogram/utils/travelInsights.js
node --check miniprogram/pages/index/index.js
node --check miniprogram/pages/record/record.js
node --check miniprogram/pages/place/detail.js
node --check miniprogram/pages/insights/index.js
node --check miniprogram/pages/data/index.js
node --check miniprogram/pages/ledger/index/index.js
node --check miniprogram/pages/ledger/edit/edit.js
node --check miniprogram/pages/ledger/detail/detail.js
```

## 项目瘦身

旧 WebAR demo 页面、组件、授权代码、编译产物和 `tencentcloud-webar-wx` 依赖已经移除。当前 npm 依赖只服务旅行体验档案和开发检查，不再需要 AR LICENSE 或 APP_ID。
