const STAT_KEYS = Object.freeze([
  "tech",
  "communication",
  "energy",
  "savings",
  "influence"
]);

const STAT_META = Object.freeze({
  tech: Object.freeze({ label: "技术力", tone: "blue", min: 0, max: 100, initial: 45 }),
  communication: Object.freeze({ label: "沟通力", tone: "green", min: 0, max: 100, initial: 45 }),
  energy: Object.freeze({ label: "精力", tone: "coral", min: 0, max: 100, initial: 65 }),
  savings: Object.freeze({ label: "积蓄", tone: "gold", min: 0, max: 100, initial: 30 }),
  influence: Object.freeze({ label: "影响力", tone: "navy", min: 0, max: 100, initial: 35 })
});

const FLAG_KEYS = Object.freeze([
  "adaptability",
  "architecture",
  "balance",
  "burnout",
  "crisisHandled",
  "customer",
  "documentation",
  "entrepreneurship",
  "highPay",
  "independence",
  "integrity",
  "layoffRisk",
  "leadership",
  "learning",
  "management",
  "mentoring",
  "negotiation",
  "networking",
  "openSource",
  "ownership",
  "politics",
  "product",
  "reliability",
  "remote",
  "reputation",
  "sideProject",
  "teamwork",
  "visibility"
]);

const CONDITION_OPERATORS = Object.freeze(["gte", "lte", "eq", "truthy"]);
const EXPECTED_ENDING_TITLES = Object.freeze([
  "首席架构师",
  "技术负责人",
  "工程经理",
  "独立开发者",
  "创业合伙人",
  "开源之星",
  "远程游牧",
  "生活优先",
  "产品转型",
  "稳健老兵",
  "高薪燃尽",
  "被优化的一天"
]);

function condition(source, key, op, value) {
  return {
    type: source === "stats" ? "stat" : source === "flags" ? "flag" : source,
    key,
    op,
    value
  };
}

function requirements(all = [], any = []) {
  return all.concat(any);
}

function splitFlags(flags) {
  return Object.keys(flags).reduce((result, key) => {
    if (flags[key] === false || flags[key] < 0) result.removeFlags.push(key);
    if (flags[key] === true || flags[key] > 0) result.addFlags.push(key);
    return result;
  }, { addFlags: [], removeFlags: [] });
}

function pending(id, delay, narrative, effects = {}, flags = {}) {
  const flagChanges = splitFlags(flags);
  const result = {
    id,
    delay,
    effects
  };
  if (flagChanges.addFlags.length) result.addFlags = flagChanges.addFlags;
  if (narrative) result.narrative = narrative;
  return result;
}

function choice(id, text, tags, outcome, effects = {}, flags = {}, pendingEffects = [], required) {
  const flagChanges = splitFlags(flags);
  const result = {
    id,
    text,
    tags,
    outcome,
    effects
  };
  if (flagChanges.addFlags.length) result.addFlags = flagChanges.addFlags;
  if (flagChanges.removeFlags.length) result.removeFlags = flagChanges.removeFlags;
  if (pendingEffects.length) result.pendingEffects = pendingEffects;
  if (required) result.requirements = required;
  return result;
}

function event(id, stageId, kind, title, body, rawChoices) {
  return {
    id,
    stageId,
    kind: kind === "fixed" ? "core" : kind,
    title,
    body,
    choices: rawChoices.map((item) => {
      const result = {
        ...item,
        id: `${id}_${item.id}`
      };
      if (item.pendingEffects) {
        result.pendingEffects = item.pendingEffects.map((effect) => ({
          ...effect,
          id: `${id}_${item.id}_${effect.id}`
        }));
      }
      return result;
    })
  };
}

