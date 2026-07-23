# 工具箱

一个完全离线的微信小程序日常工具箱。首页平级提供六个工具：AA 分账、简版行程、通用清单、决策转盘、酒店餐厅快评、程序员升级之路；右上角仅保留帮助与数据设置。

应用不要求登录，也不依赖业务服务器。所有业务数据均保存在当前微信小程序的本地缓存中，六个工具之间不保存关联 ID，删除或损坏其中一类数据不会连带修改其他工具。

## 六个工具

### AA 分账

- 支持多账本、多成员，以及一笔支出由指定成员参与分摊。
- 支持人均、固定金额、百分比和份数四种分摊方式。
- 自动计算成员已付、应摊、净额与推荐转账方案。
- 支持部分结算、完整结算、撤销结算和结算历史。
- 每个账本使用单一币种，不会把不同币种静默相加或换算。
- 金额始终以整数最小货币单位保存，例如人民币 `10.01` 元保存为 `1001` 分，避免浮点误差和尾差丢失。
- 支持导出结算图片、私人 PDF、匿名 PDF 和账本明细 JSON。
- 账本内部数据版本保持 `schemaVersion: 4`。

### 简版行程

- 保存目的地、开始日期和结束日期。
- 按天添加时间、标题、地点和备注。
- 支持事项编辑、删除及同日上下排序。
- 阻止事项日期超出行程范围，并提示同一天的时间冲突。
- 只管理日程，不记录预算、个人支出或其他工具的关联关系。

### 通用清单

- 支持创建和维护多份独立清单。
- 清单项可新增、编辑、完成、删除和上下排序。
- 自动计算已完成数量与整体进度。
- 内置旅行打包模板，重复应用模板不会生成重复项目。
- 同样适用于采购、出门准备和普通待办。

### 决策转盘

- 支持保存多份转盘，并批量输入 `2-50` 个选项。
- 支持按钮旋转和手势拨动，使用惯性动画停在固定高对比指针下。
- 选项可排序、临时停用或移出本轮。
- 保存最近 `50` 条结果历史，可再次旋转或清空历史。

### 酒店餐厅快评

- 类型仅区分酒店和餐厅。
- 每条快评保存名称、城市、到访日期、可选总分和一句备注。
- 支持新增、查看、编辑、删除、搜索和类型筛选。
- 固定数据结构：

```js
{
  id,
  type,
  name,
  city,
  visitDate,
  score,
  note,
  createdAt,
  updatedAt
}
```

### 程序员升级之路

- 一局约 `20-30` 分钟，依次经历入行求职、初级生存、独当一面、核心骨干、路线分叉和职业答案。
- 每章包含 `4` 个固定事件和 `2` 个种子事件；首版共 `60` 个事件，单局经历 `36` 个。
- 技术力、沟通力、精力、积蓄和影响力五项属性限制在 `0-100`。
- 选择前仅提示影响方向，选择后显示即时变化；隐藏经历和延迟后果会影响后续事件及结局。
- 每次选择立即自动存档，结果反馈与继续推进分成两个阶段，重复点击不会重复结算。
- 生涯档案保留最终属性、关键选择和结局，支持收集 `12` 种不同职业结局。
- 事件池使用存档种子，确保相同种子与相同选择能够得到相同结果。

## 本地数据

页面通过六个本地域 Store 读写数据，不直接操作业务缓存：

| 工具 | Store | 缓存键 |
| --- | --- | --- |
| 酒店餐厅快评 | `miniprogram/utils/quickRecordStore.js` | `toolbox_quick_records` |
| 简版行程 | `miniprogram/utils/tripStore.js` | `toolbox_trips` |
| 通用清单 | `miniprogram/utils/checklistStore.js` | `toolbox_checklists` |
| AA 分账 | `miniprogram/utils/tripLedgerStore.js` | `toolbox_ledgers` |
| 决策转盘 | `miniprogram/packages/tools/utils/wheelStore.js` | `toolbox_wheels` |
| 程序员升级之路 | `miniprogram/packages/tools/utils/careerGameStore.js` | `toolbox_career_runs` |

