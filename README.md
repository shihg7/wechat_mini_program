# 体验档案小程序

这是一个本地优先的微信小程序，用于记录个人旅行体验。当前包含酒店测评、米其林餐厅测评、行程计划、预算中心、智能录入模板、想去清单、旅行地图、年度回忆册和 AA 旅行记账。数据层已预留未来后端同步能力，当前不连接服务器。

## 当前功能

### 酒店与餐厅档案

- 原生底部导航区分“体验档案”“行程”和“AA 账本”。
- 首页记录中心：记录、地点、想去、时间线、城市、标签六个视图。
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
- 旅行地图聚合已到访地点与想去项，支持按类型和状态筛选；未填写坐标的内容单独列出，不请求当前位置也能使用。
- 单条体验可生成照片故事长图，最多选择 6 张照片，支持版式、顺序与公开字段开关；失效照片会自动跳过。
- 年度回忆册按月份整理体验与年度最佳，最多选择 24 张照片，可导出分享长图和私人多页 PDF。
- 回忆册分享长图不包含 AA 金额；私人 PDF 可选择加入年度 AA 聚合金额，不输出成员或支出明细。

### 界面与交互

- 新增全局 `ui-icon` 组件和本地线性 SVG 图标集，统一 24×24 视口、线宽、色调和无障碍属性，不依赖运行时图标包。
- 首页、行程、预算、AA 账本、数据管理、待整理中心和决策转盘使用语义图标区分新增、搜索、日期、成员、支出、转账、导出和危险操作；关键命令仍保留文字标签，顶部图标按钮固定为方形以避免原生按钮在 flex 布局中拉伸。
- 首页提供“新手演示”，自动准备一组不会覆盖个人内容的示例，通过四个任务串起体验记录、行程、AA 分账和决策转盘；退出后只清理由演示创建的数据。
- 演示进度保存在本地，目标功能页成功打开后才计为完成；每个目标页都有当前任务提示和“返回演示”入口。
- 首页会显示“演示中”与完成进度；演示数据缺失时会在当前点击内自动恢复，并支持重新开始或随时退出。
- 系统主题与 canvas 像素比改用微信新的细分设备 API，同时为旧基础库保留兼容回退。
- 三个主入口统一使用相同的页面边距、字号层级、按钮高度、卡片边界和触控反馈。
- 体验首页按“概览、继续记录、旅行工具、我的档案”分区，工具入口使用双列布局，减少长列表滚动。
- 档案视图使用可横向滚动的分段导航，避免六个标签在窄屏上挤压文字。
- 行程空状态提供创建、安排、预算三个明确步骤；行程卡展示完成进度和预算摘要。
- 行程筛选无结果与首次无数据使用不同空状态；筛选无结果时可一键清除条件，不会误导用户重新创建行程。
- 想去清单、地点和行程编辑会在内容修改后启用离开提醒；保存、删除或确认放弃后及时解除提醒。
- 已被删除或被备份替换的体验、行程、预算和想去项会显示可返回的恢复页面，不会静默落入新增模式或停留在空白页。
- 旅行地图在无坐标点或当前筛选无结果时展示原因和下一步；年度回忆册返回页面后会刷新数据并保留仍有效的年份选择。
- AA 首页突出累计支出和待结算状态，编辑与删除收进“管理”菜单并继续保留删除确认。
- AA 账本明确区分“未记账 / 进行中 / 已结清”，没有支出的账本不会计入已结清统计。
- 行程详情把复制和删除收进“更多”菜单；覆盖导入会明确列出将被替换的数据范围，清理操作完成后提供结果反馈。

### 想去清单与待整理

- 酒店和餐厅支持“想去 / 已预订 / 已到访”状态，以及优先级、目标日期、预算、预订编号、同行人和计划备注。
- 想去项支持名称搜索、类型筛选、状态筛选和优先级排序。
- 可以关联已有地点；发现相似地点时必须由用户确认，不会静默合并。
- 从想去项发起“记录到访”会自动带入地点信息；体验保存成功后才会标记为已到访。
- 待整理中心集中显示疑似重复地点、缺少城市/地址、孤立记录、已完成未评分、长期草稿和想去项重复建议。
- 失效照片元数据与无主照片文件分开处理；无主文件只从应用自己的媒体登记表识别，不会误删 PDF 或其他文件。
- 重复地点合并、照片清理和删除操作继续要求用户确认。

### 行程计划、预算与智能录入