const STAGE_CONTENT = [
  {
    id: "stage_1_entry",
    order: 1,
    title: "第一章：成功混入这一行",
    subtitle: "从简历上的熟练，到工位上的不会",
    poolDrawCount: 2,
    fixed: [
      event(
        "s1_f1_offer",
        "stage_1_entry",
        "fixed",
        "两份 Offer",
        "一家钱多但加班写进空气，另一家钱少一点却愿意带新人。HR 都说这里成长很快，区别只是语速。",
        [
          choice("a", "选钱多的，年轻就是本钱", ["财富", "冒险"], "工资到账很有安全感，凌晨两点的工位也很有安全感。", { savings: 10, energy: -8 }, { highPay: 1, burnout: 1 }),
          choice("b", "选有导师的，先把基本功补上", ["技术", "长期"], "导师给了你一份阅读清单，长度足以证明他很看好你。", { tech: 7, communication: 3, savings: 3 }, { learning: 2, mentoring: 1 }, [
            pending("mentor_return", 5, "早期积累开始回报，你处理陌生问题时明显更稳。", { tech: 5 }, { reliability: 1 })
          ]),
          choice("c", "继续谈，争取薪资和培养都要", ["沟通", "谈判"], "HR 沉默了十秒，然后把你的邮件转给了用人经理。", { communication: 5, savings: 6 }, { negotiation: 2, reputation: 1 })
        ]
      ),
      event(
        "s1_f2_first_bug",
        "stage_1_entry",
        "fixed",
        "第一个线上 Bug",
        "你改了一个看似无害的判断，线上用户替你完成了完整的边界测试。",
        [
          choice("a", "立刻说明情况并请求协助", ["责任", "团队"], "你收获了一次复盘，也收获了群里那个意味深长的“收到”。", { communication: 4, tech: 3, energy: -2 }, { integrity: 2, teamwork: 1, crisisHandled: 1 }),
          choice("b", "先悄悄修好再说", ["技术", "风险"], "问题修好了，但监控记录比你的解释更早到达负责人桌面。", { tech: 4, energy: -4, influence: -2 }, { layoffRisk: 1, reliability: -1 }),
          choice("c", "证明这是历史代码的问题", ["自保", "政治"], "你在版本记录里赢了，但在茶水间里输得很完整。", { communication: -4, energy: 1 }, { politics: 1, teamwork: -2 })
        ]
      ),
      event(
        "s1_f3_review",
        "stage_1_entry",
        "fixed",
        "第一次代码评审",
        "评审意见有 38 条，其中 12 条是同一个空格。你怀疑前辈在测试你的心理素质。",
        [
          choice("a", "逐条理解并修改", ["技术", "耐心"], "你修到第 37 条时，已经能预测第 38 条是什么。", { tech: 6, energy: -3 }, { learning: 1, reliability: 1 }),
          choice("b", "约前辈当面过一遍", ["沟通", "效率"], "十分钟讲清了二十条，也顺便知道了哪些规范只是祖传习惯。", { communication: 6, tech: 3 }, { teamwork: 1, mentoring: 1 }),
          choice("c", "据理力争每一处写法", ["原则", "影响"], "你证明了三处自己是对的，并让这次评审持续到了下班后。", { tech: 3, communication: -3, energy: -3 }, { integrity: 1, reputation: -1 })
        ]
      ),
      event(
        "s1_f4_probation",
        "stage_1_entry",
        "fixed",
        "转正汇报",
        "你需要把三个月的修修补补讲成一条清晰的成长曲线。",
        [
          choice("a", "用数据讲成果，也承认踩过的坑", ["沟通", "可信"], "主管点头的次数比你彩排时预计的多两次。", { communication: 6, influence: 4 }, { visibility: 1, integrity: 1 }),
          choice("b", "做一场技术细节拉满的分享", ["技术", "展示"], "同行听得很开心，业务负责人努力维持着礼貌。", { tech: 5, influence: 2, communication: -1 }, { visibility: 1 }),
          choice("c", "把团队成果都放进去", ["团队", "稳健"], "你没有成为最亮的那个，但大家开始愿意把事情交给你。", { communication: 3, influence: 3 }, { teamwork: 2, reliability: 1 })
        ]
      )
    ],
    pool: [
      event(
        "s1_p1_setup",
        "stage_1_entry",
        "pool",
        "祖传开发环境",
        "入职文档最后更新于三年前，作者头像已经灰了两年。",
        [
          choice("a", "边搭边补文档", ["技术", "公共资产"], "后来者少踩了两个坑，但没人知道你救过他们。", { tech: 3, energy: -2, influence: 2 }, { documentation: 2, ownership: 1 }),
          choice("b", "复制同事机器上的配置", ["效率", "短期"], "十五分钟跑起来，至于为什么能跑，暂时属于商业机密。", { energy: 2 }, { adaptability: 1, documentation: -1 })
        ]
      ),
      event(
        "s1_p2_overtime",
        "stage_1_entry",
        "pool",
        "“自愿”加班",
        "负责人说今晚不强制，只是顺便统计一下还在公司的同学。",
        [
          choice("a", "留下把任务做完", ["投入", "精力"], "你获得了表扬和一份新的紧急任务。", { influence: 3, energy: -7 }, { visibility: 1, burnout: 1 }),
          choice("b", "说明进度，按时下班", ["边界", "生活"], "天没有塌，群消息也只是多了 47 条。", { energy: 5, communication: 2 }, { balance: 2 }),
          choice("c", "先改进流程，再决定是否加班", ["技术", "效率"], "脚本省下了一小时，剩下两小时被会议用掉。", { tech: 4, energy: -2, influence: 2 }, { ownership: 1, balance: 1 })
        ]
      ),
      event(
        "s1_p3_lunch",
        "stage_1_entry",
        "pool",
        "午饭桌上的机会",
        "隔壁组同事邀请你拼桌，话题从食堂排队自然滑向了组织八卦。",
        [
          choice("a", "多听少说，认识几个新同事", ["人际", "信息"], "你记住了名字，也记住了哪些话不能在电梯里说。", { communication: 4, influence: 2 }, { networking: 2, politics: 1 }),
          choice("b", "戴上耳机继续看技术文章", ["技术", "专注"], "文章看完了，隔壁组后来招人的消息你晚知道了一个月。", { tech: 3, energy: 1 }, { learning: 1, networking: -1 })
        ]
      ),
      event(
        "s1_p4_open_source",
        "stage_1_entry",
        "pool",
        "第一个开源 Issue",
        "你发现常用工具有个小问题，修复不难，真正难的是提交模板有十二项。",
        [
          choice("a", "认真提交修复", ["技术", "开源"], "维护者合并了你的修改，还在回复里拼对了你的名字。", { tech: 5, influence: 2, energy: -2 }, { openSource: 2, reputation: 1 }, [
            pending("community_memory", 10, "早年的开源贡献被同行认出，你突然有了圈外信用。", { influence: 5 }, { openSource: 1, networking: 1 })
          ]),
          choice("b", "先记在自己的备忘录里", ["谨慎", "积累"], "备忘录多了一条，世界暂时保持原样。", { tech: 2 }, { sideProject: 1 })
        ]
      ),
      event(
        "s1_p5_alarm",
        "stage_1_entry",
        "pool",
        "深夜告警",
        "值班群突然热闹，你不是负责人，但你刚好知道这块代码。",
        [
          choice("a", "上线协助排查", ["责任", "危机"], "你找到了关键线索，也见证了凌晨四点的办公楼保洁。", { tech: 4, influence: 4, energy: -7 }, { reliability: 2, crisisHandled: 1, burnout: 1 }),
          choice("b", "把线索发群里，保留明天的脑子", ["边界", "协作"], "线索有用，你也没有把自己变成免费常驻值班员。", { communication: 3, energy: 2 }, { teamwork: 1, balance: 1 })
        ]
      ),
      event(
        "s1_p6_salary",
        "stage_1_entry",
        "pool",
        "同届薪资传闻",
        "你听说同期同事比你多两千。消息来源可靠，因为来源就是那位同事。",
        [
          choice("a", "拿成果和主管正式沟通", ["谈判", "财富"], "没有立刻涨薪，但主管第一次知道你会认真谈条件。", { communication: 4, savings: 3 }, { negotiation: 2, visibility: 1 }),
          choice("b", "闷头证明自己值更多", ["技术", "隐忍"], "你多做了两项工作，薪资系统并未感受到震动。", { tech: 3, energy: -4 }, { highPay: -1, burnout: 1 }),
          choice("c", "开始看看外面的机会", ["选择", "市场"], "你更新了简历，招聘软件立刻像老朋友一样问候你。", { communication: 2, influence: 1 }, { adaptability: 2, networking: 1 })
        ]
      )
    ]
  },
  {
    id: "stage_2_growth",
    order: 2,
    title: "第二章：开始独立交付",
    subtitle: "从有人兜底，到你就是那个底",
    poolDrawCount: 2,
    fixed: [
      event(
        "s2_f1_ownership",
        "stage_2_growth",
        "fixed",
        "接手无人维护的模块",
        "模块很重要，文档很简短，原负责人已经在朋友圈拥抱新生活。",
        [
          choice("a", "先补监控和测试，再做需求", ["技术", "稳健"], "需求晚了两天，之后的夜里安静了很多。", { tech: 6, influence: 3, energy: -3 }, { reliability: 2, ownership: 2, documentation: 1 }),
          choice("b", "先按期交付，问题以后再还", ["效率", "债务"], "需求准时上线，技术债也准时开始计算利息。", { influence: 3, energy: -2 }, { visibility: 1, reliability: -1, burnout: 1 }),
          choice("c", "推动团队共同梳理边界", ["沟通", "团队"], "会议开了两次，但模块终于不再只存在于某个人脑子里。", { communication: 5, tech: 3 }, { teamwork: 2, documentation: 2 })
        ]
      ),
      event(
        "s2_f2_deadline",
        "stage_2_growth",
        "fixed",
        "不可能的截止日期",
        "产品说市场窗口只有一周，技术负责人说尽量支持，大家同时看向你。",
        [
          choice("a", "拆范围，保住最小可用版本", ["产品", "沟通"], "上线内容少了一半，真正使用的功能倒是一项没少。", { communication: 6, influence: 4, energy: -3 }, { product: 2, negotiation: 1, ownership: 1 }),
          choice("b", "全接下来，靠加班创造时间", ["投入", "高压"], "项目上线了，你的周末没有。", { influence: 5, savings: 2, energy: -10 }, { highPay: 1, burnout: 2, visibility: 1 }),
          choice("c", "明确拒绝不合理排期", ["原则", "边界"], "空气短暂凝固，但排期第一次被放回桌面讨论。", { communication: 3, influence: -1, energy: 3 }, { integrity: 2, balance: 1 })
        ]
      ),
      event(
        "s2_f3_incident",
        "stage_2_growth",
        "fixed",
        "一次严重故障",
        "核心流程不可用，群里开始出现“谁改的”和“什么时候恢复”两类问题。",
        [
          choice("a", "先恢复服务，再组织无责复盘", ["危机", "领导"], "系统恢复后，大家第一次愿意在复盘里说真话。", { tech: 5, communication: 5, influence: 5, energy: -6 }, { crisisHandled: 2, leadership: 1, reliability: 2 }),
          choice("b", "全程自己修，避免沟通干扰", ["技术", "独立"], "你修得很快，也让团队更加确定这个模块只能找你。", { tech: 6, influence: 2, energy: -8 }, { independence: 1, documentation: -1, burnout: 1 }),
          choice("c", "先找出责任人", ["管理", "风险"], "责任找到了，恢复时间也因此多用了四十分钟。", { communication: -5, influence: -2, energy: -3 }, { politics: 2, teamwork: -2, layoffRisk: 1 })
        ]
      ),
      event(
        "s2_f4_intern",
        "stage_2_growth",
        "fixed",
        "带第一个新人",
        "新人问了一个你入职时也问过的问题。你突然理解了当年前辈的沉默。",
        [
          choice("a", "给任务，也解释上下文", ["带教", "团队"], "新人慢慢能独立，你也第一次学会通过别人完成事情。", { communication: 5, influence: 4, energy: -3 }, { mentoring: 2, leadership: 1, teamwork: 1 }, [
            pending("mentee_growth", 11, "当年带过的新人已经能替你守住一条战线。", { influence: 5, energy: 3 }, { mentoring: 1, leadership: 1 })
          ]),
          choice("b", "把文档发给他，让他先自学", ["效率", "边界"], "新人学会了搜索，也学会了先去问别人。", { energy: 2, tech: 1 }, { documentation: 1, mentoring: -1 }),
          choice("c", "关键任务自己做，给他安排杂活", ["控制", "短期"], "交付很稳，新人的成长曲线则像一条水平线。", { influence: 2, energy: -4 }, { management: 1, teamwork: -1 })
        ]
      )
    ],
    pool: [
      event(
        "s2_p1_docs",
        "stage_2_growth",
        "pool",
        "文档周",
        "主管宣布本周整理知识库。群里一片赞同，然后所有人继续写代码。",
        [
          choice("a", "整理一份真正能用的手册", ["文档", "长期"], "浏览量不高，但每个深夜值班的人都给你点了赞。", { influence: 3, tech: 2, energy: -3 }, { documentation: 2, reliability: 1 }),
          choice("b", "把旧文档换个模板", ["效率", "表面"], "格式统一了，错误信息也整齐地保留了下来。", { influence: 1, energy: 1 }, { visibility: 1, documentation: -1 })
        ]
      ),
      event(
        "s2_p2_cross_team",
        "stage_2_growth",
        "pool",
        "跨团队接口",
        "两个团队对同一个字段有三种理解，会议纪要则有第四种。",
        [
          choice("a", "画清流程并确认责任边界", ["沟通", "架构"], "争议没有消失，但终于能指向同一张图争。", { communication: 5, tech: 3, influence: 2 }, { architecture: 1, documentation: 1, teamwork: 1 }),
          choice("b", "先兼容所有情况", ["技术", "妥协"], "代码非常包容，维护者不一定。", { tech: 3, energy: -4 }, { reliability: -1, burnout: 1 }),
          choice("c", "请双方负责人拍板", ["升级", "政治"], "决策很快，关系温度下降得也很快。", { influence: 2, communication: -2 }, { politics: 1 })
        ]
      ),
      event(
        "s2_p3_refactor",
        "stage_2_growth",
        "pool",
        "重构冲动",
        "一段代码每次看都不顺眼，但它稳定运行了五年，具有某种文物价值。",
        [
          choice("a", "补测试后渐进重构", ["技术", "稳健"], "改动不戏剧化，却让后来需求少绕了很多路。", { tech: 6, energy: -4, influence: 2 }, { architecture: 1, reliability: 2 }),
          choice("b", "忍住，先解决用户问题", ["产品", "取舍"], "代码依旧难看，但用户终于不用重复刷新。", { communication: 2, influence: 3 }, { product: 1, customer: 1 }),
          choice("c", "一口气重写", ["技术", "冒险"], "新版本很优雅，迁移周很漫长。", { tech: 7, energy: -8 }, { architecture: 2, reliability: -1 })
        ]
      ),
      event(
        "s2_p4_conference",
        "stage_2_growth",
        "pool",
        "技术大会名额",
        "团队有一个参会名额，主管问谁愿意回来做内部分享。",
        [
          choice("a", "报名，并认真准备分享", ["学习", "影响"], "你带回来的不只有周边，还有几项能落地的改进。", { tech: 4, communication: 4, influence: 3 }, { learning: 2, visibility: 1, networking: 1 }),
          choice("b", "把机会让给更需要的人", ["团队", "低调"], "同事很感谢，你则在群里看完了照片直播。", { communication: 2, energy: 1 }, { teamwork: 1 }),
          choice("c", "报名，回来只发资料链接", ["福利", "省力"], "资料链接很完整，点击人数是二。", { energy: 3, influence: -1 }, { reputation: -1 })
        ]
      ),
      event(
        "s2_p5_side_project",
        "stage_2_growth",
        "pool",
        "周末小项目",
        "你想到一个工具，可能有人愿意付钱，也可能只有你愿意打开。",
        [
          choice("a", "做出最小版本并发布", ["独立", "产品"], "用户只有十几个，其中三个不是你的朋友。", { tech: 4, savings: 2, energy: -5, influence: 2 }, { sideProject: 2, independence: 1, product: 1 }, [
            pending("small_product", 16, "多年前的小工具仍有人使用，它成为你选择新路线的底气。", { savings: 5, influence: 4 }, { sideProject: 1, independence: 1 })
          ]),
          choice("b", "把想法记好，先休息", ["生活", "克制"], "需求文档写了标题，你睡了一个完整周末。", { energy: 6 }, { balance: 2 }),
          choice("c", "拉同事一起做", ["团队", "创业"], "第一次会议讨论了名字、分工，以及要不要再开一次会。", { communication: 3, energy: -3 }, { entrepreneurship: 1, networking: 1 })
        ]
      ),
      event(
        "s2_p6_one_on_one",
        "stage_2_growth",
        "pool",
        "一对一谈话",
        "主管问你未来想成为什么样的人。这道题没有标准答案，但会影响下一次分工。",
        [
          choice("a", "明确想走技术深度", ["技术", "路线"], "你拿到更难的问题，也拿到更多难以估时的问题。", { tech: 4, influence: 2 }, { architecture: 1, learning: 1 }),
          choice("b", "想尝试带项目和带人", ["管理", "路线"], "主管开始让你主持会议，会议也开始主持你。", { communication: 4, influence: 3 }, { leadership: 1, management: 1 }),
          choice("c", "先探索产品与业务", ["产品", "路线"], "你被拉进需求讨论，终于知道那些奇怪字段从何而来。", { communication: 3, influence: 2 }, { product: 2, customer: 1 })
        ]
      )
    ]
  },
  {
    id: "stage_3_senior",
    order: 3,
    title: "第三章：独当一面",
    subtitle: "你的意见开始值钱，也开始需要负责",
    poolDrawCount: 2,
    fixed: [
      event(
        "s3_f1_architecture",
        "stage_3_senior",
        "fixed",
        "架构方案之争",
        "旧方案保守可靠，新方案扩展性更好。两边都带着图，图上的箭头都很自信。",
        [
          choice("a", "用数据做小规模验证", ["架构", "验证"], "原型没有结束争论，但把争论从信仰拉回了事实。", { tech: 6, communication: 4, energy: -4, influence: 3 }, { architecture: 2, reliability: 1 }),
          choice("b", "选择成熟方案，优先交付", ["稳健", "业务"], "系统按时上线，未来的扩展问题获得了未来再说的资格。", { influence: 4, energy: 1 }, { reliability: 2, product: 1 }),
          choice("c", "推动新方案，承担迁移责任", ["架构", "冒险"], "你赢得了技术空间，也签收了未来半年的迁移工作。", { tech: 7, influence: 5, energy: -7 }, { architecture: 3, ownership: 2, burnout: 1 })
        ]
      ),
      event(
        "s3_f2_project_lead",
        "stage_3_senior",
        "fixed",
        "第一次负责完整项目",
        "排期、风险、依赖和情绪都归你管理，只有时间不归你管理。",
        [
          choice("a", "透明拆解风险，持续同步", ["领导", "沟通"], "坏消息来得早了一点，于是最后没有变成灾难。", { communication: 6, influence: 6, energy: -5 }, { leadership: 2, management: 1, reliability: 1 }),
          choice("b", "亲自抓住所有关键任务", ["控制", "技术"], "质量很高，你也成了项目里最昂贵的单点故障。", { tech: 5, influence: 3, energy: -10 }, { ownership: 1, burnout: 2, teamwork: -1 }),
          choice("c", "充分授权，让成员自己负责", ["团队", "成长"], "有人踩坑，有人长大，你学会了不在每个提交里留下指纹。", { communication: 4, influence: 5, energy: -2 }, { leadership: 2, mentoring: 1, teamwork: 2 })
        ]
      ),
      event(
        "s3_f3_review",
        "stage_3_senior",
        "fixed",
        "绩效校准",
        "你做了不少事，但会上最容易被记住的是那些能在三十秒内讲完的事。",
        [
          choice("a", "准备数据和影响范围", ["展示", "谈判"], "你没有夸大，只是终于不再替成果保持沉默。", { communication: 5, influence: 6, savings: 5 }, { visibility: 2, negotiation: 1, highPay: 1 }),
          choice("b", "相信主管会看见", ["信任", "低调"], "主管确实看见了一部分，另一部分被更响亮的人看见了。", { tech: 2, influence: -2 }, { reliability: 1, visibility: -1 }),
          choice("c", "公开质疑校准规则", ["原则", "风险"], "规则没有立刻改变，但大家开始在私下引用你的问题。", { communication: 2, influence: 2, energy: -3 }, { integrity: 2, politics: 1 })
        ]
      ),
      event(
        "s3_f4_conflict",
        "stage_3_senior",
        "fixed",
        "核心同事冲突",
        "两位主力互相拒绝评审，项目群逐渐变成礼貌用语竞技场。",
        [
          choice("a", "分别沟通，再对齐共同目标", ["沟通", "领导"], "没人承认自己让步，但第二天评审恢复了。", { communication: 7, influence: 5, energy: -4 }, { leadership: 2, teamwork: 2, management: 1 }),
          choice("b", "用技术标准直接裁决", ["技术", "效率"], "问题结束得很快，情绪只是转入了后台运行。", { tech: 4, influence: 2, communication: -2 }, { architecture: 1, teamwork: -1 }),
          choice("c", "交给主管处理", ["边界", "升级"], "你省下了精力，也错过了一次建立团队信任的机会。", { energy: 3, influence: -2 }, { management: -1 })
        ]
      )
    ],
    pool: [
      event(
        "s3_p1_debt",
        "stage_3_senior",
        "pool",
        "技术债清单",
        "你列出的债务足够排满两个季度，业务给出的窗口是两个下午。",
        [
          choice("a", "按风险排序，逐项偿还", ["架构", "稳健"], "列表依然很长，但最可能爆炸的几项已经拆除引信。", { tech: 5, influence: 3, energy: -3 }, { architecture: 1, reliability: 2 }),
          choice("b", "争取专项治理周期", ["沟通", "影响"], "你用事故成本换来了时间，这大概也是一种预算语言。", { communication: 5, influence: 4 }, { negotiation: 1, ownership: 1 }),
          choice("c", "等需求碰到再顺手改", ["现实", "效率"], "短期进度很好看，债务开始学习复利。", { energy: 2, influence: 2 }, { reliability: -1, burnout: 1 })
        ]
      ),
      event(
        "s3_p2_metric",
        "stage_3_senior",
        "pool",
        "一个难看的业务指标",
        "功能按需求完成，用户却不买账。产品问技术还能做什么。",
        [
          choice("a", "一起访谈用户和分析路径", ["产品", "用户"], "你发现真正的问题不在接口延迟，而在用户根本找不到入口。", { communication: 5, influence: 4, tech: 2 }, { product: 2, customer: 2 }),
          choice("b", "继续优化性能", ["技术", "专注"], "页面快了 80 毫秒，转化率保持了庄严的稳定。", { tech: 5, influence: -1 }, { architecture: 1 }),
          choice("c", "说明指标属于产品职责", ["边界", "风险"], "职责边界更清晰了，合作空间也更清晰地缩小了。", { energy: 2, communication: -3 }, { teamwork: -1, product: -1 })
        ]
      ),
      event(
        "s3_p3_interview",
        "stage_3_senior",
        "pool",
        "第一次面试别人",
        "候选人紧张地解释项目，你也紧张地假装自己对每个问题都有判断标准。",
        [
          choice("a", "围绕真实问题深入讨论", ["人才", "沟通"], "你们聊出了能力边界，也没有让面试变成猜谜节目。", { communication: 5, influence: 3 }, { mentoring: 1, management: 1, reputation: 1 }),
          choice("b", "按题库严格执行", ["标准", "效率"], "评分表填得很满，候选人的真实工作方式仍是未知。", { tech: 2, energy: 1 }, { management: 1 }),
          choice("c", "挑战最难的问题看抗压", ["压力", "筛选"], "候选人记住了这家公司，原因不一定能写进招聘宣传。", { influence: -2, communication: -3 }, { reputation: -2, politics: 1 })
        ]
      ),
      event(
        "s3_p4_oncall",
        "stage_3_senior",
        "pool",
        "值班制度改革",
        "当前值班靠热心人和未静音的手机维持，热心人快用完了。",
        [
          choice("a", "推动轮值、补偿和升级机制", ["制度", "领导"], "告警没有减少，但再也不是同几个人失眠。", { communication: 5, influence: 5, energy: -3 }, { management: 2, balance: 1, reliability: 1 }),
          choice("b", "继续自己多扛一点", ["责任", "燃烧"], "系统很稳定，你的睡眠像不稳定网络一样断续。", { influence: 3, energy: -8 }, { reliability: 2, burnout: 2 }),
          choice("c", "做自动化降噪", ["技术", "效率"], "真正的告警终于能被听见，代价是你看完了所有历史告警。", { tech: 6, energy: -4, influence: 3 }, { architecture: 1, ownership: 1 })
        ]
      ),
      event(
        "s3_p5_client",
        "stage_3_senior",
        "pool",
        "客户现场",
        "销售承诺了一个系统目前做不到的能力，并用眼神邀请你参与奇迹。",
        [
          choice("a", "当场澄清边界并给替代方案", ["客户", "诚信"], "客户没有鼓掌，但接受了一个真正能交付的版本。", { communication: 6, influence: 3 }, { customer: 2, integrity: 2, negotiation: 1 }),
          choice("b", "先答应，回去想办法", ["业绩", "高压"], "合同推进了，研发计划从此拥有了一个秘密地雷。", { savings: 4, influence: 4, energy: -5 }, { highPay: 1, burnout: 1, integrity: -1 }),
          choice("c", "让销售解释技术细节", ["自保", "政治"], "会议短暂安静，之后你收到了一个措辞温和的内部消息。", { communication: -3, influence: -2 }, { politics: 2, teamwork: -1 })
        ]
      ),
      event(
        "s3_p6_sharing",
        "stage_3_senior",
        "pool",
        "内部技术分享",
        "你可以讲一个真实踩坑，也可以讲一套看起来更高级的方法论。",
        [
          choice("a", "讲失败、过程和可复用经验", ["分享", "可信"], "提问很多，因为大家终于听到了自己也会遇到的问题。", { communication: 5, influence: 5 }, { documentation: 1, mentoring: 1, reputation: 2 }),
          choice("b", "讲最新概念和漂亮架构图", ["展示", "趋势"], "截图在群里传播很广，落地计划暂时没有出现。", { influence: 4, tech: 2 }, { visibility: 2 }),
          choice("c", "拒绝分享，继续赶项目", ["交付", "低调"], "需求推进了一点，你的经验继续作为个人资产锁在脑中。", { tech: 2, energy: -2 }, { documentation: -1, visibility: -1 })
        ]
      )
    ]
  },
  {
    id: "stage_4_core",
    order: 4,
    title: "第四章：成为核心骨干",
    subtitle: "组织需要你的判断，也开始消耗你的判断",
    poolDrawCount: 2,
    fixed: [
      event(
        "s4_f1_core_system",
        "stage_4_core",
        "fixed",
        "核心系统换代",
        "系统已经支撑公司多年，也积累了足以独立成公司的复杂度。",
        [
          choice("a", "分阶段替换，设置双重验证", ["架构", "稳健"], "迁移不够英雄主义，但每一步都能退回去。", { tech: 7, influence: 6, energy: -6 }, { architecture: 3, reliability: 2, ownership: 1 }),
          choice("b", "集中资源彻底重写", ["架构", "冒险"], "新世界看起来很美，直到第一批历史数据来敲门。", { tech: 8, influence: 5, energy: -10 }, { architecture: 3, burnout: 2, layoffRisk: 1 }),
          choice("c", "维持现状，优先商业目标", ["产品", "现实"], "季度目标完成了，系统继续用自己的方式提醒你它还在。", { savings: 4, influence: 3, energy: 1 }, { product: 1, reliability: -1 })
        ]
      ),
      event(
        "s4_f2_mentor",
        "stage_4_core",
        "fixed",
        "培养接班人",
        "主管希望你把关键能力复制出去。你发现复制人比复制代码难很多。",
        [
          choice("a", "给授权、反馈和犯错空间", ["带教", "领导"], "对方成长得不完全像你，这反而证明培养成功了。", { communication: 6, influence: 6, energy: -4 }, { mentoring: 3, leadership: 2 }),
          choice("b", "整理完整规范和检查表", ["文档", "标准"], "流程变得稳定，但面对新问题时大家仍习惯等你拍板。", { tech: 3, influence: 4 }, { documentation: 2, management: 1 }),
          choice("c", "关键事情继续自己掌握", ["控制", "安全"], "短期没有意外，长期你仍然无法真正离开。", { influence: 2, energy: -6 }, { burnout: 2, teamwork: -1 })
        ]
      ),
      event(
        "s4_f3_reorg",
        "stage_4_core",
        "fixed",
        "组织调整",
        "一封全员邮件宣布组织升级。你的项目、汇报线和座位都可能获得新名字。",
        [
          choice("a", "主动了解目标并帮助团队过渡", ["适应", "领导"], "你没有预测对所有变化，但让团队少了一些无谓猜测。", { communication: 6, influence: 5, energy: -3 }, { adaptability: 2, leadership: 1, politics: 1 }),
          choice("b", "专注技术，等尘埃落定", ["技术", "稳健"], "代码没有重组，资源却悄悄完成了重组。", { tech: 3, energy: 2, influence: -2 }, { adaptability: -1 }),
          choice("c", "提前经营新汇报线", ["政治", "机会"], "你进入了更多关键会议，也开始需要解释为什么进入这些会议。", { influence: 6, communication: 3 }, { politics: 3, visibility: 1, integrity: -1 })
        ]
      ),
      event(
        "s4_f4_promotion",
        "stage_4_core",
        "fixed",
        "晋升后的选择",
        "你可以继续做技术专家，也可以接手一个小团队。两条路都承诺更大影响力和更多会议。",
        [
          choice("a", "走技术专家路线", ["架构", "深度"], "你开始为别人解决“没有标准答案”的问题。", { tech: 6, influence: 5 }, { architecture: 3, reputation: 1 }),
          choice("b", "接手团队管理", ["管理", "组织"], "你的提交变少了，日历颜色变多了。", { communication: 6, influence: 6, energy: -3 }, { management: 3, leadership: 2 }),
          choice("c", "先做技术负责人，兼顾两边", ["领导", "平衡"], "你获得了两种成长，也收到了两份工作量。", { tech: 4, communication: 4, influence: 6, energy: -7 }, { leadership: 3, architecture: 1, burnout: 1 })
        ]
      )
    ],
    pool: [
      event(
        "s4_p1_executive",
        "stage_4_core",
        "pool",
        "高层评审",
        "你有十分钟解释半年工作。第一页还没讲完，领导已经问到了最后一页。",
        [
          choice("a", "先讲业务结果，再回答技术路径", ["沟通", "影响"], "问题依然尖锐，但讨论终于围绕决策而不是术语。", { communication: 6, influence: 6 }, { visibility: 2, product: 1 }),
          choice("b", "坚持完整讲清技术背景", ["技术", "严谨"], "内容很完整，时间也完整地用完了。", { tech: 4, influence: 1, communication: -2 }, { integrity: 1 }),
          choice("c", "准备一页结论和三页备份", ["效率", "展示"], "十分钟结束，备份页真的被问到了。", { communication: 5, influence: 5, energy: 1 }, { visibility: 2, reliability: 1 })
        ]
      ),
      event(
        "s4_p2_budget",
        "stage_4_core",
        "pool",
        "预算削减",
        "资源少了三成，目标保持不变，因为表格里的目标不会自动感知预算。",
        [
          choice("a", "砍掉低价值项目，保护核心能力", ["产品", "决策"], "有人失望，但剩下的事情终于有机会做好。", { communication: 4, influence: 5, energy: -2 }, { product: 2, management: 2, integrity: 1 }),
          choice("b", "让所有项目都慢一点", ["公平", "风险"], "每个项目都还活着，只是都不太像能按时长大。", { influence: -1, energy: -4 }, { management: -1, burnout: 1 }),
          choice("c", "向上争取额外资源", ["谈判", "影响"], "你拿回了一部分预算，也欠下了一次明确的结果承诺。", { communication: 5, influence: 4, energy: -3 }, { negotiation: 2, visibility: 1 })
        ]
      ),
      event(
        "s4_p3_stack",
        "stage_4_core",
        "pool",
        "技术选型热潮",
        "新方案在社区很热，团队已经有人把头像换成了相关图标。",
        [
          choice("a", "先做适用性评估和退出方案", ["架构", "理性"], "试点保留了新方案的优点，也保留了后悔的权利。", { tech: 6, influence: 3 }, { architecture: 2, reliability: 1 }),
          choice("b", "全面采用，保持技术领先", ["趋势", "冒险"], "招聘介绍更亮眼了，迁移清单也更亮眼了。", { tech: 5, influence: 4, energy: -7 }, { reputation: 1, burnout: 1, reliability: -1 }),
          choice("c", "坚决不动成熟系统", ["稳健", "保守"], "系统继续稳定，团队里的年轻人开始稳定地看外部机会。", { energy: 3, influence: -2 }, { reliability: 1, adaptability: -1 })
        ]
      ),
      event(
        "s4_p4_transfer",
        "stage_4_core",
        "pool",
        "内部转岗邀请",
        "新业务需要技术骨干，风险高，但能从零搭建。现团队则离不开你。",
        [
          choice("a", "接受挑战，去新业务", ["冒险", "产品"], "你重新面对空白文档和未知用户，久违地感到紧张。", { tech: 3, influence: 5, energy: -4 }, { adaptability: 2, entrepreneurship: 1, product: 1 }, [
            pending("new_business", 5, "新业务的经历让你更敢于面对不确定路线。", { influence: 4 }, { entrepreneurship: 1, independence: 1 })
          ]),
          choice("b", "留下，完成关键交接", ["责任", "稳健"], "团队很感谢，你也更深地长进了现有系统。", { influence: 4, tech: 3 }, { reliability: 2, ownership: 1 }),
          choice("c", "先谈清角色和回报再决定", ["谈判", "选择"], "邀请从“需要你”变成了一份写明权责的方案。", { communication: 5, savings: 4 }, { negotiation: 2, highPay: 1 })
        ]
      ),
      event(
        "s4_p5_resignation",
        "stage_4_core",
        "pool",
        "关键成员离职",
        "核心同事提出离职，理由是想看看外面的世界。你知道外面的世界刚给他涨了很多薪。",
        [
          choice("a", "坦诚沟通，争取合理保留", ["管理", "人才"], "无论结果如何，对方至少愿意完成一次有质量的交接。", { communication: 6, influence: 3, energy: -3 }, { management: 2, mentoring: 1 }),
          choice("b", "尊重选择，立即设计交接", ["稳健", "团队"], "人还是走了，系统没有跟着一起走。", { tech: 2, influence: 3, energy: -2 }, { documentation: 2, reliability: 1 }),
          choice("c", "强调团队责任，希望他再坚持", ["压力", "风险"], "他多留了一周，也把离职原因讲得更具体了。", { communication: -4, influence: -2 }, { reputation: -1, layoffRisk: 1 })
        ]
      ),
      event(
        "s4_p6_public_incident",
        "stage_4_core",
        "pool",
        "公开事故说明",
        "一次事故影响了大量用户，公司需要技术代表参加说明会。",
        [
          choice("a", "说明事实、责任和改进计划", ["诚信", "危机"], "问题没有被美化，信任却因此恢复了一部分。", { communication: 7, influence: 6, energy: -5 }, { integrity: 2, crisisHandled: 2, reputation: 2 }),
          choice("b", "使用谨慎措辞，尽量降低影响", ["公关", "风险"], "每句话都没有错，合在一起也几乎没有信息。", { communication: 3, influence: 2 }, { politics: 1, reputation: -1 }),
          choice("c", "拒绝出面，让公关处理", ["边界", "低调"], "你避开了镜头，也失去了解释技术决策的机会。", { energy: 3, influence: -3 }, { visibility: -1 })
        ]
      )
    ]
  },
  {
    id: "stage_5_fork",
    order: 5,
    title: "第五章：路线分叉",
    subtitle: "职位越来越高，答案越来越不像标准答案",
    poolDrawCount: 2,
    fixed: [
      event(
        "s5_f1_route",
        "stage_5_fork",
        "fixed",
        "下一条主航道",
        "组织给你三个方向：技术决策、团队管理、业务产品。选择不是终身合同，但日历会先变。",
        [
          choice("a", "主攻技术架构", ["架构", "深度"], "你开始处理跨团队的技术边界，画的图比写的代码更多。", { tech: 6, influence: 6 }, { architecture: 3, reputation: 1 }),
          choice("b", "主攻组织管理", ["管理", "领导"], "你开始通过目标、招聘和反馈来写另一种代码。", { communication: 7, influence: 7, energy: -3 }, { management: 3, leadership: 2 }),
          choice("c", "转向产品与业务", ["产品", "用户"], "你第一次对收入曲线比调用链更敏感。", { communication: 6, influence: 6, tech: -1 }, { product: 3, customer: 2 })
        ]
      ),
      event(
        "s5_f2_equity",
        "stage_5_fork",
        "fixed",
        "股权与现金",
        "公司允许你在现金和长期激励之间选择。PPT 上的未来估值使用了非常乐观的字体。",
        [
          choice("a", "多拿现金，保持确定性", ["财富", "稳健"], "账户余额很诚实，想象空间少了一点。", { savings: 10, energy: 1 }, { highPay: 2, reliability: 1 }),
          choice("b", "接受更多长期激励", ["创业", "风险"], "你开始主动关心公司每个季度的故事。", { savings: -2, influence: 3 }, { entrepreneurship: 2, ownership: 1 }),
          choice("c", "谈一个更平衡的组合", ["谈判", "选择"], "方案没有完美，但明显比默认选项更像你的决定。", { communication: 4, savings: 6 }, { negotiation: 2, highPay: 1 })
        ]
      ),
      event(
        "s5_f3_remote",
        "stage_5_fork",
        "fixed",
        "远程工作的机会",
        "一家远程团队发来邀请，工作地点自由，时区则没有那么自由。",
        [
          choice("a", "接受远程，重新设计生活", ["远程", "自由"], "通勤消失了，边界需要你亲自画出来。", { energy: 5, savings: 4, communication: 2 }, { remote: 3, balance: 1, independence: 1 }),
          choice("b", "留在办公室，经营组织影响", ["影响", "稳定"], "你继续出现在关键走廊和临时会议里。", { influence: 5, energy: -2 }, { visibility: 2, management: 1 }),
          choice("c", "争取混合模式", ["谈判", "平衡"], "你得到每周几天自由，也得到一张复杂的会议时间表。", { communication: 4, energy: 3 }, { remote: 2, negotiation: 1, balance: 1 })
        ]
      ),
      event(
        "s5_f4_values",
        "stage_5_fork",
        "fixed",
        "价值观冲突",
        "公司要求上线一个能显著提升指标、但可能误导用户的设计。",
        [
          choice("a", "明确反对并提出替代方案", ["原则", "产品"], "指标涨得慢了一些，你还能直视产品里的每一个按钮。", { communication: 4, influence: 2, energy: -3 }, { integrity: 3, product: 1, customer: 2 }),
          choice("b", "执行决策，保留书面意见", ["现实", "自保"], "功能上线，你的邮件归档得非常完整。", { savings: 3, influence: 2, energy: -2 }, { politics: 1, integrity: -1 }),
          choice("c", "拒绝参与并考虑离开", ["原则", "独立"], "职业道路突然变窄，也突然变得清楚。", { influence: -2, savings: -3, energy: 2 }, { integrity: 3, independence: 2, adaptability: 1 })
        ]
      )
    ],
    pool: [
      event(
        "s5_p1_startup",
        "stage_5_fork",
        "pool",
        "创业邀请",
        "老同事带着一份演示稿找你，市场巨大、团队精干、现金流可以以后再聊。",
        [
          choice("a", "加入，成为技术合伙人", ["创业", "冒险"], "你拥有了更大的决策权，也拥有了随时可能归零的周末。", { influence: 7, savings: -8, energy: -8 }, { entrepreneurship: 4, ownership: 2, burnout: 1 }),
          choice("b", "业余时间先帮忙验证", ["副业", "谨慎"], "项目获得了第一批用户，你也获得了第二份日程表。", { tech: 3, savings: 3, energy: -5 }, { sideProject: 2, entrepreneurship: 2 }),
          choice("c", "拒绝，保持当前节奏", ["生活", "稳定"], "对方去寻找下一位合伙人，你准时吃了晚饭。", { energy: 5 }, { balance: 2, reliability: 1 })
        ]
      ),
      event(
        "s5_p2_maintainer",
        "stage_5_fork",
        "pool",
        "成为开源维护者",
        "一个受欢迎的项目邀请你加入维护。荣誉是公开的，待处理列表也是。",
        [
          choice("a", "接受并建立可持续维护机制", ["开源", "影响"], "社区不再只依赖英雄式响应，你的名字也出现在更多地方。", { tech: 5, communication: 4, influence: 7, energy: -5 }, { openSource: 3, leadership: 1, reputation: 2 }),
          choice("b", "只贡献自己熟悉的部分", ["开源", "边界"], "贡献持续而克制，生活没有被 Issue 列表接管。", { tech: 4, influence: 3, energy: -2 }, { openSource: 2, balance: 1 }),
          choice("c", "婉拒，专注本职工作", ["专注", "稳定"], "项目继续发展，你的晚上也继续属于自己。", { energy: 4, influence: -1 }, { balance: 1 })
        ]
      ),
      event(
        "s5_p3_freelance",
        "stage_5_fork",
        "pool",
        "自由职业试单",
        "朋友介绍了一个短期项目，报价不错，需求描述只有一句“类似那个热门产品”。",
        [
          choice("a", "先签范围和付款节点", ["独立", "谈判"], "项目仍然变化，但至少变化开始有价格。", { communication: 5, savings: 7, energy: -4 }, { independence: 2, negotiation: 2, customer: 1 }),
          choice("b", "直接开工，用速度赢信任", ["技术", "风险"], "第一版很快，第二版开始解释第一版没有写进合同的部分。", { tech: 3, savings: 4, energy: -7 }, { sideProject: 1, burnout: 1 }),
          choice("c", "拒绝，避免分散精力", ["生活", "专注"], "你少赚了一笔，也少拥有一个周日凌晨的客户群。", { energy: 5 }, { balance: 2 })
        ]
      ),
      event(
        "s5_p4_product",
        "stage_5_fork",
        "pool",
        "产品负责人邀约",
        "产品团队希望你转过去，理由是你懂技术，也愿意听用户把问题讲完。",
        [
          choice("a", "接受转型", ["产品", "用户"], "你开始写更少的代码，做更多关于为什么的决定。", { communication: 6, influence: 6, tech: -2 }, { product: 4, customer: 2, adaptability: 1 }),
          choice("b", "以技术伙伴身份深度协作", ["产品", "技术"], "你保留了技术身份，也不再把需求文档当作天气。", { tech: 3, communication: 4, influence: 4 }, { product: 2, customer: 1 }),
          choice("c", "拒绝，继续技术路线", ["技术", "专注"], "你回到架构图前，开始更认真地标注用户影响。", { tech: 5, influence: 2 }, { architecture: 2 })
        ]
      ),
      event(
        "s5_p5_family",
        "stage_5_fork",
        "pool",
        "生活发出提醒",
        "家人希望你减少出差和夜间会议。日历第一次遇到一个不能靠延期解决的需求。",
        [
          choice("a", "主动降速，重新划定边界", ["生活", "关系"], "工作没有停止，生活终于不再只出现在请假理由里。", { energy: 10, influence: -3, savings: -2 }, { balance: 4, burnout: -2 }),
          choice("b", "再拼一年，承诺以后调整", ["财富", "高压"], "承诺被认真记住，你则继续被下一季度追赶。", { savings: 7, influence: 4, energy: -9 }, { highPay: 2, burnout: 2, balance: -1 }),
          choice("c", "寻找更灵活的工作方式", ["远程", "改变"], "你开始把职位之外的生活方式也放进求职条件。", { communication: 3, energy: 4 }, { remote: 2, adaptability: 2, balance: 2 })
        ]
      ),
      event(
        "s5_p6_salary",
        "stage_5_fork",
        "pool",
        "高薪挖角",
        "新公司开出显著高薪，岗位核心要求写着“能扛事”，通常这三个字都很重。",
        [
          choice("a", "接受，换取更大回报", ["财富", "挑战"], "收入跨了一级，告警群也跨了三个时区。", { savings: 12, influence: 5, energy: -9 }, { highPay: 3, burnout: 2, reliability: 1 }),
          choice("b", "用报价争取内部调整", ["谈判", "稳定"], "留下来的条件变好了，主管也第一次确认你有市场价格。", { savings: 8, communication: 4, influence: 3 }, { negotiation: 2, highPay: 2 }),
          choice("c", "拒绝，优先当前生活状态", ["生活", "稳定"], "数字很诱人，但你保住了已经来之不易的节奏。", { energy: 6 }, { balance: 3, integrity: 1 })
        ]
      )
    ]
  },
  {
    id: "stage_6_answer",
    order: 6,
    title: "第六章：职业答案",
    subtitle: "没有标准答案，只有你愿意承担的选择",
    poolDrawCount: 2,
    fixed: [
      event(
        "s6_f1_final_crisis",
        "stage_6_answer",
        "fixed",
        "职业生涯级故障",
        "关键系统在最重要的业务日出现连锁故障。会议室里坐满了负责人，屏幕上只剩下一条不断增长的曲线。",
        [
          choice("a", "建立指挥机制，分组止损", ["危机", "领导"], "你没有亲自解决每个问题，却让所有人朝同一个恢复目标前进。", { communication: 7, influence: 8, energy: -7 }, { leadership: 2, management: 2, crisisHandled: 2 }),
          choice("b", "深入核心问题，亲手修复", ["技术", "担当"], "关键链路恢复了，你从屏幕前站起来时才发现天已经亮了。", { tech: 8, influence: 6, energy: -10 }, { architecture: 2, reliability: 2, burnout: 2 }),
          choice("c", "先保护用户和数据，再逐步恢复", ["用户", "稳健"], "恢复不算最快，但没有让一次事故变成长期伤害。", { communication: 5, influence: 6, energy: -5 }, { customer: 2, reliability: 3, integrity: 1 })
        ]
      ),
      event(
        "s6_f2_succession",
        "stage_6_answer",
        "fixed",
        "你不在时，团队如何运转",
        "一次长假暴露了答案：有人独立处理了问题，也有人连续给你发了二十条消息。",
        [
          choice("a", "完善授权和接班机制", ["领导", "组织"], "你的价值不再等于随时在线，团队也不再等于等你回复。", { communication: 5, influence: 6, energy: 4 }, { mentoring: 2, leadership: 2, management: 2, balance: 1 }),
          choice("b", "继续保持关键决策权", ["控制", "影响"], "所有重要事情仍会找到你，包括你不想处理的重要事情。", { influence: 4, energy: -7 }, { burnout: 2, politics: 1 }),
          choice("c", "把知识和工具尽可能公开", ["开源", "文档"], "内部手册逐渐像一套真正的系统，而不是你的个人注释。", { tech: 3, influence: 5, energy: -2 }, { documentation: 3, openSource: 1, reliability: 1 })
        ]
      ),
      event(
        "s6_f3_manifesto",
        "stage_6_answer",
        "fixed",
        "写下职业原则",
        "公司邀请你给新人分享成长经验。你可以谈成功路径，也可以谈那些差点让你离开的时刻。",
        [
          choice("a", "讲技术判断与长期主义", ["技术", "传承"], "新人记住了如何做取舍，而不只是记住了工具名称。", { tech: 4, influence: 6 }, { architecture: 1, mentoring: 2, reputation: 1 }),
          choice("b", "讲协作、反馈与组织", ["领导", "传承"], "分享结束后，有人第一次主动去和同事谈一个拖了很久的问题。", { communication: 5, influence: 6 }, { leadership: 2, management: 1, mentoring: 1 }),
          choice("c", "讲边界、健康和人生", ["生活", "传承"], "掌声不算最热烈，但几个人会在很多年后想起这段话。", { energy: 5, influence: 4 }, { balance: 3, burnout: -1 })
        ]
      ),
      event(
        "s6_f4_last_choice",
        "stage_6_answer",
        "fixed",
        "下一封邮件",
        "收件箱里同时躺着晋升通知、外部邀请和一张早已买好的周末车票。",
        [
          choice("a", "接受更大职责，继续向上", ["影响", "挑战"], "你合上电脑前，又打开了新职位的目标文档。", { influence: 8, savings: 6, energy: -5 }, { leadership: 2, highPay: 1, ownership: 1 }),
          choice("b", "选择新的道路，从头再来", ["独立", "改变"], "熟悉的头衔留在身后，前方的问题重新变得具体。", { energy: 3, savings: -3, influence: 2 }, { independence: 3, adaptability: 2 }),
          choice("c", "先去赶那趟车", ["生活", "选择"], "邮件周一还在，周末不会。", { energy: 10, influence: -2 }, { balance: 4, burnout: -2 })
        ]
      )
    ],
    pool: [
      event(
        "s6_p1_downturn",
        "stage_6_answer",
        "pool",
        "行业下行",
        "预算冻结、项目收缩，会议里开始频繁出现“聚焦”和“效率提升”。",
        [
          choice("a", "主动整合方向并保护关键成员", ["管理", "危机"], "无法保住所有项目，但团队知道每个决定为什么发生。", { communication: 6, influence: 5, energy: -5 }, { management: 2, leadership: 1, crisisHandled: 1 }),
          choice("b", "强化个人不可替代性", ["技术", "自保"], "短期位置稳了，你也再次成为没人敢碰的单点。", { tech: 5, influence: 3, energy: -6 }, { reliability: 1, burnout: 1, teamwork: -1 }),
          choice("c", "提前准备外部机会", ["适应", "市场"], "你没有立刻离开，但不再把命运只存一份。", { communication: 3, savings: 2 }, { adaptability: 3, networking: 2, layoffRisk: -1 })
        ]
      ),
      event(
        "s6_p2_acquisition",
        "stage_6_answer",
        "pool",
        "公司被收购",
        "新管理层承诺保持独立运营，同时发来了统一流程和新的汇报模板。",
        [
          choice("a", "理解新体系，争取整合话语权", ["适应", "影响"], "你帮助两个世界建立翻译层，也进入了更大的决策桌。", { communication: 6, influence: 7, energy: -4 }, { adaptability: 2, politics: 2, leadership: 1 }),
          choice("b", "守住原团队的工作方式", ["原则", "团队"], "团队获得了一段缓冲期，你则被视为有点难整合的人。", { influence: 2, communication: -2, energy: -3 }, { integrity: 2, layoffRisk: 1 }),
          choice("c", "接受补偿方案离开", ["财富", "独立"], "工牌失效的那一刻，你的日历突然空了。", { savings: 12, energy: 6, influence: -3 }, { independence: 2, adaptability: 1 })
        ]
      ),
      event(
        "s6_p3_keynote",
        "stage_6_answer",
        "pool",
        "行业大会演讲",
        "主办方邀请你讲项目经验。你知道成功故事背后还有很多不适合做标题的部分。",
        [
          choice("a", "公开真实经验和失败", ["分享", "声誉"], "内容不够神话，却被许多同行收藏。", { communication: 6, influence: 8 }, { reputation: 3, openSource: 1, integrity: 1 }),
          choice("b", "包装成一套漂亮方法论", ["展示", "影响"], "演讲传播很广，你后来花了不少时间解释它并非银弹。", { influence: 8, energy: -3 }, { visibility: 3, reputation: 1 }),
          choice("c", "把机会让给年轻同事", ["带教", "团队"], "对方完成了第一次大舞台，你在台下比他还紧张。", { influence: 4, communication: 3 }, { mentoring: 2, leadership: 1 })
        ]
      ),
      event(
        "s6_p4_sabbatical",
        "stage_6_answer",
        "pool",
        "一次长休",
        "你攒够了休息几个月的条件，唯一的问题是职业惯性不提供暂停按钮。",
        [
          choice("a", "真正停下来", ["生活", "恢复"], "最初几周你总想打开工作群，后来你重新学会了无目的的一天。", { energy: 15, savings: -8, influence: -3 }, { balance: 4, burnout: -3, independence: 1 }),
          choice("b", "边休息边做个人项目", ["独立", "创造"], "你没有完全休息，却做出了很久没有机会做的东西。", { energy: 5, savings: -4, tech: 4, influence: 2 }, { sideProject: 3, independence: 2 }),
          choice("c", "放弃长休，抓住当前窗口", ["财富", "高压"], "窗口抓住了，身体把休息需求记成了长期欠款。", { savings: 8, influence: 5, energy: -10 }, { highPay: 2, burnout: 3 })
        ]
      ),
      event(
        "s6_p5_launch",
        "stage_6_answer",
        "pool",
        "独立产品上线",
        "你长期打磨的小产品终于可以公开。发布按钮很小，背后的夜晚很多。",
        [
          choice("a", "正式发布并全职投入", ["独立", "产品"], "收入暂时不稳定，但每一个用户问题都直接属于你。", { savings: -8, influence: 6, energy: -5 }, { independence: 4, sideProject: 3, product: 2, entrepreneurship: 2 }),
          choice("b", "保持副业，慢慢验证", ["稳健", "独立"], "增长不快，却给了你一条越来越真实的第二曲线。", { savings: 3, influence: 3, energy: -4 }, { sideProject: 3, independence: 2, balance: 1 }),
          choice("c", "把项目开源", ["开源", "分享"], "商业路径变淡了，社区生命力却突然旺盛起来。", { tech: 3, influence: 7, savings: -2 }, { openSource: 4, reputation: 2 })
        ]
      ),
      event(
        "s6_p6_politics",
        "stage_6_answer",
        "pool",
        "最后一次站队",
        "两位负责人对未来方向分歧巨大，都希望你公开支持。技术意见第一次拥有了明显的政治重量。",
        [
          choice("a", "只基于事实公开表达判断", ["原则", "影响"], "你得罪了一部分人，也让更多人知道你的判断可以被信任。", { communication: 5, influence: 5, energy: -3 }, { integrity: 3, reputation: 2, politics: 1 }),
          choice("b", "支持资源更强的一方", ["政治", "财富"], "方向很快统一，你的位置也暂时更安全。", { influence: 6, savings: 4 }, { politics: 4, highPay: 1, integrity: -2 }),
          choice("c", "保持中立，准备离开", ["独立", "适应"], "你没有赢得这场内部战争，但保留了选择下一站的自由。", { energy: 3, influence: -2 }, { independence: 2, adaptability: 2, networking: 1 })
        ]
      )
    ]
  }
];