### 完整备份

数据设置页可以导出和导入完整 JSON 备份。当前工具箱备份格式为 `schemaVersion: 2`，与 AA 账本自身的 `schemaVersion: 4`、游戏生涯自身的 `schemaVersion: 1` 是不同层级的版本号。

```js
{
  schemaVersion: 2,
  app: "local-toolbox-miniprogram",
  exportedAt: "...",
  records: [],
  trips: [],
  checklists: [],
  ledgers: [],
  wheels: [],
  careerRuns: []
}
```

- 导入前会校验应用标识、版本、集合类型和重复 ID。
- 兼容导入工具箱备份 v1；v1 不包含游戏数据，导入时按空生涯集合处理。
- 支持合并导入与覆盖导入。
- 写入前会为六个缓存创建统一快照；任一缓存写入失败时，已写入的集合会自动回滚。
- 合并时若出现多个活动生涯，只保留更新时间最新的一局为活动进度，其余标记为已中断。
- 数据设置页显示本地占用和上次成功导出时间，也提供清空全部工具数据的入口。

### 首次升级清理

第一次运行工具箱版本时，`toolboxMigration` 会执行一次不可逆清理：删除旧版体验档案缓存及其中登记的本地照片，然后写入 `toolbox_initialized_v1` 标记。后续启动不会重复执行，也不会删除上述六个 `toolbox_*` 新缓存。

在升级前仍需要旧数据时，应先使用旧版本自行留存；新工具箱不提供旧数据迁移或旧备份恢复。

### 数据风险

- 卸载小程序、清理微信缓存、系统回收存储或更换设备，都可能导致本地数据丢失。
- 本地数据不会自动跨设备同步，应定期在数据设置页导出 JSON 备份，并把文件保存到小程序沙箱之外。
- 清空数据和首次升级清理均不可撤销。
- AA 导出的图片、PDF 和 JSON 可能包含金额、成员及支出信息，分享前请确认导出模式和接收人。
- 完全离线表示业务数据不上传；微信自身的文件选择、预览和分享行为仍受微信客户端能力与权限控制。

## 页面路由

项目不使用底部 TabBar，首页是六工具网格。

| 路由 | 用途 |
| --- | --- |
| `/pages/index/index` | 工具箱首页 |
| `/pages/ledger/index/index` | AA 账本列表 |
| `/pages/ledger/edit/edit` | 新建或编辑 AA 账本 |
| `/pages/ledger/detail/detail` | 支出、统计与结算 |
| `/pages/trip/index` | 行程列表 |
| `/pages/trip/edit` | 新建或编辑行程 |
| `/pages/trip/detail` | 按天管理行程事项 |
| `/pages/checklist/index` | 多清单管理 |
| `/pages/record/index` | 快评列表 |
| `/pages/record/record` | 新建、查看或编辑快评 |
| `/packages/tools/wheel/index` | 决策转盘 |
| `/packages/tools/career/index` | 游戏首页、继续或新建生涯 |
| `/packages/tools/career/play` | 剧情选择、反馈、章节与结局 |
| `/packages/tools/career/archive` | 生涯记录与结局图鉴 |
| `/packages/tools/help/index` | 帮助与使用手册 |
| `/packages/tools/data/index` | 数据设置、备份与清空 |

## 主要目录