- 底部“行程”入口按进行中、即将开始、已结束和已归档组织旅行。
- 行程支持多个城市、日期、本位币、总预算、分类预算、按天日程和时间冲突提醒。
- 按天时间线使用 UTC 安全的纯日期计算，避免东八区日期显示提前一天。
- 想去项可加入指定行程；完成体验后会回写对应日程的到访状态与记录 ID。
- 复制行程保留日程结构和预算，但清空实际支出、关联账本和到访记录。
- 预算中心实时读取所选 AA 账本支出，不复制账本数据；个人支出单独保存，避免重复统计。
- 预算中心拆分展示个人支出与 AA 账本支出，并在关联项中显示计入笔数和金额；个人支出可选择行程内日期。
- 新建行程默认使用今天至明天，减少首次录入步骤。
- 行程详情支持点击已有日程直接编辑，日期选择限制在行程范围内。
- 日程支持同日上下排序和单条复制；个人支出支持编辑、删除确认与结果反馈，行程列表支持关键词和状态筛选。
- 行程支持整日复制；删除前会列出仍需处理的日程、个人支出和关联账本。
- 行程测试覆盖跨月/跨年日期、长时间线保护、日程越界、编辑 ID 稳定性、外币分值舍入、预算来源隔离、未知分类和复制/删除边界。
- 外币支出使用手工固定汇率，保存原币金额、汇率和折算后的整数分金额。
- 汇率必须大于 0，空值才使用默认汇率 1，避免输入 0 时被静默改写。
- AA 支出明细展示每位成员的实际承担金额；测试持续校验总付款、总应摊、转账流入流出和成员净额守恒。
- 体验表单提供内置和自定义模板，并根据历史记录建议城市、房型或菜系。
- 模板只保存安全字段，不保存日期、评分、照片、价格或私密备注；历史建议不会覆盖已填写内容。

### 决策转盘

- 首页“旅行工具”提供决策转盘，支持保存多个转盘、批量导入 2–50 个等概率选项、编辑排序和临时停用。
- 可点击按钮旋转，也可直接用手拨动；canvas 动画使用真实角速度、惯性衰减和固定指针命中，页面本身保持静止且不触发设备震动。
- 转盘采用多色扇区、双层外圈、中心轴和独立于 canvas 的动态指针，编辑状态仍能看到明确指向；编辑区在添加后自动收起，结果弹层强化最终选择的视觉反馈。
- 抽中后可再转一次或移出本轮，最近保留 50 条历史；完整备份升级为 schemaVersion 8 并包含转盘数据。

- 开发版的数据管理页可生成和清除固定示例集，覆盖酒店、餐厅、三人非整除分账、行程与预算联动；清理仅按登记 ID 删除示例内容。
- 底部三个主入口使用一致的线性图标和选中状态，提升页面定位感。

### 同步架构预留

- 页面通过 `recordRepository`、`placeRepository`、`wishlistRepository` 和 `ledgerRepository` 访问数据，不直接依赖缓存实现。
- 当前 Repository 使用本地适配器，后续可以增加远端适配器而不修改页面业务。
- 记录、地点和想去项包含 `revision`、`syncStatus`、`deviceId`、`cloudId`、`syncedAt`、`deletedAt`。
- 新增、编辑和删除会进入待同步状态；删除采用软删除并保留 tombstone。
- Repository 提供待同步批次、确认同步和冲突快照接口，冲突不会自动覆盖本地版本。
- 公开地点、公开评论和私有同步使用独立 DTO；公开 DTO 不包含精确地址、设备 ID、私密备注或本地照片路径。

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
- 支持导出结算图片、私人 PDF、匿名分享 PDF 和完整明细 JSON。
- 分享版稳定匿名化成员名称并清除支出私密备注，四种分摊方式和整数分结果保持不变。
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
- 完整备份格式为 `schemaVersion: 8`，包含记录、地点、行程、模板、想去清单、转盘、导出偏好和账本，并继续兼容 v1-v7。
- v1 / v2 导入时会为没有地点对象的记录生成独立地点，不会按同名自动合并。
- 导入前展示记录、账本和支出数量，支持合并或覆盖。
- 恢复统一写入记录、地点、想去清单、账本、行程、模板及两类导出偏好；任一写入失败时自动回滚。
- 同一备份重复合并会跳过已有内容，ID 冲突时会稳定重映射关联字段。
- PDF 支持“私人版”和“脱敏版”。
- 脱敏版把精确日期降为月份，隐藏会员等级、价格、私密备注和真实成员姓名。
- JSON 备份包含照片路径、分类和说明，但不嵌入图片二进制；跨设备恢复不会带回照片文件。
- 同一设备恢复时若照片仍存在可继续使用，失效文件会在页面中标记。

完整备份的核心结构：

```js
{
  schemaVersion: 8,
  app: "experience-review-miniprogram",
  exportedAt: "...",
  records: [],
  places: [],
  wishlist: [],
  ledgers: [],
  trips: [],
  formTemplates: [],
  wheels: [],
  preferences: {
    story: {},
    yearbook: {}
  },
  media: {
    binariesIncluded: false
  }
}
```

## 主要目录

