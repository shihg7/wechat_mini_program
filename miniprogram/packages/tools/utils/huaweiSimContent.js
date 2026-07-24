const DISCLAIMER = "非官方情景模拟。术语整理自公开资料；标记为“网络职场叙事”的内容来自二手公开报道，仅作虚构复合素材，不代表已证实制度、普遍经历或任何真实员工。";

const STAT_META = {
  delivery: { label: "交付信用", shortLabel: "交付", tone: "blue" },
  tech: { label: "技术深度", shortLabel: "技术", tone: "green" },
  energy: { label: "能量余量", shortLabel: "能量", tone: "amber" },
  influence: { label: "组织影响", shortLabel: "影响", tone: "accent" }
};

const STAT_KEYS = Object.keys(STAT_META);

const GLOSSARY_CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "culture", label: "文化语境" },
  { id: "process", label: "研发流程" },
  { id: "delivery", label: "交付协同" },
  { id: "office", label: "职场通用" },
  { id: "network", label: "网络叙事" }
];

const OFFICIAL_CULTURE = "华为公开材料";
const OFFICIAL_PROCESS = "华为云公开文档";
const PUBLIC_MANAGEMENT = "公开管理资料";
const INDUSTRY_COMMON = "行业通用表达";
const REPORTED_NARRATIVE = "网络职场叙事";