const EVENT_RULES = {
  s2_p1_docs: {
    priority: 20,
    requirements: requirements([condition("flag", "documentation", "truthy", true)])
  },
  s2_p5_side_project: {
    priority: 20,
    requirements: requirements([condition("flag", "sideProject", "truthy", true)])
  },
  s3_p4_oncall: {
    priority: 20,
    requirements: requirements([condition("flag", "reliability", "truthy", true)])
  },
  s3_p5_client: {
    priority: 18,
    requirements: requirements([condition("stat", "communication", "gte", 52)])
  },
  s4_p5_resignation: {
    priority: 22,
    requirements: requirements([condition("flag", "leadership", "truthy", true)])
  },
  s4_p6_public_incident: {
    priority: 22,
    requirements: requirements([condition("flag", "crisisHandled", "truthy", true)])
  },
  s5_p1_startup: {
    priority: 24,
    requirements: requirements([condition("flag", "ownership", "truthy", true)])
  },
  s5_p2_maintainer: {
    priority: 24,
    requirements: requirements([condition("flag", "openSource", "truthy", true)])
  },
  s5_p3_freelance: {
    priority: 24,
    requirements: requirements([condition("flag", "sideProject", "truthy", true)])
  },
  s5_p5_family: {
    priority: 100,
    requirements: requirements([condition("stat", "energy", "lte", 25)])
  },
  s6_p1_downturn: {
    priority: 100,
    requirements: requirements([condition("flag", "layoffRisk", "truthy", true)])
  },
  s6_p3_keynote: {
    priority: 24,
    requirements: requirements([condition("flag", "reputation", "truthy", true)])
  },
  s6_p4_sabbatical: {
    priority: 24,
    requirements: requirements([condition("flag", "balance", "truthy", true)])
  },
  s6_p5_launch: {
    priority: 24,
    requirements: requirements([condition("flag", "sideProject", "truthy", true)])
  }
};