```text
miniprogram/
  app.js                         启动与一次性旧数据清理
  app.json                       页面、分包和全局窗口配置
  components/ui-icon/            本地图标组件
  assets/icons/                  本地 SVG 图标
  pages/index/                   六工具首页
  pages/ledger/                  AA 账本列表、编辑和详情
  pages/trip/                    行程列表、编辑和详情
  pages/checklist/               通用多清单
  pages/record/                  酒店餐厅快评
  packages/tools/wheel/          决策转盘页面
  packages/tools/career/         程序员升级之路页面与插画
  packages/tools/help/           小程序内帮助
  packages/tools/data/           数据设置
  packages/tools/utils/
    wheelStore.js                转盘 Store
    careerGameContent.js         六阶段剧情、事件与结局
    careerGameEngine.js          种子事件、数值和结局计算
    careerGameStore.js           游戏存档与生涯档案 Store
    appBackup.js                 v2 备份、v1 兼容与回滚
  utils/
    quickRecordStore.js          快评 Store
    tripStore.js                 行程 Store
    checklistStore.js            清单 Store
    tripLedgerStore.js           AA Store
    toolboxMigration.js          一次性旧数据清理
scripts/                         语法、路由、文档和业务测试
docs/                            生成的用户手册
```

## 开发与验证

### 环境

- Node.js 与 npm：只用于开发检查和测试。
- 微信开发者工具：用于真实小程序编译和模拟器交互。
- 微信官方 `wechatide-skill`：用于打开项目、编译、页面自动化、截图和运行时诊断。
- 小程序没有运行时 npm 依赖，不需要执行“构建 npm”。

项目调测只使用微信开发者工具导出的官方 `wechatide-skill`，不依赖仓库内自定义 Agent 桥接文件。首次使用时应按官方 Skill 的 `SKILL.md` 完成版本、登录与本地授权检查。

首次安装开发依赖：

```bash
npm install
```

运行完整校验：

```bash
npm run verify
```

该命令依次执行：

```bash
npm run check:syntax
npm run check:routes
npm run check:bundle
npm run check:guide
npm test
```

帮助内容调整后，可先生成仓库内用户手册：

```bash
npm run docs:generate
```

### 微信开发者工具

直接导入项目根目录 `/Users/shi/WeChatProjects/miniprogram-1`，或使用命令行打开：

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project /Users/shi/WeChatProjects/miniprogram-1
```

打开后按以下顺序验收：

1. 在编译模式中选择“普通编译”，点击“编译”。
2. 确认模拟器能进入六工具首页，控制台没有 WXML、WXSS、JS 或路由错误。
3. 依次点击六个工具；游戏至少完成创建角色、连续选择、刷新恢复和查看生涯档案。
4. 打开开发者工具的“代码质量”面板并执行扫描；不同版本中该入口可能位于右上角“详情”或“工具”菜单。
5. 检查主包、工具分包和本地 SVG 资源均能正常加载。

### 自动化测试覆盖

`npm test` 使用 mock 的 `wx`、`Page` 和文件系统接口，覆盖：

- 首页六个工具入口、帮助入口和数据设置入口。
- 快评严格字段归一化、CRUD、搜索筛选、未保存提醒与固定保存栏。
- 行程日期边界、事项 CRUD、同日排序、时间冲突和页面事件。
- 多清单 CRUD、完成进度、排序和旅行模板幂等。
- AA 多人及部分成员分摊、四种分摊方式、随机金额守恒和稳定尾差。
- AA 成员改名与归档、部分结算、撤销、币种隔离、图片/PDF/JSON 导出。
- 转盘选项约束、角度命中、惯性衰减、停用选项、历史和页面事件。
- 游戏 60 个事件的结构引用、种子复现、属性边界、隐藏经历、延迟后果和 12 种结局。
- 游戏自动存档、结果阶段幂等、章节推进、重开确认、生涯档案和结局图鉴页面事件。
- 完整备份 v1/v2 预检、合并与覆盖、重复 ID、非法文件和六缓存写入失败回滚。
- 首次升级清理只执行一次，并保护六个新工具缓存。
- 页面路由、主包边界、图标资源、工具分包和用户手册一致性。

每次开发完成后执行 `npm run verify`，再使用微信官方 `wechatide-skill` 完成普通编译、主要点击流程、截图与控制台检查。验证通过后更新 README、提交 Git，并上传对应版本的体验版。