const GLOSSARY = [
  {
    id: "customer-centric",
    term: "以客户为中心",
    category: "culture",
    plain: "判断工作的最终价值时，先看客户问题是否真正得到解决。",
    usage: "常用于讨论需求优先级、质量责任和一线响应。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "striver-oriented",
    term: "以奋斗者为本",
    category: "culture",
    plain: "公开治理语境中的价值分配原则，强调责任、贡献与结果。",
    usage: "模拟中只作为文化术语出现，不把加班等同于奋斗。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "self-criticism",
    term: "自我批判",
    category: "culture",
    plain: "主动检查自己的判断和机制，而不只是寻找外部原因。",
    usage: "复盘时应落到可改变的行动，而不是表演式检讨。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "main-channel",
    term: "主航道",
    category: "culture",
    plain: "组织当前集中资源投入的核心业务方向。",
    usage: "常用于判断一个想法是核心投入、探索项目还是应该停止。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "grow-grain",
    term: "打粮食",
    category: "culture",
    plain: "创造可衡量的业务结果，而不是只完成活动或展示过程。",
    usage: "研发语境里不应被简化成只追短期收入，还要与长期能力平衡。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "soil-fertility",
    term: "增加土地肥力",
    category: "culture",
    plain: "建设平台、人才、流程和技术资产，让未来交付更容易。",
    usage: "常与短期“打粮食”并列，用来讨论长期投入。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "frontline-command",
    term: "班长的战争",
    category: "culture",
    plain: "让更靠近现场的人拥有及时决策和调动资源的能力。",
    usage: "强调一线授权，同时仍需边界、证据和责任记录。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "call-artillery",
    term: "听得见炮声的人呼唤炮火",
    category: "culture",
    plain: "离客户和问题最近的人提出资源需求，后方快速支持。",
    usage: "模拟中对应生产故障、客户阻塞和跨团队支援。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "force-one-hole",
    term: "力出一孔",
    category: "culture",
    plain: "多个团队把力量集中到共同目标，不各自制造一套方向。",
    usage: "适合处理重复建设和跨部门优先级冲突。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "benefit-one-hole",
    term: "利出一孔",
    category: "culture",
    plain: "激励和价值分配围绕共同贡献规则，避免多套标准互相打架。",
    usage: "常与“力出一孔”一起出现。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "entropy-reduction",
    term: "熵减",
    category: "culture",
    plain: "持续清理组织和系统中的混乱、冗余与低效。",
    usage: "在研发里可以落实为删流程、还技术债和降低协作成本。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "red-blue",
    term: "红蓝军",
    category: "culture",
    plain: "一方提出方案，另一方刻意从反面挑战假设和风险。",
    usage: "目标是提高决策质量，不是把评审变成人身对抗。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "strategic-reserve",
    term: "战略预备队",
    category: "culture",
    plain: "面向新岗位或重点任务进行集中学习、训练和再配置的机制。",
    usage: "模拟中表现为一次需要重新选择方向的轮岗邀请。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "black-soil",
    term: "黑土地",
    category: "culture",
    plain: "为上层业务持续提供公共能力的平台、生态或基础设施。",
    usage: "做黑土地往往不抢镜，但会影响许多团队的交付效率。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "ipd",
    term: "IPD",
    category: "process",
    plain: "集成产品开发，用跨职能方式管理产品从机会到生命周期的过程。",
    usage: "它不是一张表，而是一组决策、协同和评审机制。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "pdt",
    term: "PDT",
    category: "process",
    plain: "产品开发团队，通常由研发、市场、质量等不同角色共同组成。",
    usage: "遇到跨职能目标时，不能只从单一研发视角作答。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr",
    term: "TR",
    category: "process",
    plain: "Technical Review，技术评审的统称。",
    usage: "评审重点应是证据、风险和准入条件，而不是把 PPT 翻完。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr1",
    term: "TR1",
    category: "process",
    plain: "公开 IPD 指南中的需求和概念阶段技术评审点。",
    usage: "重点检查需求是否值得做、能否形成合理概念。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr2",
    term: "TR2",
    category: "process",
    plain: "公开 IPD 指南中的规格与总体方案评审点。",
    usage: "重点检查需求规格、总体设计与关键约束。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr3",
    term: "TR3",
    category: "process",
    plain: "公开 IPD 指南中的概要设计评审点。",
    usage: "关键架构问题若在这里被忽略，后面修改成本会明显上升。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr4",
    term: "TR4",
    category: "process",
    plain: "公开 IPD 指南中的详细设计或系统集成前评审点。",
    usage: "重点确认实现是否具备进入下一阶段的质量基础。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr4a",
    term: "TR4A",
    category: "process",
    plain: "公开 IPD 指南中的系统设计验证与发布准备相关评审点。",
    usage: "模拟里常出现在发布窗口前的最后一道关键检查。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr5",
    term: "TR5",
    category: "process",
    plain: "公开 IPD 指南中的样机或系统验证阶段评审点。",
    usage: "重点看验证结果能否支撑后续发布或试制。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "tr6",
    term: "TR6",
    category: "process",
    plain: "公开 IPD 指南中的发布准备与量产相关评审点。",
    usage: "产品、质量、供应和交付条件需要一起过关。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_PROCESS
  },
  {
    id: "cbb",
    term: "CBB",
    category: "process",
    plain: "Common Building Block，可复用的公共构件或能力模块。",
    usage: "复用能提高效率，但公共能力也需要清晰的版本和责任边界。",
    sourceKind: "public",
    sourceLabel: PUBLIC_MANAGEMENT
  },
  {
    id: "tdt",
    term: "TDT",
    category: "process",
    plain: "公开 IPD 实践资料中常见的技术开发团队称呼。",
    usage: "通常聚焦跨产品可复用的技术能力。",
    sourceKind: "public",
    sourceLabel: PUBLIC_MANAGEMENT
  },
  {
    id: "ipmt",
    term: "IPMT",
    category: "process",
    plain: "公开 IPD 实践资料中常见的集成组合管理团队称呼。",
    usage: "用于组合层面的投资、优先级和重大阶段决策。",
    sourceKind: "public",
    sourceLabel: PUBLIC_MANAGEMENT
  },
  {
    id: "isc",
    term: "ISC+",
    category: "delivery",
    plain: "集成供应链转型语境，强调从计划到交付的协同。",
    usage: "研发变更若忽略供应和交付约束，后果会在末端放大。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "e2e",
    term: "E2E",
    category: "delivery",
    plain: "End to End，从需求起点一直看到客户结果终点。",
    usage: "不能只证明“我这段代码没问题”，还要看整条链路。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "pbc",
    term: "PBC",
    category: "office",
    plain: "公开管理案例中常解释为个人业务承诺，用来约定阶段目标与衡量方式。",
    usage: "好的目标要可验证、可协作，也要识别不可控前提。",
    sourceKind: "public",
    sourceLabel: PUBLIC_MANAGEMENT
  },
  {
    id: "dste",
    term: "DSTE",
    category: "office",
    plain: "公开管理资料中常见的“从战略到执行”框架称呼。",
    usage: "把战略意图拆到年度目标、重点任务和执行复盘。",
    sourceKind: "public",
    sourceLabel: PUBLIC_MANAGEMENT
  },
  {
    id: "ltc",
    term: "LTC",
    category: "delivery",
    plain: "Lead to Cash，从销售线索到合同履行和回款的端到端流程。",
    usage: "研发需求有时来自这条链路，但仍需澄清价值和范围。",
    sourceKind: "public",
    sourceLabel: PUBLIC_MANAGEMENT
  },
  {
    id: "align",
    term: "对齐",
    category: "office",
    plain: "确认目标、事实、责任人和时间点是否一致。",
    usage: "真正的对齐要形成决定，不是再开一次没有结论的会。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "connect",
    term: "拉通",
    category: "office",
    plain: "把跨团队的信息、依赖和决策链连接起来。",
    usage: "拉通的产物应是责任边界和下一步，不只是把更多人拉进群。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "close-loop",
    term: "闭环",
    category: "office",
    plain: "问题从发现、处理、验证到复盘都有明确结果。",
    usage: "只回复“收到”不算闭环，验证结果和责任人必须可追踪。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "review",
    term: "复盘",
    category: "office",
    plain: "回看目标、事实、判断和行动，提炼下次可复用的改进。",
    usage: "重点是改机制，不是寻找一个人承担全部叙事。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "granularity",
    term: "颗粒度",
    category: "office",
    plain: "描述信息、任务或指标拆分得有多细。",
    usage: "颗粒度越细不一定越好，应以能作出决定为准。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "lever",
    term: "抓手",
    category: "office",
    plain: "把抽象目标变成可以真正推动的具体机制或动作。",
    usage: "如果没有负责人、资源和验证方式，抓手通常只是名词。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "pressure",
    term: "压强投入",
    category: "culture",
    plain: "在关键方向集中足够资源和注意力，形成突破。",
    usage: "集中投入需要清楚退出条件，否则容易演变成长期透支。",
    sourceKind: "public",
    sourceLabel: PUBLIC_MANAGEMENT
  },
  {
    id: "result-oriented",
    term: "责任结果导向",
    category: "culture",
    plain: "不仅报告做了什么，还要对可验证的结果和后果负责。",
    usage: "结果要结合权限、事实与长期质量，不能只看单一数字。",
    sourceKind: "official",
    sourceLabel: OFFICIAL_CULTURE
  },
  {
    id: "b-rating",
    term: "B绩效",
    category: "network",
    plain: "网络职场讨论中对 B 档绩效结果的简称，具体比例、标准和影响会随时期与团队变化。",
    usage: "沟通时应回到可核验事实、评价标准、实际影响和下周期要求，避免只接受模糊比较。",
    sourceKind: "reported",
    sourceLabel: REPORTED_NARRATIVE
  },
  {
    id: "b-front",
    term: "B里靠前",
    category: "network",
    plain: "一些二手文章转述的绩效安慰话术，意思是同为 B 档但相对靠前，并非正式制度定义。",
    usage: "“靠前”不能替代评分证据、差距说明和后续安排，必要时可要求形成书面纪要。",
    sourceKind: "reported",
    sourceLabel: REPORTED_NARRATIVE
  },
  {
    id: "at-review",
    term: "AT评议",
    category: "network",
    plain: "公开管理文章中常见的集体绩效评议说法，具体成员、流程和权限并无统一公开定义。",
    usage: "如果直接评价在评议后变化，应询问变化依据、决策链路与正式复核渠道。",
    sourceKind: "reported",
    sourceLabel: REPORTED_NARRATIVE
  },
  {
    id: "rd-output",
    term: "输出非研发",
    category: "network",
    plain: "公开管理案例里对研发人员流向非研发岗位的描述，可能被解释为培养，也可能被个人体验为被动转岗。",
    usage: "确认新岗位职责、汇报关系、考核、地点、薪酬、过渡期限和旧工作移交，并保留书面版本。",
    sourceKind: "reported",
    sourceLabel: REPORTED_NARRATIVE
  },
  {
    id: "performance-talk",
    term: "绩效沟通",
    category: "office",
    plain: "围绕评价事实、判断标准、结果影响和改进要求进行的正式沟通。",
    usage: "有效沟通应能回答做对了什么、差距在哪里、证据是什么、如何复核和下一步做什么。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "public-scolding",
    term: "当众批评",
    category: "network",
    plain: "公开员工叙事中出现的高压管理行为，但它并非某一家企业独有，也不能据此推断普遍文化。",
    usage: "把讨论拉回具体事实与补救动作；涉及侮辱或持续越界时，记录时间、原话、见证人与正式反馈。",
    sourceKind: "reported",
    sourceLabel: REPORTED_NARRATIVE
  },
  {
    id: "person-role-fit",
    term: "人岗匹配",
    category: "office",
    plain: "评估个人能力、意愿与岗位责任是否匹配，不应成为没有事实依据的模糊威胁。",
    usage: "讨论调整时要明确岗位缺口、评价证据、可选路径、时间表和相应保障。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  },
  {
    id: "appeal-trace",
    term: "申诉留痕",
    category: "office",
    plain: "对重要评价或岗位争议保存事实材料，并通过正式渠道提出复核请求。",
    usage: "整理目标、交付证据、反馈纪要和时间线，避免夹带客户秘密、源代码或无关隐私。",
    sourceKind: "common",
    sourceLabel: INDUSTRY_COMMON
  }
];

const STAGES = [
  { id: "onboarding", title: "第一阶段 · 入场对齐", subtitle: "先听懂语言，再决定怎样做事" },
  { id: "release", title: "第二阶段 · 版本攻坚", subtitle: "进度、质量和技术债同时敲门" },
  { id: "frontline", title: "第三阶段 · 一线协同", subtitle: "客户现场不会按组织架构报错" },
  { id: "crossroad", title: "第四阶段 · 路线抉择", subtitle: "你开始影响系统，也被系统影响" },
  { id: "performance", title: "第五阶段 · 绩效与去留", subtitle: "当评价、关系与岗位同时到场" }
];

function choice(id, text, outcome, effects, tags) {
  return { id, text, outcome, effects, tags: tags || [] };
}

function event(id, stageId, termId, title, situation, choices) {
  return { id, stageId, termId, title, situation, choices };
}

const EVENTS = [
  event("onboarding-pbc", "onboarding", "pbc", "第一份 PBC 被退回",
    "你写下“高质量完成模块开发”。主管说颗粒度不够，要能看出业务结果、关键里程碑和协同边界。",
    [
      choice("rewrite-outcome", "重写成可验证的结果，同时列出依赖、风险和需要主管协调的资源。", "目标变得可执行，也留下了合理的前提条件。", { delivery: 7, influence: 4, energy: -2 }, ["结果", "边界"]),
      choice("promise-more", "把指标全部翻倍，先表现出态度，具体怎么完成以后再说。", "承诺看起来很亮眼，但未来的你收到了一张高息账单。", { delivery: -3, influence: 2, energy: -8 }, ["冲刺", "透支"]),
      choice("copy-template", "找一份往年模板逐字替换，确保格式一个标点都不出错。", "格式过关了，真正的目标仍然没有人说得清。", { delivery: 1, tech: -1, energy: -3 }, ["流程", "保守"])
    ]),
  event("onboarding-align", "onboarding", "align", "“这个事情先对齐一下”",
    "需求会开了四十分钟，产品、测试和研发分别以为对方已经确认了范围。",
    [
      choice("decision-log", "用三分钟复述目标、非目标、负责人和截止时间，并把结论写进会议纪要。", "会议第一次产生了可执行的决定。", { delivery: 6, influence: 6, energy: -2 }, ["沟通", "闭环"]),
      choice("another-meeting", "建议再约一次更完整的对齐会，把所有可能相关的人都邀请进来。", "日历更满了，分歧原封不动。", { delivery: -2, influence: 1, energy: -6 }, ["会议", "回避"]),
      choice("silent-build", "不再争论，按自己理解先写代码，做出来大家自然会懂。", "你很快交付了一个没人明确要过的版本。", { tech: 4, delivery: -5, energy: -4 }, ["独行", "返工"])
    ]),
  event("onboarding-tr", "onboarding", "tr", "第一次坐进 TR 评审",
    "屏幕上全是缩写。轮到你介绍方案时，评委问的不是代码，而是关键假设、失效模式和验证证据。",
    [
      choice("evidence-first", "先讲约束和风险，再用数据、原型与测试计划逐项支撑结论。", "评委继续追问，但讨论终于围绕证据展开。", { tech: 7, delivery: 4, energy: -3 }, ["评审", "证据"]),
      choice("slides-first", "把七十页材料从第一页开始完整朗读，避免漏掉任何一句话。", "材料讲完了，评审时间也讲完了。", { delivery: -3, energy: -6, influence: -2 }, ["PPT", "低效"]),
      choice("defer-all", "遇到问题都回复“会后确认”，先确保现场不出现明确反对票。", "会议看似平静，会后的问题清单开始指数增长。", { delivery: -4, influence: -3, energy: -2 }, ["回避", "风险"])
    ]),
  event("onboarding-cbb", "onboarding", "cbb", "公共组件还是自己重写",
    "现有 CBB 能覆盖八成需求，但文档旧、接入慢；你自己写两周就能得到一个完全贴合当前项目的版本。",
    [
      choice("improve-cbb", "先验证公共组件的边界，再补文档和缺口，让后续团队也能复用。", "短期多花了一点时间，公共能力却真正向前走了一步。", { tech: 7, influence: 5, delivery: 2, energy: -5 }, ["平台", "复用"]),
      choice("rewrite-local", "立即自研一份，只对当前项目负责，版本交付后再讨论统一。", "当前进度很快，组织里又多了一套相似实现。", { delivery: 6, tech: 2, influence: -4, energy: -4 }, ["交付", "重复建设"]),
      choice("force-use", "不做验证，规定所有人必须原样使用公共组件，问题由接入方自行适配。", "复用率上去了，抱怨和旁路方案也一起上去了。", { influence: -5, delivery: -2, energy: 1 }, ["流程", "僵化"])
    ]),
  event("onboarding-blue", "onboarding", "red-blue", "蓝军把方案问穿了",
    "蓝军指出你的容量模型依赖三个未经验证的乐观假设，现场气氛迅速降温。",
    [
      choice("invite-attack", "把三个假设写到白板上，请对方继续攻击，并约定补充实验后再决策。", "方案暂时没有通过，但风险在上线前暴露了。", { tech: 8, influence: 4, energy: -4 }, ["蓝军", "开放"]),
      choice("defend-status", "强调方案已经得到多位领导关注，继续质疑会影响整体节奏。", "评审被推进了，疑问没有消失。", { delivery: 2, influence: -5, tech: -3 }, ["权威", "风险"]),
      choice("counter-attack", "逐条寻找对方方案的漏洞，把评审变成势均力敌的辩论赛。", "你赢下了气势，输掉了共同解决问题的机会。", { influence: -4, energy: -5, tech: 1 }, ["对抗", "消耗"])
    ]),
  event("onboarding-self-review", "onboarding", "self-criticism", "复盘会上的自我批判",
    "一个需求因为接口理解偏差整段返工。复盘室突然安静，大家都在等第一个人开口。",
    [
      choice("mechanism-fix", "说明自己遗漏的验证动作，并提议增加契约样例和联调准入检查。", "问题从个人失误变成了可修复的机制缺口。", { influence: 6, tech: 4, delivery: 3, energy: -2 }, ["复盘", "机制"]),
      choice("take-all-blame", "把所有责任都揽到自己身上，承诺以后更努力、更仔细。", "会议很快结束，但相同缺口仍在流程里。", { influence: 1, energy: -7, tech: -1 }, ["检讨", "透支"]),
      choice("trace-others", "逐条证明需求、测试和接口方也有责任，确保自己不吃亏。", "事实更完整了，团队信任却变薄了。", { delivery: -2, influence: -5, energy: -4 }, ["归因", "防御"])
    ]),
  event("onboarding-granularity", "onboarding", "granularity", "周报颗粒度突然升级",
    "原本三行的周报被要求拆到每日、每模块、每风险。你发现整理周报将占掉半天。",
    [
      choice("decision-level", "询问周报服务哪个决策，再提供能暴露偏差的最小字段和自动数据链接。", "汇报更短，管理者反而更快看见风险。", { delivery: 4, influence: 6, energy: 2 }, ["效率", "管理"]),
      choice("full-detail", "严格拆到最细，每天预留一小时维护，让任何人都挑不出格式问题。", "信息量大幅增长，真正的异常被淹没了。", { energy: -7, delivery: -2 }, ["细节", "消耗"]),
      choice("refuse-report", "直接说写周报没有价值，从此只在代码提交里汇报进展。", "你节省了时间，也让非研发角色失去了观察窗口。", { tech: 3, influence: -5, delivery: -2 }, ["边界", "孤岛"])
    ]),
  event("onboarding-pdt", "onboarding", "pdt", "PDT 里每个人都有一个真相",
    "市场想抢窗口，质量要求补验证，研发担心架构承受不住。三种意见都合理，但资源只够支持一条路线。",
    [
      choice("shared-model", "把收益、风险、投入和不可逆后果放到同一张决策表，再请负责人明确取舍。", "争论从立场转向了共同约束。", { influence: 7, delivery: 5, energy: -3 }, ["跨职能", "决策"]),
      choice("tech-veto", "坚持技术风险最大，要求所有人接受研发提出的路线。", "风险被看见了，但研发也被视为只会说不。", { tech: 5, influence: -4, delivery: -2 }, ["技术", "单边"]),
      choice("market-first", "完全按市场窗口推进，所有质量和架构问题都登记为后续优化。", "窗口赶上了，后续清单长得像第二个产品。", { delivery: 6, tech: -5, energy: -5 }, ["窗口", "债务"])
    ]),
  event("onboarding-loop", "onboarding", "close-loop", "群里的一百个“收到”",
    "线上问题群消息飞快，每个人都回复收到，却没人明确谁分析、谁决策、何时验证。",
    [
      choice("owner-clock", "整理当前事实，指定临时负责人、下一检查点和结束条件。", "消息变少了，问题开始移动。", { delivery: 7, influence: 5, energy: -2 }, ["闭环", "责任"]),
      choice("keep-responding", "继续快速回复每条消息，保证自己的响应时长始终最好看。", "响应指标很好，故障时长没有变化。", { delivery: -4, energy: -5 }, ["指标", "忙碌"]),
      choice("wait-leader", "等级别更高的人发话，避免自己越权。", "所有人都在等待，故障没有耐心。", { delivery: -6, influence: -3, energy: -2 }, ["等待", "失速"])
    ]),
  event("onboarding-main", "onboarding", "main-channel", "主航道旁边的闪亮原型",
    "你做了一个很酷的内部原型，但它与当前主航道目标关系不大，还需要两个月才能证明价值。",
    [
      choice("small-experiment", "把它缩成两周可验证的实验，明确成功标准和停止条件。", "探索被保留，同时没有无限吞噬主线资源。", { tech: 5, influence: 4, delivery: 1, energy: -3 }, ["创新", "验证"]),
      choice("secret-build", "利用晚上悄悄做完，等效果惊艳时再告诉团队。", "原型更完整了，你的能量和主线进度同时报警。", { tech: 6, energy: -10, delivery: -4 }, ["探索", "透支"]),
      choice("drop-immediately", "既然不在主航道，立刻删除所有代码，不再浪费一分钟。", "资源回到主线，也失去了一次低成本学习机会。", { delivery: 4, tech: -2, energy: 3 }, ["聚焦", "保守"])
    ]),

  event("release-tr3", "release", "tr3", "TR3 前夜的架构洞",
    "压测显示核心链路在峰值下会放大数据库写入，但改方案可能让版本延后一周。",
    [
      choice("surface-risk", "带着压测证据上会，提出降级方案、修复计划和明确的发布门槛。", "版本可能变慢，但决策建立在真实风险上。", { tech: 8, delivery: 4, influence: 4, energy: -5 }, ["架构", "透明"]),
      choice("average-data", "改用平均流量数据，先证明大多数时间系统都能正常工作。", "图表变好看了，峰值并没有因此消失。", { delivery: 2, tech: -6, influence: -4 }, ["数据", "粉饰"]),
      choice("late-refactor", "今晚直接重构核心链路，明早带一个全新方案参加评审。", "你赌上睡眠换来了可能性，也带来了未经验证的新风险。", { tech: 7, energy: -12, delivery: -2 }, ["重构", "冒险"])
    ]),
  event("release-tr4", "release", "tr4", "TR4 的测试缺口",
    "详细设计已完成，但异常网络和低内存场景没有测试环境。发布日期已经写进联合计划。",
    [
      choice("risk-tier", "按影响分级，先补最高风险场景，并把未覆盖项写进发布限制。", "有限资源被用在最危险的地方。", { delivery: 6, tech: 5, energy: -4 }, ["质量", "取舍"]),
      choice("declare-not-applicable", "把缺失场景标成“不适用”，避免影响评审完整率。", "表格全绿了，现实世界仍然五颜六色。", { delivery: -4, tech: -5, influence: -3 }, ["流程", "掩盖"]),
      choice("block-everything", "在所有环境齐备前拒绝任何后续动作，不接受替代验证。", "质量立场很纯粹，跨团队窗口也完全关闭。", { tech: 4, delivery: -6, influence: -4, energy: -2 }, ["质量", "僵化"])
    ]),
  event("release-tr4a", "release", "tr4a", "TR4A 前的最后一个红灯",
    "发布候选版本只剩一个低概率崩溃未定位。它尚未在客户环境复现，但调用栈指向核心模块。",
    [
      choice("release-gate", "暂停放量，补最小复现、监控和可验证回滚，再重新判断。", "你没有假装确定，而是把不确定性装进了护栏。", { tech: 7, delivery: 4, energy: -5, influence: 3 }, ["发布", "护栏"]),
      choice("ship-watch", "按期全量发布，安排所有人盯群，出问题再快速响应。", "日期守住了，团队把风险搬到了线上。", { delivery: 4, energy: -10, tech: -4 }, ["上线", "值守"]),
      choice("delete-test", "判断是测试不稳定，先屏蔽用例，让流水线恢复绿色。", "流水线安静了，问题也获得了隐身能力。", { delivery: -3, tech: -7, influence: -4 }, ["指标", "掩盖"])
    ]),
  event("release-e2e", "release", "e2e", "“我这个模块没问题”",
    "客户操作失败。你负责的接口返回 200，日志看起来完全正常，但整条业务链仍然没有完成。",
    [
      choice("trace-chain", "沿用户动作追踪完整链路，和上下游一起找到状态丢失的位置。", "模块边界被暂时放下，客户链路恢复了。", { delivery: 8, influence: 5, tech: 4, energy: -5 }, ["端到端", "协同"]),
      choice("send-logs", "把成功日志截图发群里，说明当前模块已经自证清白。", "你证明了局部正确，也证明了局部正确不等于结果。", { delivery: -6, influence: -5, energy: 1 }, ["局部", "甩锅"]),
      choice("add-retry", "不查根因，先在当前接口增加三次重试，希望链路自行恢复。", "失败率暂时下降，重复请求制造了新的边缘问题。", { delivery: 2, tech: -4, energy: -3 }, ["止血", "副作用"])
    ]),
  event("release-debt", "release", "soil-fertility", "版本之后永远还有下个版本",
    "历史模块每次改动都要人工回归两天。大家同意它是技术债，但排期表里永远没有它的位置。",
    [
      choice("debt-budget", "用故障和人时数据量化成本，争取每个版本固定一部分治理预算。", "技术债第一次拥有了业务语言。", { tech: 7, influence: 6, delivery: 2, energy: -3 }, ["技术债", "长期"]),
      choice("weekend-fix", "不占正式排期，自己周末慢慢重构，完成后给团队一个惊喜。", "代码更干净了，你的恢复时间消失了。", { tech: 7, energy: -12, influence: -1 }, ["重构", "透支"]),
      choice("accept-forever", "既然还能运行，就继续人工回归，把两天成本写进每次估算。", "交付可预测了，土地继续贫瘠。", { delivery: 2, tech: -5, energy: -4 }, ["稳定", "债务"])
    ]),
  event("release-quality", "release", "result-oriented", "质量红线撞上窗口期",
    "一个数据一致性问题只影响极少量用户，但一旦发生就无法自动修复。业务希望按计划上线。",
    [
      choice("make-tradeoff-visible", "给出影响范围、修复成本和可逆性，让有权限的人签署清晰决策。", "你没有替组织偷偷承担风险。", { influence: 6, delivery: 5, tech: 4, energy: -3 }, ["责任", "决策"]),
      choice("quiet-fix", "口头答应上线，同时私下继续修复，争取在发布前两边都满足。", "你把系统矛盾变成了个人熬夜问题。", { tech: 4, energy: -11, delivery: 1 }, ["救火", "透支"]),
      choice("absolute-veto", "只回复“质量问题一票否决”，拒绝说明概率、影响和替代方案。", "立场很明确，合作方却无法做出更好的判断。", { tech: 3, influence: -5, delivery: -4 }, ["红线", "沟通"])
    ]),
  event("release-entropy", "release", "entropy-reduction", "流程已经长出流程",
    "同一个发布要填写三套相似表格，分别服务三个群。没有人知道哪一份是最终版本。",
    [
      choice("single-source", "找到真正的审批和信息需求，建立单一数据源，其余视图自动生成。", "流程少了一层，信息反而更可靠。", { delivery: 6, influence: 7, energy: 3 }, ["熵减", "自动化"]),
      choice("perfect-all", "同时维护三份，设置闹钟逐项同步，保证任何群里都不会被点名。", "你成为了流程的人肉消息队列。", { energy: -9, delivery: -1 }, ["维护", "消耗"]),
      choice("ignore-two", "只更新自己最常看的那份，其他表格等有人追问再补。", "工作量下降了，信息不一致开始制造新会议。", { energy: 3, influence: -4, delivery: -3 }, ["简化", "失联"])
    ]),
  event("release-pressure", "release", "pressure", "关键版本进入压强投入",
    "两周内资源全部向一个高优目标集中。你的团队可以暂停其他工作，但连续冲刺风险已经出现。",
    [
      choice("exit-criteria", "接受集中投入，同时明确每日上限、轮值、退出条件和被暂停工作的恢复计划。", "压强有了边界，团队知道终点在哪里。", { delivery: 8, influence: 5, energy: -5 }, ["冲刺", "边界"]),
      choice("all-in", "宣布全员全天候在线，任何私人安排都为版本让路。", "短期速度上升，错误率和沉默也开始上升。", { delivery: 5, energy: -15, influence: -5, tech: -2 }, ["冲刺", "燃尽"]),
      choice("quiet-resistance", "表面接受，实际让每个人自行判断优先级，不再同步真实负荷。", "团队避免了公开冲突，也失去了统一节奏。", { delivery: -5, influence: -4, energy: 2 }, ["回避", "分散"])
    ]),
  event("release-cbb-version", "release", "cbb", "CBB 升级牵一发动全身",
    "公共库修复了安全问题，但新版本有破坏性变更。六个项目都在等你的迁移建议。",
    [
      choice("compat-plan", "提供兼容层、迁移样例和版本时限，先让高风险项目完成升级。", "公共修复开始可控地扩散。", { tech: 8, influence: 7, delivery: 4, energy: -6 }, ["平台", "迁移"]),
      choice("broadcast-deadline", "群发通知要求明天下班前全部升级，具体报错由各项目自行解决。", "通知看似闭环了，真正的迁移工作并没有。", { delivery: -3, influence: -6, energy: -2 }, ["命令", "协作"]),
      choice("fork-old", "为每个项目维护一个旧版分支，先保证它们都不用改代码。", "眼前很平静，你获得了六条长期维护线。", { delivery: 4, tech: -6, energy: -9 }, ["兼容", "债务"])
    ]),
  event("release-rollback", "release", "close-loop", "回滚按钮在谁手里",
    "上线十分钟后错误率持续升高。研发、运维和业务都在等别人宣布回滚。",
    [
      choice("trigger-plan", "按事先门槛立即回滚，记录决策时间，再在稳定后分析根因。", "系统先恢复，复盘有了完整时间线。", { delivery: 9, influence: 5, energy: -4 }, ["止损", "闭环"]),
      choice("one-more-minute", "再观察五分钟，希望曲线自己回落，避免回滚影响发布评价。", "曲线没有理解你的考核压力。", { delivery: -8, energy: -7, influence: -4 }, ["等待", "风险"]),
      choice("hotfix-live", "跳过回滚，直接在线修改配置并连续热修复。", "问题可能更快结束，也可能失去可控的基线。", { tech: 3, delivery: -2, energy: -10 }, ["热修", "冒险"])
    ]),
  event("release-grain", "release", "grow-grain", "这项优化算不算粮食",
    "你把接口延迟降低了 40%，但业务方说没有直接新增收入，不愿给它更高优先级。",
    [
      choice("link-value", "把延迟与转化、故障成本和容量支出联系起来，再决定是否继续投入。", "技术指标终于连接到了业务结果。", { tech: 6, influence: 6, delivery: 5, energy: -2 }, ["价值", "数据"]),
      choice("tech-is-value", "坚持性能本身就是最高价值，不需要任何业务解释。", "技术判断很坚定，资源争取却停在原地。", { tech: 4, influence: -5, delivery: -2 }, ["专业", "孤岛"]),
      choice("drop-metrics", "既然不算粮食，就停止性能工作，把所有时间投入可见需求。", "短期产出更直观，容量账单悄悄增长。", { delivery: 5, tech: -5, energy: 1 }, ["短期", "取舍"])
    ]),

  event("frontline-artillery", "frontline", "call-artillery", "一线发来一段模糊录屏",
    "客户现场无法继续操作，只有一段抖动录屏和一句“尽快解决”。后方三个团队都说信息不足。",
    [
      choice("rapid-kit", "先提供最小采集脚本和绕行方案，同时建立一线、研发、运维共同频道。", "现场先恢复部分能力，后方也拿到了可诊断证据。", { delivery: 9, influence: 7, tech: 4, energy: -6 }, ["一线", "支援"]),
      choice("request-form", "要求客户完整填写标准问题模板，字段不齐前不进入研发队列。", "流程得到保护，客户仍停在原地。", { delivery: -7, influence: -5, energy: 2 }, ["流程", "等待"]),
      choice("guess-fix", "根据录屏猜测最可能原因，立即发一个未经现场验证的补丁。", "响应很快，现场获得了第二个不确定变量。", { delivery: -3, tech: -3, energy: -6 }, ["快速", "冒险"])
    ]),
  event("frontline-commander", "frontline", "frontline-command", "现场需要一个班长",
    "跨团队故障持续升级，每个专家都只处理自己的切片，没有人维护全局状态。",
    [
      choice("temporary-command", "主动担任临时协调人，维护事实板、决策点和资源请求，不越过专业判断。", "专家仍各司其职，但第一次共享同一张战场地图。", { influence: 9, delivery: 7, energy: -7 }, ["指挥", "协同"]),
      choice("deep-dive-only", "专注把自己模块分析到极致，协调工作应该由项目经理负责。", "你的模块结论很扎实，全局仍然没人拼起来。", { tech: 6, delivery: -3, influence: -4, energy: -3 }, ["专业", "局部"]),
      choice("escalate-all", "把所有问题直接升级给最高负责人，请其逐项指定责任人。", "资源开始移动，也把每个小决定都抬到了最高层。", { delivery: 2, influence: -3, energy: -2 }, ["升级", "依赖"])
    ]),
  event("frontline-ltc", "frontline", "ltc", "合同承诺里多出一个能力",
    "项目进入交付后，团队才发现销售材料中写了一项产品当前并不支持的定制能力。",
    [
      choice("trace-commitment", "还原承诺来源、客户价值和实现成本，让业务、交付与研发共同选择补做或重谈。", "问题没有被美化，但决策回到了完整链路。", { delivery: 7, influence: 7, energy: -5 }, ["合同", "端到端"]),
      choice("just-build", "不讨论承诺过程，研发连夜补上，先确保客户不追问。", "客户暂时满意，相同承诺机制仍会再次下单。", { delivery: 6, tech: 3, energy: -13, influence: -2 }, ["救火", "透支"]),
      choice("reject-sales", "声明这不是研发需求，要求销售自行向客户解释。", "责任边界很清楚，客户体验碎成了组织架构图。", { delivery: -8, influence: -6, energy: 2 }, ["边界", "割裂"])
    ]),
  event("frontline-isc", "frontline", "isc", "一个小改动碰到供应链",
    "你准备替换一个器件以解决性能问题，供应同事提醒这会影响认证、库存和多个交付批次。",
    [
      choice("impact-map", "先做端到端影响地图，比较软件绕行、分批切换和器件替换三种方案。", "研发方案第一次看见仓库和交付日期。", { tech: 6, delivery: 7, influence: 6, energy: -5 }, ["供应", "系统"]),
      choice("best-tech", "坚持使用技术指标最好的器件，其余问题由供应团队解决。", "单点性能提升了，系统成本迅速扩散。", { tech: 5, delivery: -6, influence: -5 }, ["技术", "单点"]),
      choice("never-change", "为了不影响供应，永久保留旧器件，用软件不断补偿。", "交付保持稳定，技术限制也被永久继承。", { delivery: 4, tech: -4, energy: -4 }, ["稳定", "妥协"])
    ]),
  event("frontline-localize", "frontline", "customer-centric", "现场说“不是这个意思”",
    "客户使用同一个词描述了完全不同的业务流程。远程团队按字面理解做出的功能无法落地。",
    [
      choice("observe-workflow", "请一线演示真实操作，从目标、角色和异常场景重新画流程。", "需求从一句话变成了可验证的工作场景。", { delivery: 8, influence: 5, tech: 3, energy: -4 }, ["客户", "需求"]),
      choice("dictionary", "要求双方先统一术语定义，没有标准词汇前暂停讨论。", "定义更整齐了，真实工作仍在标准之外。", { tech: 1, delivery: -5, influence: -3 }, ["术语", "僵化"]),
      choice("copy-competitor", "参考行业里最常见的做法直接实现，客户以后会慢慢适应。", "产品很像行业标准，唯独不像客户现场。", { delivery: -4, tech: 2, energy: -2 }, ["惯例", "假设"])
    ]),
  event("frontline-timezone", "frontline", "connect", "三个时区的一次拉通",
    "中国、欧洲和拉美团队需要共同处理问题。最方便的会议时间对其中一方永远是深夜。",
    [
      choice("async-handoff", "建立异步事实板和交接模板，只把关键决策留给轮换时段的短会。", "会议减少了，问题仍能跨时区连续推进。", { delivery: 7, influence: 7, energy: 4 }, ["异步", "协作"]),
      choice("same-people", "固定让最熟悉系统的两个人参加所有时区会议，保证上下文不丢。", "上下文很完整，两个人的能量几乎清零。", { delivery: 5, energy: -15, influence: -2 }, ["专家", "透支"]),
      choice("regional-islands", "让每个区域独立处理，只有彻底无法解决时才互相联系。", "时区问题消失了，重复故障和分叉方案出现了。", { energy: 3, tech: -4, delivery: -3 }, ["自治", "孤岛"])
    ]),
  event("frontline-partner", "frontline", "e2e", "合作方接口只在演示时稳定",
    "联合演示临近，合作方接口偶发超时。合同边界说它不归你负责，客户只看到整体失败。",
    [
      choice("joint-guardrail", "与合作方共同建立超时、降级和监控方案，并清晰记录双方责任。", "整体体验得到保护，边界也没有被抹掉。", { delivery: 8, influence: 6, tech: 5, energy: -6 }, ["伙伴", "韧性"]),
      choice("hide-button", "演示前临时隐藏相关入口，等正式上线再处理。", "演示顺利了，真实问题被延期到了更昂贵的时刻。", { delivery: 3, tech: -5, influence: -2 }, ["演示", "延期"]),
      choice("show-contract", "把合同责任截图发给客户，证明失败环节不属于本团队。", "责任说明很准确，客户满意度没有因此恢复。", { delivery: -7, influence: -6, energy: 1 }, ["合同", "割裂"])
    ]),
  event("frontline-network", "frontline", "tr5", "实验室通过，弱网失败",
    "系统在实验室连续通过验证，到偏远现场后却因网络抖动频繁中断。",
    [
      choice("field-model", "采集现场网络模型，补离线缓存、重试上限和可恢复状态验证。", "验证环境终于开始像真实世界。", { tech: 8, delivery: 7, energy: -6 }, ["弱网", "验证"]),
      choice("network-requirement", "要求现场先升级网络，产品只对标准环境负责。", "责任范围变简单了，可用场景也变小了。", { tech: 1, delivery: -6, influence: -4 }, ["边界", "适配"]),
      choice("infinite-retry", "把重试次数改成无限，网络总有恢复的时候。", "中断变少了，卡死和重复操作变多了。", { delivery: -3, tech: -6, energy: -3 }, ["重试", "副作用"])
    ]),
  event("frontline-scope", "frontline", "customer-centric", "客户又加了一个“顺手需求”",
    "现场反馈说只要再加一个按钮就能解决大问题，但背后涉及权限、审计和数据模型。",
    [
      choice("value-slice", "确认核心价值，设计一个可审计的最小切片，并明确后续范围。", "“一个按钮”被还原成了真实工程问题。", { delivery: 7, tech: 6, influence: 5, energy: -4 }, ["范围", "价值"]),
      choice("quick-button", "先把按钮做出来，权限和审计以后补，客户现在最重要。", "客户很快看见功能，安全债也同步上线。", { delivery: 5, tech: -6, energy: -4 }, ["快速", "债务"]),
      choice("process-backlog", "要求走完整年度需求流程，本次项目不再接受任何变更。", "范围守住了，现场窗口也关闭了。", { delivery: -5, influence: -4, energy: 2 }, ["流程", "僵化"])
    ]),
  event("frontline-teach", "frontline", "black-soil", "每次都靠专家远程救场",
    "同类问题第三次出现在不同项目，一线仍然只能停下业务，等待总部专家上线操作。",
    [
      choice("tool-and-train", "把诊断步骤做成工具和演练，一线可安全自助，专家只处理例外。", "一次救火变成了长期能力。", { tech: 7, influence: 8, delivery: 6, energy: -5 }, ["赋能", "平台"]),
      choice("expert-hotline", "建立专家 24 小时轮值群，保证任何现场都能快速找到人。", "响应速度提升，专家团队长期处于待命状态。", { delivery: 6, energy: -12, influence: 1 }, ["值守", "透支"]),
      choice("write-manual", "发一份八十页操作手册，并要求现场先完整学习再提问。", "知识被记录了，但仍然难以在故障时使用。", { tech: 3, delivery: -3, energy: -2 }, ["文档", "可用性"])
    ]),
  event("frontline-result", "frontline", "result-oriented", "指标绿了，客户还在抱怨",
    "内部看板显示响应时长和关闭率全部达标，客户却说问题被反复关闭又重开。",
    [
      choice("measure-outcome", "抽样回访并增加复发率与客户确认，把指标改到真正的结果上。", "漂亮数字减少了，真实改善开始出现。", { delivery: 8, influence: 7, energy: -3 }, ["指标", "结果"]),
      choice("explain-metrics", "向客户解释内部 SLA 已经达标，希望对方理解流程限制。", "客户理解了指标定义，但问题仍然存在。", { delivery: -5, influence: -4, energy: 1 }, ["指标", "解释"]),
      choice("close-faster", "要求团队更快关闭工单，用更高达标率证明服务正在改善。", "看板更绿，重开队列更长。", { delivery: -8, energy: -5, influence: -5 }, ["数字", "反向激励"])
    ]),
  event("frontline-force", "frontline", "force-one-hole", "两个团队同时造同一把轮子",
    "你发现两个区域团队都在开发相似诊断工具，因为各自交付窗口不同，谁也不愿停。",
    [
      choice("shared-core", "提炼共同核心和区域扩展点，保留交付节奏，同时合并底层能力。", "力量开始汇聚，差异也得到尊重。", { tech: 7, influence: 8, delivery: 4, energy: -6 }, ["复用", "协同"]),
      choice("winner-takes-all", "让进度快的团队成为唯一方案，另一边立即停工并迁移。", "重复建设结束了，迁移阻力和失落同时出现。", { delivery: 3, influence: -5, energy: -3 }, ["统一", "强推"]),
      choice("let-both-run", "各自交付最重要，等两个工具都成熟后再评估统一。", "短期谁也没受影响，长期维护成本翻倍。", { delivery: 5, tech: -5, energy: -4 }, ["自治", "重复"])
    ]),

  event("crossroad-reserve", "crossroad", "strategic-reserve", "战略预备队邀请",
    "你收到一次转入新方向训练的机会：短期要离开熟悉岗位，结果和未来位置都不确定。",
    [
      choice("join-with-plan", "确认学习目标、回流机制和评估周期后加入，把它当成一次有边界的转型。", "不确定性仍在，但你为它建立了观察点。", { tech: 6, influence: 6, energy: -5, delivery: 1 }, ["转型", "学习"]),
      choice("blind-join", "立即加入，热门方向一定代表更好的未来，不必问太多细节。", "你获得了新入口，也把选择权交给了热度。", { tech: 4, energy: -7, influence: 1, delivery: -2 }, ["机会", "跟随"]),
      choice("stay-expert", "拒绝调动，继续深耕当前领域并制定自己的能力升级路线。", "你保留了确定性，也主动承担方向变化的风险。", { tech: 7, delivery: 3, influence: -1, energy: 2 }, ["深耕", "稳定"])
    ]),
  event("crossroad-black-soil", "crossroad", "black-soil", "去做不抢镜的黑土地",
    "平台团队邀请你建设公共底座。成果不会直接出现在客户演示里，但会被十几个产品依赖。",
    [
      choice("platform-contract", "加入平台团队，用清晰接口、服务等级和采用率证明公共能力的价值。", "你选择让别人的成功变得更容易。", { tech: 8, influence: 8, delivery: 3, energy: -5 }, ["平台", "长期"]),
      choice("visible-product", "留在前台产品，只做客户能直接看见的能力，避免价值难衡量。", "你的成果更可见，公共问题仍由别人承担。", { delivery: 7, influence: 2, tech: 1, energy: -2 }, ["产品", "可见"]),
      choice("platform-everything", "加入后立即推动所有团队统一迁移，不接受任何历史差异。", "平台雄心很大，采用率在阻力中缓慢爬行。", { tech: 5, influence: -6, delivery: -3, energy: -6 }, ["平台", "强推"])
    ]),
  event("crossroad-manager", "crossroad", "pdt", "技术骨干要不要带团队",
    "你被问是否愿意承担团队管理。新角色会减少编码时间，增加招聘、反馈和跨职能决策。",
    [
      choice("trial-manager", "先用明确周期代理管理，保留技术锚点，并向团队公开评估标准。", "你把身份变化做成了一次可回顾的实验。", { influence: 9, delivery: 4, tech: -1, energy: -5 }, ["管理", "试验"]),
      choice("accept-title", "直接接受，职位提升本身足以证明你会处理新的工作。", "头衔先到了，管理能力开始边交付边学习。", { influence: 4, delivery: -2, energy: -7, tech: -3 }, ["晋升", "适应"]),
      choice("pure-tech", "明确拒绝管理，争取专家路线和对等影响机制。", "你没有把晋升误解成唯一方向。", { tech: 8, influence: 2, energy: 2 }, ["专家", "边界"])
    ]),
  event("crossroad-dste", "crossroad", "dste", "战略拆到你头上时只剩一句口号",
    "年度方向是“提升产品竞争力”，但团队不知道本季度到底应该停止什么、完成什么。",
    [
      choice("strategy-map", "把方向拆成可验证假设、关键举措、资源和停止项，再请上级确认取舍。", "战略第一次影响了日常排期。", { influence: 8, delivery: 7, energy: -3 }, ["战略", "执行"]),
      choice("invent-kpi", "自行设计一组容易达成的指标，年底用完成率证明团队贡献。", "指标有了，战略仍然停在墙上。", { delivery: -3, influence: -2, energy: -2 }, ["指标", "形式"]),
      choice("wait-detail", "等待更高层给出完整任务清单，避免错误理解战略。", "你避免了主动犯错，也错过了影响方向的窗口。", { delivery: -5, influence: -4, energy: 2 }, ["等待", "被动"])
    ]),
  event("crossroad-grain-soil", "crossroad", "soil-fertility", "粮食和土地肥力只能选一个吗",
    "短期项目缺人，平台治理也已经拖延。你只有一支团队，两个方向都声称不能再等。",
    [
      choice("portfolio-balance", "按风险和收益保留明确比例，并给平台工作设置可度量的采用与降本目标。", "短期交付和长期能力第一次进入同一张组合表。", { delivery: 6, tech: 6, influence: 7, energy: -5 }, ["组合", "平衡"]),
      choice("all-grain", "全部投入短期项目，等业务稳定后再治理平台。", "粮食增加了，土壤问题继续滚存。", { delivery: 9, tech: -6, energy: -7 }, ["短期", "交付"]),
      choice("all-soil", "暂停所有业务需求，先把平台一次性建设到理想状态。", "长期能力快速增长，客户窗口也快速关闭。", { tech: 9, delivery: -8, influence: -3, energy: -6 }, ["长期", "理想"])
    ]),
  event("crossroad-red-blue", "crossroad", "red-blue", "这次轮到你当蓝军",
    "组织邀请你挑战一个已经获得广泛支持的新方案。提出反对意见可能影响关系，不提则失去蓝军价值。",
    [
      choice("attack-assumption", "只攻击关键假设，用可复现实验和替代方案支撑质疑。", "讨论有些刺耳，但方案因此多了一层保护。", { tech: 8, influence: 6, energy: -4 }, ["蓝军", "证据"]),
      choice("soft-approve", "象征性问两个问题后表示支持，避免成为推进阻力。", "会议很顺利，蓝军席位只剩颜色。", { delivery: 2, influence: -2, tech: -4, energy: 1 }, ["关系", "形式"]),
      choice("total-opposition", "从目标到细节全部否定，证明自己比方案团队看得更深。", "你制造了足够多的反对，却没有提高可决策性。", { tech: 2, influence: -7, energy: -5, delivery: -3 }, ["对抗", "否定"])
    ]),
  event("crossroad-benefit", "crossroad", "benefit-one-hole", "公共贡献算在谁的成绩里",
    "两个团队共同完成关键平台能力，但年度汇报只能由一个团队作为主要成果展示。",
    [
      choice("shared-credit", "用贡献记录拆清角色，让主要成果和公共贡献都能被看见。", "价值没有被强行切成零和游戏。", { influence: 9, delivery: 4, energy: -2 }, ["激励", "公平"]),
      choice("claim-first", "先把成果写进自己的汇报，合作方如果在意可以之后再沟通。", "你的材料更亮了，下一次协作更暗了。", { influence: -7, delivery: 2, energy: -2 }, ["竞争", "短视"]),
      choice("give-all", "完全让给合作团队，自己不再解释贡献，避免关系受损。", "冲突消失了，你的团队也开始怀疑公共投入是否值得。", { influence: -3, energy: -4, delivery: 1 }, ["退让", "沉默"])
    ]),
  event("crossroad-pbc-stretch", "crossroad", "pbc", "年底目标突然再拉伸",
    "季度过半，组织希望在不增加资源的情况下再加入一个高优目标，并要求当天确认。",
    [
      choice("tradeoff-list", "列出现有承诺、增量价值和必须停止的事项，请决策者明确取舍。", "你没有拒绝变化，也没有假装资源无限。", { influence: 8, delivery: 6, energy: -3 }, ["目标", "取舍"]),
      choice("say-yes", "立即承诺，之后靠团队创造力和额外投入解决资源问题。", "态度获得认可，团队的日历失去空白。", { delivery: 3, influence: 2, energy: -14, tech: -2 }, ["承诺", "透支"]),
      choice("say-no", "直接拒绝所有新增目标，不提供任何替代方案。", "边界很清楚，协商空间也一起消失。", { energy: 5, influence: -5, delivery: -3 }, ["边界", "僵硬"])
    ]),
  event("crossroad-entropy", "crossroad", "entropy-reduction", "你继承了十二个固定例会",
    "新岗位附带十二个周会。有人说每个会都有历史原因，但没有人能说明最近一次产生了什么决定。",
    [
      choice("meeting-audit", "逐个确认服务的决策、输入和输出；能异步的异步，无产出的暂停两周观察。", "日历变轻了，真正需要同步的会议反而更聚焦。", { influence: 8, energy: 9, delivery: 5 }, ["熵减", "会议"]),
      choice("attend-all", "先完整参加三个月，充分尊重历史，再考虑任何调整。", "你了解了全部历史，也失去了大量未来。", { energy: -12, delivery: -3, influence: 1 }, ["历史", "消耗"]),
      choice("cancel-all", "上任第一天全部取消，用强动作证明组织要改变。", "日历瞬间清爽，关键协作也出现了断层。", { energy: 6, influence: -6, delivery: -4 }, ["改革", "激进"])
    ]),
  event("crossroad-lever", "crossroad", "lever", "“需要一个有力抓手”",
    "管理层要求提升研发效率。提案里充满平台、AI、流程和文化，却没有负责人、基线或验收方式。",
    [
      choice("one-bottleneck", "选一个高频瓶颈，设基线、负责人和四周实验，再决定是否扩大。", "抽象口号终于抓住了一个真实问题。", { delivery: 7, tech: 5, influence: 7, energy: -3 }, ["效率", "实验"]),
      choice("big-platform", "立项建设统一效能平台，先覆盖所有团队，再从数据中寻找问题。", "平台蓝图很完整，用户问题仍在等待被定义。", { tech: 4, delivery: -5, energy: -7, influence: -2 }, ["平台", "宏大"]),
      choice("ai-everywhere", "要求每个流程都接入 AI，并用接入数量作为效率提升指标。", "接入数量快速增长，效率提升仍然需要另一个指标解释。", { tech: 2, delivery: -6, influence: -4, energy: -4 }, ["AI", "指标"])
    ]),
  event("crossroad-pace", "crossroad", "striver-oriented", "长期奋斗不等于长期透支",
    "你连续两个季度高强度交付，成绩很好，但注意力和耐心都明显下降。下一场攻坚又要开始。",
    [
      choice("sustainable-plan", "公开团队负荷，安排轮换和恢复，把可持续交付写进版本计划。", "你承认人也是系统容量的一部分。", { energy: 14, influence: 7, delivery: 3, tech: 1 }, ["长期", "恢复"]),
      choice("one-last-push", "告诉自己再拼最后一次，等这个版本结束就一定休息。", "版本继续前进，“最后一次”也变得越来越熟悉。", { delivery: 7, energy: -16, influence: -2 }, ["冲刺", "燃尽"]),
      choice("silent-withdraw", "不解释状态，逐渐减少参与，只完成最容易被看见的任务。", "能量暂时止跌，团队却无法理解你的变化。", { energy: 6, delivery: -5, influence: -6 }, ["自保", "失联"])
    ]),
  event("performance-b-result", "performance", "b-rating", "名单上出现了一个 B",
    "你完成了核心版本和两次救火，直接主管此前反馈良好，绩效沟通时却只给出一句“综合评议是 B”。这是虚构情景，不代表真实制度。",
    [
      choice("ask-rating-evidence", "带着 PBC、交付结果和历次反馈逐项核对，请对方说明评价标准、差距、实际影响与复核渠道。", "对话从抽象结论回到了可以核验的事实，你也得到了一份后续行动清单。", { influence: 8, delivery: 5, energy: -3 }, ["证据", "复核"]),
      choice("accept-and-overwork", "先接受结果，再把下周期承诺全部加码，试图用更多无边界投入证明自己。", "你获得了“态度不错”的评价，却把一个模糊结论变成了长期透支。", { delivery: 4, energy: -14, influence: -2 }, ["加码", "透支"]),
      choice("rank-gossip", "立即在同事群里猜测谁拿了更高档，并用传闻拼出一份秘密排名。", "焦虑迅速扩散，真正决定评价的事实仍然没有变清楚。", { influence: -8, energy: -7, delivery: -2 }, ["传闻", "内耗"])
    ]),
  event("performance-b-front", "performance", "b-front", "“沟通一下，你是 B 里靠前的”",
    "你追问 B 的依据，主管安慰说“你是 B 里靠前的，和更高档差距很小”，但没有说明靠前如何衡量、结果有什么区别。",
    [
      choice("define-front", "平静追问“靠前”的可验证含义，请确认档位影响、关键差距、改进目标和下次检查时间。", "安慰话术被拆成了四个待回答的问题，沟通终于有了下一步。", { influence: 9, delivery: 4, energy: -2 }, ["澄清", "边界"]),
      choice("take-comfort", "把“靠前”当成隐形认可，不再追问，只期待下一次自然轮到自己。", "情绪暂时得到缓冲，但你依然不知道该保持什么、改变什么。", { energy: 2, influence: -4, delivery: -2 }, ["安慰", "模糊"]),
      choice("demand-peer-list", "要求主管当场公开所有同事的档位与排名，用别人的结果证明自己的位置。", "你把合理的证据请求变成了隐私对抗，团队信任随之下降。", { influence: -11, energy: -5, delivery: -1 }, ["排名", "对抗"])
    ]),
  event("performance-at-review", "performance", "at-review", "直接评价在评议后变了",
    "主管说自己原本给了更高评价，但经过所谓 AT 评议后被调整；他无法现场说明是谁、基于什么新事实作出的改变。",
    [
      choice("trace-review", "请主管确认直接评价、评议后的变化、采用的新证据与正式复核入口，并在会后发送事实纪要。", "你没有追逐看不见的人，而是开始建立一条可复核的决策链。", { influence: 8, delivery: 3, energy: -4 }, ["决策链", "留痕"]),
      choice("attack-panel", "把未露面的评议者都视为敌人，在跨部门会议上逐一质疑他们的动机。", "火力很足，证据很少，你与多个协作方同时进入防御状态。", { influence: -12, energy: -8, tech: -1 }, ["归因", "失控"]),
      choice("give-up-review", "认定所有评议都无法改变，从此不再记录目标、反馈和交付贡献。", "你省下了整理材料的时间，也失去了下一次讲清事实的基础。", { energy: 3, delivery: -5, influence: -6 }, ["放弃", "失语"])
    ]),
  event("performance-output", "performance", "rd-output", "突然被告知“输出非研发”",
    "你被通知下月转去一个非研发岗位，理由是“组织需要”和“锻炼视野”；新职责、考核方式、周期与旧项目移交都没有写清。",
    [
      choice("request-role-terms", "先索取岗位职责、汇报关系、薪酬地点、考核、过渡期限和回流条件，再基于书面信息决定。", "“组织需要”被翻译成了一张可以判断风险与机会的岗位清单。", { influence: 10, energy: -3, delivery: 2 }, ["转岗", "书面"]),
      choice("loyalty-transfer", "当天答应全部安排，主动表示任何岗位都能干，旧项目也继续由自己兜底。", "态度没有争议，工作边界却从此同时属于两个岗位。", { delivery: 5, influence: 2, energy: -16 }, ["服从", "双份工作"]),
      choice("public-refusal", "在大群里直接定性这是针对自己，拒绝交接并要求立即撤回全部安排。", "你的不满被所有人看见，协商岗位条件的空间反而迅速收窄。", { influence: -10, delivery: -6, energy: -5 }, ["公开冲突", "拒绝"])
    ]),
  event("performance-shadow-rd", "performance", "person-role-fit", "人已转岗，代码还归你",
    "你名义上已输出非研发，但原团队仍每天找你修问题，新岗位又按完整工作量排任务，两边都说“先帮忙顶一下”。",
    [
      choice("responsibility-matrix", "召集两边负责人确认唯一优先级、移交清单、支持时段和结束日期，并把责任矩阵同步给相关人。", "隐形的双份工作第一次变成了可被管理的容量冲突。", { influence: 10, delivery: 6, energy: 3 }, ["责任", "移交"]),
      choice("do-both", "白天完成新岗位任务，晚上继续维护旧系统，等大家自然找到替代者。", "两个团队都觉得过渡顺利，只有你的能量曲线知道真实成本。", { delivery: 8, energy: -18, tech: 2 }, ["兜底", "燃尽"]),
      choice("drop-old-now", "不做任何交接，立即停止回应原团队，认为岗位变化已经自动结束旧责任。", "你的边界很快生效，生产问题和关系成本也同时爆发。", { energy: 7, delivery: -10, influence: -7 }, ["切断", "失交"])
    ]),
  event("performance-scold-meeting", "performance", "public-scolding", "复盘会突然变成挨骂大会",
    "客户投诉后的复盘会上，领导没有讨论故障链路，而是提高音量说团队“没有血性、都是废物”，并要求每个人现场表态。",
    [
      choice("return-to-facts", "等对方停顿后确认客户影响、故障事实和恢复负责人，建议把个人反馈另约一对一沟通。", "会议短暂安静，至少有一部分注意力重新回到了客户和补救动作。", { delivery: 8, influence: 9, energy: -6 }, ["事实", "降温"]),
      choice("document-later", "先不在高压现场争辩，完整记录时间、原话、见证人与任务要求，会后走正式反馈渠道。", "你没有让现场继续升级，也为后续判断是否持续越界保留了证据。", { influence: 5, energy: -4, delivery: 3 }, ["留痕", "渠道"]),
      choice("shout-back", "当场用同样音量反骂领导无能，把历次错误全部翻出来公开结算。", "压抑得到瞬间释放，客户问题和组织冲突却同时升级。", { energy: 2, influence: -14, delivery: -8 }, ["反击", "升级"])
    ]),
  event("performance-personal-attack", "performance", "performance-talk", "反馈只剩“你这个人不行”",
    "一对一沟通里，主管反复说你“格局不够、狼性不足”，却没有指出对应行为、业务后果或可执行的改变。",
    [
      choice("behavior-impact", "请对方给出具体行为、发生场景、造成影响和期待动作，并逐条确认你能控制的改进项。", "人格标签被迫落回了行为反馈，其中一部分终于可以行动。", { influence: 8, delivery: 4, energy: -3 }, ["反馈", "具体"]),
      choice("internalize-label", "把所有标签都当作能力真相，取消休息并全面模仿主管的工作方式。", "你开始努力成为另一个人，能量和判断力却一起下降。", { delivery: 2, tech: -3, energy: -15 }, ["内化", "迷失"]),
      choice("counter-label", "拒绝讨论任何具体问题，直接给主管贴上更难听的标签作为回应。", "双方完成了标签交换，没有产生一条可以验证的改进。", { influence: -12, energy: -6, delivery: -3 }, ["人身化", "僵局"])
    ]),
  event("performance-appeal", "performance", "appeal-trace", "申诉不是把所有文件打包带走",
    "你决定复核绩效，但材料散落在聊天、周报和交付系统里；其中还混有客户数据、源代码与同事隐私。",
    [
      choice("build-evidence-pack", "按目标、交付、反馈和时间线整理最小必要证据，去除敏感信息后通过正式渠道提交。", "你的材料既能支持主张，也没有把一次申诉变成新的合规风险。", { influence: 9, delivery: 5, tech: 3, energy: -5 }, ["申诉", "合规"]),
      choice("copy-everything", "把客户数据、代码和全部群聊都复制到私人设备，认为材料越多越有说服力。", "证据数量增加了，你也制造了远大于绩效争议的安全问题。", { tech: -12, influence: -10, energy: -6 }, ["泄露风险", "失控"]),
      choice("angry-resign", "不再整理事实，当晚情绪化辞职，并在公开平台点名所有相关同事。", "你迅速离开了争议，也把职业关系、隐私与退路一起推上了赌桌。", { energy: -7, influence: -14, delivery: -5 }, ["冲动", "退路"])
    ]),
  event("performance-witness", "performance", "public-scolding", "被骂的不是你",
    "同事在全员会上因一个尚未查清的问题被连续羞辱，其他人低头看屏幕。你掌握的日志显示责任并不在他一个人。",
    [
      choice("offer-facts", "在不激化人身冲突的前提下补充日志事实，建议先确认故障链路和共同改进项。", "同事不再独自承担全部叙事，讨论也多了一份技术证据。", { tech: 8, influence: 9, energy: -5 }, ["同伴", "证据"]),
      choice("support-after", "现场避免打断，散会后关心同事状态，帮助整理事实并陪同使用正式反馈渠道。", "你没能改变刚才的会议，却让对方不必独自处理后果。", { influence: 7, energy: -3, delivery: 2 }, ["支持", "陪伴"]),
      choice("join-ridicule", "跟着批评几句以证明自己站队正确，并悄悄删掉可能改变结论的日志。", "你暂时远离了火力，也亲手损坏了团队的事实基础。", { influence: -13, tech: -8, energy: -2 }, ["站队", "失真"])
    ]),
  event("performance-stay-transfer-leave", "performance", "person-role-fit", "留下、转岗还是离开",
    "连续的模糊评价、岗位变化和高压沟通让你开始怀疑是否还值得留下，但你尚未盘点现金储备、内部机会和外部选择。",
    [
      choice("timeboxed-options", "设定六周窗口，同时推进事实复核、内部岗位沟通、外部面试和现金规划，再按明确信号决定。", "你没有把去留交给一次情绪，也没有假装环境一定会自行改善。", { energy: 8, influence: 6, tech: 3, delivery: 2 }, ["选择权", "计划"]),
      choice("prove-with-overtime", "暂停所有外部选择，用无限加班证明忠诚，期待下一轮评价自动修复一切。", "短期存在感上升，决定自己未来的能力却继续下降。", { delivery: 6, energy: -18, influence: -3 }, ["证明", "依赖"]),
      choice("leave-no-runway", "第二天直接离开，不做财务准备、交接或下一步安排，先结束痛苦再说。", "压力源被切断了，你也立刻面对现金、关系与职业空窗的新压力。", { energy: 4, delivery: -9, influence: -7 }, ["离开", "无准备"])
    ])
];

const PERSONAS = [
  {
    id: "tr-guardian",
    title: "TR 守门员",
    subtitle: "你愿意让坏消息在上线前发生",
    description: "你重证据、边界和可逆性。你的下一步不是增加更多评审，而是让关键评审更快暴露真正风险。",
    icon: "shield",
    tone: "green"
  },
  {
    id: "frontline-caller",
    title: "一线呼炮手",
    subtitle: "你擅长把现场问题变成可行动的资源请求",
    description: "你看重客户结果和协同速度。继续保持事实板、授权边界和复盘，避免让自己成为永久救火通道。",
    icon: "zap",
    tone: "amber"
  },
  {
    id: "black-soil-builder",
    title: "黑土地耕作者",
    subtitle: "你更愿意建设让别人成功的底座",
    description: "你有明显的平台和技术倾向。别忘了用采用率、可靠性和节省的人时证明那些不抢镜的价值。",
    icon: "code",
    tone: "blue"
  },
  {
    id: "process-translator",
    title: "流程翻译官",
    subtitle: "你能把缩写重新翻译成决定",
    description: "你擅长跨角色对齐目标、依赖和责任。继续警惕会议替代行动，也别把所有拉通工作都揽到自己身上。",
    icon: "users",
    tone: "accent"
  },
  {
    id: "grain-deliverer",
    title: "粮食型研发",
    subtitle: "你对交付结果有强烈嗅觉",
    description: "你能把事情推到终点。下一步要给技术债和团队恢复留下预算，避免今天的粮食透支明天的土地。",
    icon: "route",
    tone: "blue"
  },
  {
    id: "sustainable-striver",
    title: "可持续奋斗者",
    subtitle: "你把恢复力也当成工程指标",
    description: "你会主动管理负荷、退出条件和长期节奏。这不是降低标准，而是在保护持续解决难题的能力。",
    icon: "heart",
    tone: "green"
  },
  {
    id: "e2e-generalist",
    title: "端到端多面手",
    subtitle: "你能同时看见技术、交付、人和组织",
    description: "你的路线较为均衡，适合处理跨边界问题。保持重点，别让“什么都能接”变成“什么都由你接”。",
    icon: "sliders",
    tone: "amber"
  },
  {
    id: "burnout-warning",
    title: "燃尽预警员",
    subtitle: "你完成了很多，但系统正在透支你",
    description: "这不是能力结论，而是负荷提示。减少无边界救火、建立轮换和恢复窗口，比再做一次意志力冲刺更重要。",
    icon: "alert",
    tone: "accent"
  }
];

const SOURCE_SUMMARY = [
  "企业治理与新年公开信：客户、奋斗者、自我批判、主航道、粮食、土地肥力、班长的战争等语境。",
  "华为云公开 IPD 测试指南：IPD、PDT 与 TR1 至 TR6 等研发评审术语。",
  "公开管理与行业资料：PBC、DSTE、LTC、CBB 及常见职场表达，仅作通俗解释。",
  "公开媒体与管理文章：B绩效、B里靠前、AT评议、输出非研发和高压沟通等网络叙事；均不视为官方制度定义或普遍事实。"
];

module.exports = {
  DISCLAIMER,
  EVENTS,
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  PERSONAS,
  SOURCE_SUMMARY,
  STAGES,
  STAT_KEYS,
  STAT_META
};