STAGE_CONTENT.forEach((stage) => {
  stage.pool.forEach((item) => {
    if (EVENT_RULES[item.id]) Object.assign(item, EVENT_RULES[item.id]);
  });
});

const EVENTS = Object.freeze(STAGE_CONTENT.flatMap((stage) => stage.fixed.concat(stage.pool)));

const STAGE_META = Object.freeze([
  Object.freeze({ rank: "职场新人", illustration: "career-entry" }),
  Object.freeze({ rank: "独立开发", illustration: "career-growth" }),
  Object.freeze({ rank: "高级工程师", illustration: "career-senior" }),
  Object.freeze({ rank: "核心骨干", illustration: "career-core" }),
  Object.freeze({ rank: "路线抉择", illustration: "career-fork" }),
  Object.freeze({ rank: "职业定型", illustration: "career-answer" })
]);

const STAGES = Object.freeze(STAGE_CONTENT.map((stage) => Object.freeze({
  id: stage.id,
  index: stage.order,
  title: stage.title,
  rank: STAGE_META[stage.order - 1].rank,
  subtitle: stage.subtitle,
  coreEventIds: Object.freeze(stage.fixed.map((item) => item.id)),
  poolEventIds: Object.freeze(stage.pool.map((item) => item.id)),
  illustration: STAGE_META[stage.order - 1].illustration
})));

