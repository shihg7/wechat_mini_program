# 日常工具箱协作开发指南

本文是开发者和编程 Agent 进入仓库后的第一份操作说明。它记录当前 `1.11.2` 产品边界、代码结构、数据约束、验证流程，以及微信开发者工具官方 Skills 的学习和使用方式。

如实现或工作流发生变化，请同步更新本文和 `README.md`。项目约定：每次代码变更都要检查并更新 README。

## 1. 开始前

1. 阅读本文件和 `README.md`。
2. 执行 `git status --short`，先识别用户或其他开发者尚未提交的改动。
3. 不回退、不覆盖、不顺手格式化与当前任务无关的文件。
4. 从最新 `origin/main` 创建自己的功能分支，不在共享分支上强推。
5. 首次拉取后执行 `npm ci`，然后运行 `npm run verify` 建立基线。
6. `minitest/` 当前是本机实验目录，除非任务明确要求，不要提交。

推荐的 Git 起步流程：

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/<short-name>
npm ci
npm run verify
```

远端仓库：

```text
https://github.com/shihg7/wechat_mini_program.git
```

## 2. 产品定位

这是一个完全离线、纯前端的微信小程序日常工具箱。当前首页有十个平级工具：

1. 日期计算
2. 单位换算
3. 二维码生成
4. 截图打码
5. 决策转盘
6. AA 分账
7. 简版行程
8. 通用清单
9. 程序员生涯模拟
10. 华子研发模拟

当前不做：

- 登录、账号体系、云同步或跨设备同步
- 后端接口、云数据库、公共评论流
- 地图、照片云上传、公开分享页
- 工具之间的关联 ID
- 需要联网更新的数据，例如实时汇率

产品允许用户随开随用。需要长期保存的数据只在本机缓存，用户应通过数据设置导出 JSON 备份。

## 3. 代码结构

主包页面：

```text
miniprogram/pages/index/       十工具首页
miniprogram/pages/ledger/      AA 账本
miniprogram/pages/trip/        简版行程
miniprogram/pages/checklist/   通用清单
```

工具分包：

```text
miniprogram/packages/tools/date-calculator/
miniprogram/packages/tools/unit-converter/
miniprogram/packages/tools/qr-generator/
miniprogram/packages/tools/screenshot-redactor/
miniprogram/packages/tools/wheel/
miniprogram/packages/tools/career/
miniprogram/packages/tools/huawei-sim/
miniprogram/packages/tools/help/
miniprogram/packages/tools/data/
```

共享逻辑：

```text
miniprogram/utils/                         主包 Store 与业务逻辑
miniprogram/packages/tools/utils/          工具分包逻辑、Store、备份
miniprogram/components/ui-icon/            统一图标组件
miniprogram/assets/icons/                   本地 SVG 图标
scripts/                                   Node 测试和静态检查
```

页面负责交互和展示；金额、日期、抽题、排序、备份等规则放入可独立测试的模块。业务页面不得直接散落 `wx.setStorageSync`，应通过对应 Store 读写。

## 4. 本地数据约束

五类持久业务数据：

| 数据 | Store | 缓存键 |
| --- | --- | --- |
| 行程 | `miniprogram/utils/tripStore.js` | `toolbox_trips` |
| 清单 | `miniprogram/utils/checklistStore.js` | `toolbox_checklists` |
| AA 账本 | `miniprogram/utils/tripLedgerStore.js` | `toolbox_ledgers` |
| 转盘 | `miniprogram/packages/tools/utils/wheelStore.js` | `toolbox_wheels` |
| 生涯模拟 | `miniprogram/packages/tools/utils/careerGameStore.js` | `toolbox_career_runs` |

额外的轻量探索统计：

- 两个模拟器共用 `simulationStatsStore.js`，缓存键为 `toolbox_simulation_stats`，内部按 `career`、`huawei` 域隔离。
- 只保存事件展示次数、回答次数、首次与最近出现轮次、最近事件及最近 30 局摘要。
- 不保存具体答案内容、反馈正文、结果、昵称或账号，也不联网。
- 不进入完整备份，清空全部数据时会一起删除。

临时工具：

- 日期计算、单位换算、二维码输入和截图打码图片只存在当前页面。
- 退出页面后清空，不写缓存，不进入备份。

必须保持的规则：

- 完整备份格式为 `schemaVersion: 3`，只包含五类持久业务数据。
- AA 内部格式为 `schemaVersion: 4`，金额始终使用整数最小货币单位。
- 生涯模拟存档有自己的版本，不要与完整备份版本混淆。
- 导入必须先校验，写入失败时五个缓存统一回滚。
- 五个工具不保存跨工具关联 ID，删除一类数据不能连带修改另一类。
- 不把 token、账号凭据、私有配置或用户导出的真实数据提交到仓库。

## 5. 业务实现要点

### 日期计算

- 使用 UTC 日序处理日期间隔，避免时区和夏令时误差。
- 工作日只排除周六、周日，不声称包含法定节假日。

### 单位换算

- 温度使用独立公式，其余类别走统一基准单位。
- 数据容量区分十进制 `KB/MB/GB` 和二进制 `KiB/MiB/GiB`。
- 杯、品脱、加仑使用美制并在界面明确说明。

### 二维码

- 使用固定版本的纯 JavaScript QR 库，保留许可证。
- 输入上限按 UTF-8 字节计算。
- 固定高对比黑白、M 级纠错和四模块留白，优先保证可扫。

### 截图打码

- 自动识别使用聊天布局和本地像素特征，不读取文字内容、不识别人脸身份，不接入网络 OCR。
- 禁止只用像素复杂度或颜色方差猜头像；先识别聊天内容上下边界并排除底部输入工具栏，头像候选再同时检查边缘位置、至少三侧稳定方形边界和紧邻内侧的消息内容证据。
- 远处气泡、时间条和另一侧消息不得为边缘壁纸或工具栏图标提供头像证据；必须保留相应反误判测试。
- 名称候选必须来自头像附近的稀疏文字形态并收紧到实际内容；私聊气泡、聊天图片和纹理壁纸必须有反误判测试。
- 自动结果只是候选，界面必须明确要求用户检查；手工框选和涂抹始终可用。
- 区域统一使用原图归一化坐标，预览缩放、移动和原图导出不得各自维护另一套坐标。
- 马赛克和模糊强度不得低于隐私安全下限；多个效果重叠时，更彻底的纯色遮挡必须最后绘制。
- 保存必须保持方向校正后的原图宽高；无法创建原图 Canvas 时明确失败，不静默缩小。
- 页面固定高度并使用内部画布手势，底部保存操作始终可见，手势不得带动整页滚动。
- 图片、区域、撤销栈和临时输出在离开页面时清除，不新增 Store，不修改备份 v3。

### AA 分账

- 所有金额计算使用整数，不使用浮点金额。
- 随机金额、尾差、部分结算、撤销和多币种隔离必须有测试。
- 图片、PDF 和 JSON 导出属于工具结果，不进入完整备份。

### 程序员生涯模拟

- 使用种子保证相同输入可复现。
- 自由模拟首轮每阶段必须保持 4 个主线加 2 个支线；复玩每阶段最多 1 个主线，其余 5 个位置优先选择未见且条件匹配的事件。
- 今日情景使用固定题序，不能因个人探索统计产生不同题目；事件展示和回答仍计入探索统计。
- 自适应选择依次考虑解锁轮次、条件、未见、冷却期和低频，并保持相同种子与相同统计快照可复现。
- 选择结算必须幂等，重复点击不能重复增加属性。
- 事件展示、回答和运行完成统计同样必须按 `runKey + eventId` 幂等。
- 存档升级必须兼容已有本地记录。
- 当前事件库为 360 个情景；`careerGameExpansion.js` 与 `careerGameTripleExpansion.js` 只扩展题池，不改变单局 36 题配额。

### 华子研发模拟

- 内容是非官方虚构复合创作，争议内容明确标记来源边界。
- 当前有 48 个词条、192 个情景、576 个选择；`huaweiSimTripleExpansion.js` 只扩展普通题池，不改变单局 15 题及既有 10 个复玩解锁题。
- 首轮完成后解锁 10 个复玩支线。
- 第二轮优先刚解锁和未见事件，后续依次考虑低频题与冷却期。
- 题池容量允许时，前四轮完整模拟不重复。
- 当前选择和结果不落盘，只有共享 Store 中的 `huawei` 域探索统计保存在本机。

## 6. UI 与交互底线

项目曾多次出现文字显示不全和页面抖动问题，以下规则必须执行：

- 长标题、长选项、备注和按钮文字必须完整换行。
- 不对业务正文使用 `line-clamp`、省略号或固定两行高度。
- Flex 子元素中承载文字的容器应设置 `min-width: 0`。
- 固定格式控件使用稳定尺寸，动态内容不能改变整体布局。
- 页面需要内部滚动时，根页面固定高度并关闭外层滚动，避免切换状态时整页抖动。
- 底部主要操作应在视口底部可见，内容区为按钮预留安全间距。
- 图标优先使用统一 `ui-icon` 组件，不临时绘制风格不一致的图标。
- 工具页保持简洁、工作导向，不堆叠卡片，不在卡片中再嵌套卡片。
- 修改 UI 后必须检查窄屏和常规屏，不能只看默认模拟器尺寸。

## 7. 测试与文档

常用命令：

```bash
npm test
npm run check:syntax
npm run check:routes
npm run check:bundle
npm run docs:generate
npm run check:guide
npm run verify
```

`npm run verify` 是提交前最低门槛，包含：

- JS 与 JSON 语法检查
- 小程序路由检查
- 主包边界检查
- 用户手册同步检查
- 全部 Store、算法和页面事件测试

测试约定：

- 新增业务逻辑时同时增加对应 `scripts/test-*.js`。
- 金额、日期、排序、导入回滚和种子抽题使用确定性测试。
- 页面测试至少覆盖主流程、空状态、重复点击、失败提示和长文本样式守卫。
- 静态测试通过不等于小程序可用，完成后仍要用官方 Skill 编译并模拟点击。

文档约定：

- 小程序内帮助的内容源是 `miniprogram/packages/tools/help/helpContent.js`。
- `docs/USER_GUIDE.md` 是生成文件，不要单独手改。
- 修改帮助内容后执行 `npm run docs:generate`。
- 每次代码变更检查并更新 `README.md`。
- 工作流、架构或协作要求变化时同步更新 `AGENT.md`。

## 8. 微信官方 Skills 去哪里学习

优先级从高到低：

1. 微信官方文档：[开发者工具 Skills](https://developers.weixin.qq.com/miniprogram/dev/devtools/Skills.html)
2. 微信开发者工具菜单栏：`导出开发者工具 Skill`
3. 当前 Agent 本机导出的根说明：`$HOME/.codex/skills/wechatide-skill/SKILL.md`
4. 根说明引用的各 scene：`$HOME/.codex/skills/wechatide-skill/skills/<scene>/SKILL.md`
5. 工具索引和参数定义：导出 Skill 内的 `references/tool-index.md` 与工具 schema

官方页面说明，开发者工具 Skills 覆盖项目管理、页面自动化、运行时诊断、编译、预览发布和云开发。开发者工具版本要求、命令名和参数可能更新，因此不要只复制旧文档或聊天记录中的命令。

不要在仓库、自动化脚本或本文中固定 Skill 版本号。每次更新微信开发者工具或开始新的调试会话时，都应读取本机版本：

```bash
SKILL_ROOT="$HOME/.codex/skills/wechatide-skill"
SKILL_VERSION="$(awk '/^version:/ { print $2; exit }' "$SKILL_ROOT/skill.yaml")"
```

随后以当前导出的根 `SKILL.md` 为准执行状态门禁：

```bash
wechatide -c <clientName> check_wechatide_status \
  --skill-version "$SKILL_VERSION"