```text
miniprogram/
  components/ui-icon/  全局线性图标组件
  assets/icons/         本地 24×24 语义图标
  pages/index/          首页体验档案
  pages/record/         酒店/餐厅记录新增、详情、编辑
  pages/place/          地点详情、多次到访、编辑和合并
  pages/insights/       个人旅行年度洞察
  pages/travel-map/     已到访与想去地点地图
  pages/story/          单条体验照片故事
  pages/yearbook/       年度回忆册与导出
  pages/trip/           行程列表、编辑、按天日程和预算中心
  pages/wishlist/       想去清单新增、详情和编辑
  pages/cleanup/        数据健康检查与安全整理
  pages/data/           完整备份、恢复和隐私 PDF
  pages/ledger/index/   AA 账本列表
  pages/ledger/edit/    AA 账本新增/编辑
  pages/ledger/detail/  AA 账本详情、支出录入、结算
  utils/hotelScore.js
  utils/hotelReviewStore.js
  utils/placeStore.js
  utils/mediaStore.js
  utils/travelInsights.js
  utils/travelMap.js
  utils/storyRenderer.js
  utils/yearbookBuilder.js
  utils/reportCanvas.js
  utils/tripStore.js
  utils/formTemplateStore.js
  utils/wishlistStore.js
  utils/cleanupService.js
  utils/syncMetadata.js
  utils/syncDtos.js
  utils/repositories/   Repository 接口与本地适配器
  utils/pdfReport.js
  utils/tripLedgerStore.js
  utils/ledgerMigration.js
  utils/ledgerValidation.js
  utils/appBackup.js
  utils/privacyPolicy.js
  utils/ledgerExport.js
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
- AA 匿名 JSON、PDF 封装和分摊明细一致性
- 金额输入解析
- v1 账本无损迁移和迁移失败保护
- 成员改名、归档、删除引用保护
- 部分结算、完整结算和撤销转账
- 余额守恒、无待结算转账和超额转账拦截
- 完整备份预检、v1 兼容、重复导入和 ID 重映射
- 完整备份任一缓存写入失败时的自动回滚
- 私人副本与脱敏副本不修改原始数据
- 旧记录地点迁移幂等且不会按同名自动合并
- 相似地点建议、重复到访、地点统计、合并和删除保护
- 快速草稿未评分、地图授权成功和拒绝后的手工回退
- 照片持久化、路径失效和文件清理
- 年度筛选、个人最佳、月度趋势和复访评分变化
- 地图到访/想去合并、筛选、同坐标偏移和无坐标回退
- 照片故事隐私字段、失效照片跳过、版式偏好保存
- 年度回忆册草稿排除、月份聚合、照片上限和 AA 年度汇总
- 行程日期边界、日程冲突、复制清理和按天组织
- 分类预算、固定汇率、AA 聚合与整数分金额守恒
- 模板字段白名单和历史建议不覆盖
- 想去项转体验、状态更新和地点关联
- Repository 待同步批次、软删除、冲突快照和公开 DTO 脱敏
- 失效照片与登记无主文件的安全清理
- v1-v8 备份兼容、偏好 ID 重映射和统一缓存回滚
- 页面事件流：创建账本、录入支出、确认部分结算、撤销结算和日期错误提示
- 转盘角度命中、惯性衰减、选项约束、50 项绘制、结果历史和页面事件流
- 页面回归：行程筛选无结果、清除筛选、空账本三态、失效详情恢复和危险操作菜单
- 未保存保护：想去项和地点编辑启用提醒，保存或放弃后解除提醒并恢复原值
- 返回刷新：年度回忆册保留年份选择并读取新增记录，地图空状态输出明确原因和待补充数量
- 图标系统：组件注册、SVG 资源完整性、统一视口和核心页面语义图标覆盖

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
node --check miniprogram/utils/travelMap.js
node --check miniprogram/utils/storyRenderer.js
node --check miniprogram/utils/yearbookBuilder.js
node --check miniprogram/utils/reportCanvas.js
node --check miniprogram/utils/tripStore.js
node --check miniprogram/utils/wheelEngine.js
node --check miniprogram/utils/wheelStore.js
node --check miniprogram/utils/formTemplateStore.js
node --check miniprogram/utils/wishlistStore.js
node --check miniprogram/utils/cleanupService.js
node --check miniprogram/utils/ledgerExport.js
node --check miniprogram/pages/index/index.js
node --check miniprogram/pages/record/record.js
node --check miniprogram/pages/place/detail.js
node --check miniprogram/pages/insights/index.js
node --check miniprogram/pages/travel-map/index.js
node --check miniprogram/pages/story/index.js
node --check miniprogram/pages/yearbook/index.js
node --check miniprogram/pages/trip/index.js
node --check miniprogram/pages/trip/edit.js
node --check miniprogram/pages/trip/detail.js
node --check miniprogram/pages/trip/budget.js
node --check miniprogram/pages/wheel/index.js
node --check miniprogram/pages/wishlist/edit.js
node --check miniprogram/pages/cleanup/index.js
node --check miniprogram/pages/data/index.js
node --check miniprogram/pages/ledger/index/index.js
node --check miniprogram/pages/ledger/edit/edit.js
node --check miniprogram/pages/ledger/detail/detail.js
```

## 项目瘦身

旧 WebAR demo 页面、组件、授权代码、编译产物和 `tencentcloud-webar-wx` 依赖已经移除。当前 npm 依赖只服务旅行体验档案和开发检查，不再需要 AR LICENSE 或 APP_ID。