const EVENT_BY_ID = Object.freeze(EVENTS.reduce((result, item) => {
  result[item.id] = item;
  return result;
}, {}));

function getEventById(id) {
  return EVENT_BY_ID[String(id || "")] || null;
}

const ENDINGS = Object.freeze([
  {
    id: "ending_laid_off",
    title: "被优化的一天",
    hint: "当风险积累得比退路更快，组织会替你做选择。",
    summary: "组织调整落在了你身上。旧工牌失效，但积累的能力仍是下一段生涯的初始装备。",
    priority: 120,
    requirements: requirements([
      condition("flag", "layoffRisk", "truthy", true),
      condition("stat", "energy", "lte", 20)
    ])
  },
  {
    id: "ending_burnout",
    title: "高薪燃尽",
    hint: "收入曲线一路向上，电量图标一路向红。",
    summary: "你拿到了亮眼的薪酬和头衔，也终于承认恢复精力不能排进下一个迭代。",
    priority: 115,
    requirements: requirements([
      condition("flag", "highPay", "truthy", true),
      condition("flag", "burnout", "truthy", true),
      condition("stat", "energy", "lte", 22)
    ])
  },
  {
    id: "ending_open_source",
    title: "开源之星",
    hint: "你的影响力穿过了公司围墙。",
    summary: "你的代码和经验被许多陌生人使用，同行信用成为了比职位更长久的名片。",
    priority: 108,
    requirements: requirements([
      condition("flag", "openSource", "truthy", true),
      condition("stat", "tech", "gte", 68),
      condition("stat", "influence", "gte", 68)
    ])
  },
  {
    id: "ending_startup",
    title: "创业合伙人",
    hint: "你不再领取需求，而是决定哪些问题值得公司活下去。",
    summary: "你把技术判断押进一家新公司，开始同时面对用户、现金流和永远不够用的时间。",
    priority: 106,
    requirements: requirements([
      condition("flag", "entrepreneurship", "truthy", true),
      condition("flag", "ownership", "truthy", true),
      condition("stat", "energy", "gte", 24)
    ])
  },
  {
    id: "ending_indie",
    title: "独立开发者",
    hint: "产品、代码、客服和发票终于属于同一个人。",
    summary: "你用自己的节奏做产品，收入不再由职级决定，问题也不再能转交给隔壁团队。",
    priority: 104,
    requirements: requirements([
      condition("flag", "independence", "truthy", true),
      condition("flag", "sideProject", "truthy", true),
      condition("stat", "savings", "gte", 42)
    ])
  },
  {
    id: "ending_remote",
    title: "远程游牧",
    hint: "工位变成了一台电脑，办公室变成了时区。",
    summary: "你在不同城市打开同一台电脑，学会用结果建立信任，也学会准时关掉消息提醒。",
    priority: 102,
    requirements: requirements([
      condition("flag", "remote", "truthy", true),
      condition("flag", "balance", "truthy", true),
      condition("stat", "savings", "gte", 38)
    ])
  },
  {
    id: "ending_product",
    title: "产品转型",
    hint: "你依然解决问题，只是先问为什么再问怎么做。",
    summary: "你从实现方案的人变成定义问题的人，技术背景让每一次取舍都更接近现实。",
    priority: 100,
    requirements: requirements([
      condition("flag", "product", "truthy", true),
      condition("flag", "customer", "truthy", true),
      condition("stat", "communication", "gte", 58)
    ])
  },
  {
    id: "ending_manager",
    title: "工程经理",
    hint: "你的主要产出不再是提交，而是让团队持续产出。",
    summary: "你的工作从修复代码变成建设团队，最难排查的问题开始出现在沟通和组织里。",
    priority: 98,
    requirements: requirements([
      condition("flag", "management", "truthy", true),
      condition("flag", "leadership", "truthy", true),
      condition("stat", "communication", "gte", 70),
      condition("stat", "influence", "gte", 66)
    ])
  },
  {
    id: "ending_tech_lead",
    title: "技术负责人",
    hint: "你把技术判断、交付责任和团队信任放在同一张桌上。",
    summary: "你仍然理解代码细节，也能让一群人围绕同一个目标做出可靠的技术选择。",
    priority: 96,
    requirements: requirements([
      condition("flag", "leadership", "truthy", true),
      condition("stat", "tech", "gte", 70),
      condition("stat", "communication", "gte", 60),
      condition("stat", "influence", "gte", 64)
    ])
  },
  {
    id: "ending_architect",
    title: "首席架构师",
    hint: "你画的边界开始影响许多团队，而不是只影响一个仓库。",
    summary: "你用约束、标准和长期判断连接复杂系统，代码量减少了，技术责任却覆盖得更远。",
    priority: 94,
    requirements: requirements([
      condition("flag", "architecture", "truthy", true),
      condition("stat", "tech", "gte", 80),
      condition("stat", "influence", "gte", 58)
    ])
  },
  {
    id: "ending_life_first",
    title: "生活优先",
    hint: "你没有离开技术，只是不再把生活放进剩余时间。",
    summary: "你保留了专业能力，也保住了工作之外完整的自己。日历终于不是人生的唯一视图。",
    priority: 92,
    requirements: requirements([
      condition("flag", "balance", "truthy", true),
      condition("stat", "energy", "gte", 54)
    ])
  },
  {
    id: "ending_veteran",
    title: "稳健老兵",
    hint: "你没有成为传说，但总能让复杂事情可靠落地。",
    summary: "你见过潮流、故障和重组，仍然愿意把每件普通工作做得可信。这本身就是稀缺能力。",
    priority: 1,
    requirements: requirements()
  }
]);