```

`<clientName>` 使用当前 Agent 名称，并在同一会话保持一致。先检查版本关系，再检查登录状态和 token 要求。状态未就绪时不要继续编译、自动化或上传。

- `versionRelation: equal`：直接使用当前官方 Skill。
- `versionRelation: agent_behind`：从返回的 `skillPath` 单向整目录覆盖 `$HOME/.codex/skills/wechatide-skill`，重新读取 `skill.yaml` 并复查；不能只改版本号。
- `versionRelation: agent_ahead`：记录兼容风险后继续，只有遇到明确缺工具或参数的阻断时才按 installer 指引更新 IDE。
- 只允许 IDE 安装目录到 Agent Skill 目录的单向同步，禁止反向写入 `.app` 或 `app.asar.unpacked`。

## 9. 官方 Skill 场景选择

| 任务 | 先阅读 |
| --- | --- |
| 打开项目、登录、AppID、运行时上下文 | `skills/initializer/SKILL.md` |
| 项目列表、代码片段分享或导入 | `skills/project-manager/SKILL.md` |
| 修改 `project.config.json` | `skills/project-config/SKILL.md` |
| 编译、打开页面、刷新模拟器、构建 npm | `skills/compiler/SKILL.md` |
| 点击、输入、滚动、页面断言 | `skills/automator/SKILL.md` |
| console、network、截图和运行时诊断 | `skills/debugger/SKILL.md` |
| 预览、二维码和上传体验版 | `skills/previewer/SKILL.md` |
| 云环境、云函数、数据库和存储 | `skills/cloudbase-operator/SKILL.md` |
| 更新微信开发者工具 | `skills/installer/SKILL.md` |

使用原则：

- 先读根 `SKILL.md`，再按当前任务进入一个 scene。
- 不编造工具名和参数，不凭记忆调用旧接口。
- 页面点击只用 automator，console 和截图诊断交给 debugger。
- 官方截图工具不传 `path` 时会返回临时文件路径，优先使用该路径做视觉核对。
- `simulator_refresh` 触发成功不代表编译通过。
- 工具返回异步 `taskId` 时按根 Skill 的 pending 规则处理，不重复发起上传。
- 使用官方 `wechatide` 工作流，不再使用 `Difficult-Burger/miniprogram-agent-bridge` 或其他非官方桥接方案。

## 10. 标准调试流程

1. 运行 `npm run verify`。
2. 读取官方 Skill 版本并完成状态门禁。
3. 通过 initializer 确认项目窗口、登录状态和当前页面。
4. 通过 compiler 编译或打开目标页面。
5. 通过 automator 用真实点击完成主要流程。
6. 通过 debugger 检查 `console` 中的 error/warning，并截图核对窄屏布局。
7. 修复后重新运行相关测试和 `npm run verify`。
8. 提交 Git 并推送远端。
9. 使用 previewer 上传新的体验版版本号。
10. 查询异步上传结果，确认成功后再汇报完成。

重点模拟流程：

- 首页十个入口都能进入并返回。
- 日期、换算、二维码各完成一次有效输入。
- 截图打码至少验证浅色双侧、深色单侧、私聊无昵称、群聊昵称、聊天大图、纹理壁纸、底部输入工具栏、远处气泡、不同头像尺寸和长截图；检查自动候选，手工补充一处，并确认导出 PNG 与方向校正后的原图尺寸一致。
- AA 创建成员、支出、部分结算和撤销，核对金额守恒。
- 行程和清单完成新增、编辑、排序、删除。
- 转盘完成点击旋转和手势拨动。
- 两个模拟器完成选项点击、反馈推进、重新开始和结果页。
- 程序员自由模拟至少完成首轮和第二轮，确认第二轮每阶段最多 1 个主线且优先新事件；今日情景确认同日题序固定。
- 华子研发模拟至少完成首轮，再确认第二轮出现“复玩解锁”并优先未见事件。
- 两个模拟器都要核对发现进度、本轮新题数和新题率；重复点击不得重复增加展示、回答或完成统计。

## 11. Git 与发布

提交前：

```bash
git status --short
git diff --check
npm run verify
```

提交要求：

- 一次提交只解决一个清晰问题。
- 提交信息使用 `feat:`、`fix:`、`refactor:`、`docs:`、`test:` 等前缀。
- 不提交 `node_modules`、私有配置、凭据、开发者工具运行产物或本机测试目录。
- 不使用 `git reset --hard`、`git checkout --` 或强推覆盖他人历史。
- 看到陌生改动时先确认所有权，不能擅自回退。

推送前先同步远端：

```bash
git fetch origin
git rebase origin/main
git push -u origin HEAD
```

如分支已共享或 rebase 会改写他人历史，改用合并并解决冲突。禁止对 `main` 使用 `--force`。

体验版发布：

- 版本号与 `package.json` 保持一致。
- 上传前必须完成全量测试和官方模拟器主要流程。
- 使用官方 previewer Skill 的 `upload`。
- 同一次异步上传只发起一次，保留并查询原 `taskId`。
- 上传成功后记录版本、提交哈希和验证结果。

## 12. 已验证的经验

- 纯前端不等于不需要数据设计。Store、schema、导入校验和失败回滚仍然重要。
- 静态语法通过不代表 WXML/WXSS 在开发者工具中正常，必须实际编译。
- 单元测试通过不代表交互可用，必须模拟用户点击并观察页面状态。
- 长文本问题需要通过 CSS 规则和静态守卫测试双重防止回归。
- 种子抽题必须可复现，同时要用已见题和使用次数降低复玩重复。
- 页面退出即清空与“不进入备份”是两件事，文案和实现都要准确区分。
- 帮助页与 Markdown 手册共用内容源，可以避免两套文档长期漂移。
- 主包和分包边界需要持续检查，否则工具增长后容易超包或产生错误依赖。
- 发布不是“命令已触发”就结束，必须确认异步任务最终成功。

## 13. 完成定义

一个任务只有同时满足以下条件才算完成：

- 功能按需求实现，边界和失败状态明确。
- README 已检查并更新。
- 相关测试已新增或更新。
- `npm run verify` 通过。
- 官方 Skill 编译通过，主要流程已模拟点击。
- console 无新增运行错误。
- Git 已提交并推送。
- 需要体验版时，上传任务已确认成功。