const ENDING_BY_ID = Object.freeze(ENDINGS.reduce((result, item) => {
  result[item.id] = item;
  return result;
}, {}));

function getEndingById(id) {
  return ENDING_BY_ID[String(id || "")] || null;
}

function fail(message) {
  throw new Error(`Invalid career content: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateEffectMap(map, statKeys, label) {
  if (!isPlainObject(map)) fail(`${label} must be an object`);
  Object.keys(map).forEach((key) => {
    if (!statKeys.has(key)) fail(`${label} uses unknown stat ${key}`);
    if (typeof map[key] !== "number" || !Number.isFinite(map[key])) {
      fail(`${label}.${key} must be a finite number`);
    }
  });
}

function validateFlagList(list, flagKeys, label) {
  if (!Array.isArray(list)) fail(`${label} must be an array`);
  const seen = new Set();
  list.forEach((key) => {
    if (!flagKeys.has(key)) fail(`${label} uses unknown flag ${key}`);
    if (seen.has(key)) fail(`${label} contains duplicate flag ${key}`);
    seen.add(key);
  });
}

function validateRequirements(items, statKeys, flagKeys, label) {
  if (!Array.isArray(items)) fail(`${label} must be an array`);
  items.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;
    if (!isPlainObject(item)) fail(`${itemLabel} must be an object`);
    if (!["stat", "flag", "history"].includes(item.type)) fail(`${itemLabel} has invalid type`);
    if (!item.key || typeof item.key !== "string") fail(`${itemLabel} has invalid key`);
    if (!CONDITION_OPERATORS.includes(item.op)) fail(`${itemLabel} has invalid op`);
    if (!Object.prototype.hasOwnProperty.call(item, "value")) fail(`${itemLabel} is missing value`);
    if (item.type === "stat") {
      if (!statKeys.has(item.key)) fail(`${itemLabel} uses unknown stat ${item.key}`);
      if (!["gte", "lte", "eq"].includes(item.op)) fail(`${itemLabel} has invalid stat op`);
      if (typeof item.value !== "number" || !Number.isFinite(item.value)) fail(`${itemLabel} has invalid stat value`);
    }
    if (item.type === "flag") {
      if (!flagKeys.has(item.key)) fail(`${itemLabel} uses unknown flag ${item.key}`);
      if (!["eq", "truthy"].includes(item.op)) fail(`${itemLabel} has invalid flag op`);
      if (item.op === "truthy" && item.value !== true) fail(`${itemLabel} truthy value must be true`);
    }
    if (item.type === "history" && typeof item.value !== "number" && typeof item.value !== "boolean") {
      fail(`${itemLabel} has invalid history value`);
    }
  });
}

function validateContent(overrides = {}) {
  if (!isPlainObject(overrides)) fail("validation input must be an object");
  const statKeysList = overrides.STAT_KEYS || STAT_KEYS;
  const statMeta = overrides.STAT_META || STAT_META;
  const stages = overrides.STAGES || STAGES;
  const events = overrides.EVENTS || EVENTS;
  const endings = overrides.ENDINGS || ENDINGS;

  if (!Array.isArray(statKeysList) || statKeysList.length !== 5) fail("exactly 5 stat keys are required");
  const statKeys = new Set(statKeysList);
  const flagKeys = new Set(FLAG_KEYS);
  if (statKeys.size !== statKeysList.length) fail("stat keys must be unique");
  if (!isPlainObject(statMeta)) fail("STAT_META must be an object");
  statKeysList.forEach((key) => {
    const meta = statMeta[key];
    if (!isPlainObject(meta) || !meta.label) fail(`STAT_META.${key} is incomplete`);
    if (![meta.min, meta.max, meta.initial].every((value) => Number.isFinite(value))) {
      fail(`STAT_META.${key} has invalid bounds`);
    }
    if (meta.min >= meta.max || meta.initial < meta.min || meta.initial > meta.max) {
      fail(`STAT_META.${key} has inconsistent bounds`);
    }
  });
  if (Object.keys(statMeta).some((key) => !statKeys.has(key))) fail("STAT_META contains an unknown stat");

  if (!Array.isArray(stages) || stages.length !== 6) fail("exactly 6 stages are required");
  if (!Array.isArray(events) || events.length !== 60) fail("exactly 60 events are required");
  if (!Array.isArray(endings) || endings.length !== 12) fail("exactly 12 endings are required");

  const stageIds = new Set();
  const referencedEventIds = new Set();
  stages.forEach((stage, index) => {
    const requiredKeys = ["id", "index", "title", "rank", "subtitle", "coreEventIds", "poolEventIds", "illustration"];
    if (!isPlainObject(stage) || requiredKeys.some((key) => !Object.prototype.hasOwnProperty.call(stage, key))) {
      fail(`stage ${index} is incomplete`);
    }
    if (!stage.id || !stage.title || !stage.rank || !stage.subtitle || !stage.illustration) fail(`stage ${index} has empty metadata`);
    if (stageIds.has(stage.id)) fail(`duplicate stage id ${stage.id}`);
    stageIds.add(stage.id);
    if (stage.index !== index + 1) fail(`stage ${stage.id} has invalid index`);
    if (!Array.isArray(stage.coreEventIds) || stage.coreEventIds.length !== 4) {
      fail(`stage ${stage.id} must have 4 core events`);
    }
    if (!Array.isArray(stage.poolEventIds) || stage.poolEventIds.length !== 6) {
      fail(`stage ${stage.id} must have 6 pool events`);
    }
    stage.coreEventIds.concat(stage.poolEventIds).forEach((eventId) => {
      if (referencedEventIds.has(eventId)) fail(`event reference ${eventId} is duplicated`);
      referencedEventIds.add(eventId);
    });
  });

  const eventIds = new Set();
  const choiceIds = new Set();
  const pendingIds = new Set();
  let choiceCount = 0;
  let pendingEffectCount = 0;

  events.forEach((item, eventIndex) => {
    if (!isPlainObject(item) || !item.id || !item.stageId || !item.title || !item.body) fail(`event ${eventIndex} is incomplete`);
    if (eventIds.has(item.id)) fail(`duplicate event id ${item.id}`);
    eventIds.add(item.id);
    if (!stageIds.has(item.stageId)) fail(`event ${item.id} references unknown stage ${item.stageId}`);
    if (item.kind !== "core" && item.kind !== "pool") fail(`event ${item.id} has invalid kind`);
    if (item.priority !== undefined && !Number.isFinite(item.priority)) fail(`event ${item.id} has invalid priority`);
    if (item.requirements !== undefined) {
      validateRequirements(item.requirements, statKeys, flagKeys, `event ${item.id}.requirements`);
    }
    if (!Array.isArray(item.choices) || item.choices.length < 2 || item.choices.length > 4) {
      fail(`event ${item.id} must have 2 to 4 choices`);
    }

    const stage = stages.find((candidate) => candidate.id === item.stageId);
    const expectedIds = item.kind === "core" ? stage.coreEventIds : stage.poolEventIds;
    if (!expectedIds.includes(item.id)) fail(`event ${item.id} is missing from its stage ${item.kind} references`);

    item.choices.forEach((itemChoice, choiceIndex) => {
      const choiceLabel = `event ${item.id} choice ${choiceIndex}`;
      if (!isPlainObject(itemChoice)) fail(`${choiceLabel} must be an object`);
      ["id", "text", "tags", "outcome", "effects"].forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(itemChoice, key)) fail(`${choiceLabel} is missing ${key}`);
      });
      if (!itemChoice.id || !itemChoice.text || !itemChoice.outcome) fail(`${choiceLabel} has empty text`);
      if (choiceIds.has(itemChoice.id)) fail(`duplicate choice id ${itemChoice.id}`);
      choiceIds.add(itemChoice.id);
      choiceCount += 1;
      if (!Array.isArray(itemChoice.tags) || itemChoice.tags.length === 0 || itemChoice.tags.some((tag) => typeof tag !== "string" || !tag.trim())) {
        fail(`${choiceLabel} has invalid tags`);
      }
      validateEffectMap(itemChoice.effects, statKeys, `${choiceLabel}.effects`);
      if (itemChoice.addFlags !== undefined) validateFlagList(itemChoice.addFlags, flagKeys, `${choiceLabel}.addFlags`);
      if (itemChoice.removeFlags !== undefined) validateFlagList(itemChoice.removeFlags, flagKeys, `${choiceLabel}.removeFlags`);
      if (itemChoice.requirements !== undefined) {
        validateRequirements(itemChoice.requirements, statKeys, flagKeys, `${choiceLabel}.requirements`);
      }
      if (itemChoice.endingId !== undefined && typeof itemChoice.endingId !== "string") {
        fail(`${choiceLabel}.endingId must be a string`);
      }
      if (itemChoice.pendingEffects !== undefined) {
        if (!Array.isArray(itemChoice.pendingEffects)) fail(`${choiceLabel}.pendingEffects must be an array`);
        itemChoice.pendingEffects.forEach((pendingEffect, pendingIndex) => {
          const pendingLabel = `${choiceLabel}.pendingEffects[${pendingIndex}]`;
          if (!isPlainObject(pendingEffect) || !pendingEffect.id) fail(`${pendingLabel} is incomplete`);
          if (pendingIds.has(pendingEffect.id)) fail(`duplicate pending effect id ${pendingEffect.id}`);
          pendingIds.add(pendingEffect.id);
          pendingEffectCount += 1;
          if (!Number.isInteger(pendingEffect.delay) || pendingEffect.delay < 1) fail(`${pendingLabel} has invalid delay`);
          validateEffectMap(pendingEffect.effects, statKeys, `${pendingLabel}.effects`);
          if (pendingEffect.addFlags !== undefined) {
            validateFlagList(pendingEffect.addFlags, flagKeys, `${pendingLabel}.addFlags`);
          }
          if (pendingEffect.narrative !== undefined && (typeof pendingEffect.narrative !== "string" || !pendingEffect.narrative.trim())) {
            fail(`${pendingLabel}.narrative must be non-empty text`);
          }
        });
      }
    });
  });

  if (eventIds.size !== referencedEventIds.size || [...eventIds].some((id) => !referencedEventIds.has(id))) {
    fail("every event must be referenced exactly once by a stage");
  }
  [...referencedEventIds].forEach((id) => {
    if (!eventIds.has(id)) fail(`stage references unknown event ${id}`);
  });

  const endingIds = new Set();
  const endingTitles = new Set();
  endings.forEach((ending, index) => {
    const requiredKeys = ["id", "title", "hint", "summary", "priority", "requirements"];
    if (!isPlainObject(ending) || requiredKeys.some((key) => !Object.prototype.hasOwnProperty.call(ending, key))) {
      fail(`ending ${index} is incomplete`);
    }
    if (!ending.id || !ending.title || !ending.hint || !ending.summary) fail(`ending ${index} has empty text`);
    if (endingIds.has(ending.id)) fail(`duplicate ending id ${ending.id}`);
    if (endingTitles.has(ending.title)) fail(`duplicate ending title ${ending.title}`);
    endingIds.add(ending.id);
    endingTitles.add(ending.title);
    if (!Number.isFinite(ending.priority)) fail(`ending ${ending.id} has invalid priority`);
    validateRequirements(ending.requirements, statKeys, flagKeys, `ending ${ending.id}.requirements`);
  });

  EXPECTED_ENDING_TITLES.forEach((title) => {
    if (!endingTitles.has(title)) fail(`missing required ending ${title}`);
  });
  const defaultEnding = endings.find((ending) => ending.title === "稳健老兵");
  if (!defaultEnding || defaultEnding.requirements.length !== 0) fail("稳健老兵 must be the default ending");
  endings.filter((ending) => ending !== defaultEnding).forEach((ending) => {
    if (ending.requirements.length === 0) fail(`ending ${ending.id} must have requirements`);
    if (ending.priority <= defaultEnding.priority) fail(`ending ${ending.id} must outrank the default ending`);
  });
  events.forEach((item) => {
    item.choices.forEach((itemChoice) => {
      if (itemChoice.endingId && !endingIds.has(itemChoice.endingId)) {
        fail(`choice ${itemChoice.id} references unknown ending ${itemChoice.endingId}`);
      }
    });
  });

  return {
    stageCount: stages.length,
    eventCount: events.length,
    choiceCount,
    pendingEffectCount,
    endingCount: endings.length
  };
}

module.exports = {
  STAT_KEYS,
  STAT_META,
  STAGES,
  EVENTS,
  ENDINGS,
  getEventById,
  getEndingById,
  validateContent
};
