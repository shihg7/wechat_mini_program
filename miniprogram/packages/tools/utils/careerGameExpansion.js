function splitFlags(flags = {}) {
  return Object.keys(flags).reduce((result, key) => {
    if (flags[key] === false || flags[key] < 0) result.removeFlags.push(key);
    if (flags[key] === true || flags[key] > 0) result.addFlags.push(key);
    return result;
  }, { addFlags: [], removeFlags: [] });
}

function pending(id, delay, narrative, effects = {}, flags = {}) {
  const changes = splitFlags(flags);
  const result = { id, delay, effects };
  if (changes.addFlags.length) result.addFlags = changes.addFlags;
  if (narrative) result.narrative = narrative;
  return result;
}

function choice(id, text, tags, outcome, effects = {}, flags = {}, pendingEffects = [], requirements) {
  const changes = splitFlags(flags);
  const result = { id, text, tags, outcome, effects };
  if (changes.addFlags.length) result.addFlags = changes.addFlags;
  if (changes.removeFlags.length) result.removeFlags = changes.removeFlags;
  if (pendingEffects.length) result.pendingEffects = pendingEffects;
  if (requirements) result.requirements = requirements;
  return result;
}

function event(id, stageId, category, title, body, rawChoices, options = {}) {
  const result = {
    id,
    stageId,
    kind: "pool",
    category,
    title,
    body,
    choices: rawChoices.map((item) => {
      const normalized = {
        ...item,
        id: `${id}_${item.id}`
      };
      if (item.pendingEffects) {
        normalized.pendingEffects = item.pendingEffects.map((effect) => ({
          ...effect,
          id: `${id}_${item.id}_${effect.id}`
        }));
      }
      return normalized;
    })
  };
  if (Number.isFinite(options.priority)) result.priority = options.priority;
  if (options.requirements) result.requirements = options.requirements;
  return result;
}

function flag(key) {
  return [{ type: "flag", key, op: "truthy", value: true }];
}

function stat(key, op, value) {
  return [{ type: "stat", key, op, value }];
}

function history(key) {
  return [{ type: "history", key, op: "gte", value: 1 }];
}

const EXTRA_EVENTS = [
  event(
    "s1_x1_ai_pair",
    "stage_1_entry",
    "AI 时代",
    "AI 助手入职",
    "公司开放了 AI 编程助手。它写代码很快，承认不知道的速度则慢得多。",
    [
      choice("a", "先学会验证，再让它处理重复工作", ["学习", "效率"], "你把省下的时间用来理解系统，而不是制造更多待审代码。", { tech: 5, energy: 2 }, { learning: 2, reliability: 1 }, [
        pending("verified_habit", 6, "验证习惯救下了一次看似正确的自动生成改动。", { tech: 4, influence: 2 }, { reputation: 1 })
      ]),
      choice("b", "大胆全用，速度就是新人最好的名片", ["冒险", "产出"], "提交量很漂亮，直到评审问你第三段代码为什么这样写。", { tech: 2, influence: 3, energy: -3 }, { adaptability: 1, reliability: -1 }),
      choice("c", "暂时不用，先靠自己打牢基础", ["基本功", "稳健"], "你走得慢一些，却能解释每一行；只是新工具不会等你准备好。", { tech: 5, energy: -1 }, { learning: 1, adaptability: -1 })
    ]
  ),
  event(
    "s1_x2_phishing",
    "stage_1_entry",
    "安全警报",
    "一封过分真实的钓鱼邮件",
    "“年终奖明细”需要重新登录。链接、头像、措辞都像真的，甚至比内部系统更好用。",
    [
      choice("a", "不上钩，并把可疑点整理给全组", ["安全", "分享"], "安全团队确认这是演练，你的截图意外成了新员工教材。", { communication: 4, influence: 3 }, { documentation: 1, reliability: 2 }, [
        pending("security_memory", 8, "同事在真正的攻击到来前想起了你标出的细节。", { influence: 4 }, { reputation: 1 })
      ]),
      choice("b", "先在群里问一句这是真的吗", ["求证", "团队"], "五个人同时停下了输入密码的手，群管理员也终于置顶了安全提醒。", { communication: 3, tech: 1 }, { teamwork: 1, integrity: 1 }),
      choice("c", "点开看看，反正公司有安全部门", ["好奇", "风险"], "页面弹出“演练失败”。你第一次知道羞耻也能做成全屏弹窗。", { tech: 2, influence: -3 }, { adaptability: 1, layoffRisk: 1 })
    ]
  ),
  event(
    "s1_x3_accessibility",
    "stage_1_entry",
    "用户现实",
    "键盘走不到的按钮",
    "一位用户反馈无法用键盘完成支付。需求单只有一句话，却把你熟悉的页面变成了障碍赛。",
    [
      choice("a", "跟着用户路径完整修一遍", ["用户", "质量"], "你修的不只是按钮，还第一次理解了“能打开”和“能使用”的区别。", { tech: 4, energy: -3, influence: 2 }, { customer: 2, ownership: 1 }, [
        pending("accessible_return", 7, "无障碍改造让一次大客户验收意外顺利。", { savings: 3, influence: 4 }, { reputation: 1 })
      ]),
      choice("b", "只修工单里最直接的问题", ["交付", "边界"], "工单关闭了，下一处障碍在两天后重新打开了一张工单。", { tech: 2, energy: 1 }, { customer: 1 }),
      choice("c", "认为这不是当前版本的优先级", ["业务", "取舍"], "排期保住了，用户也安静地离开了。数据看起来没有报错。", { savings: 2, influence: -2 }, { product: 1, integrity: -1 })
    ]
  ),
  event(
    "s1_x4_remote_onboarding",
    "stage_1_entry",
    "人生变量",
    "远程入职第一周",
    "你认识了二十个头像、七个群和零张真实的脸。每天最难的问题是该在哪个群问问题。",
    [
      choice("a", "主动约短聊，画一张团队关系图", ["沟通", "连接"], "咖啡没喝到一起，但你终于知道谁能回答什么。", { communication: 6, energy: -2 }, { remote: 2, networking: 1, documentation: 1 }),
      choice("b", "先潜水观察，避免问出低级问题", ["谨慎", "独立"], "你少打扰了别人，也多花了三天猜一个缩写。", { tech: 2, energy: -3 }, { independence: 1, remote: 1 }),
      choice("c", "要求安排明确的入职伙伴", ["边界", "协作"], "主管补上了流程漏洞，你也拥有了第一个稳定求助入口。", { communication: 4, influence: 2 }, { teamwork: 2, ownership: 1 })
    ]
  ),
  event(
    "s1_x5_hackathon",
    "stage_1_entry",
    "创意实验",
    "黑客松的四十八小时",
    "你们想做一个自动整理会议废话的工具。评委觉得有趣，会议发起人觉得危险。",
    [
      choice("a", "做出能现场演示的最小版本", ["产品", "行动"], "演示识别出了“这个问题我们会后再议”，全场第一次为会议纪要鼓掌。", { tech: 4, influence: 4, energy: -5 }, { product: 2, sideProject: 1 }, [
        pending("prototype_reused", 9, "那个仓促原型被另一个团队改成了真正的内部工具。", { influence: 5, tech: 2 }, { reputation: 1 })
      ]),
      choice("b", "把时间花在架构和可扩展性上", ["技术", "长期"], "底层设计很漂亮，演示时只有一个空白页面和一张架构图。", { tech: 6, energy: -4, influence: -1 }, { architecture: 1, learning: 1 }),
      choice("c", "负责协调，让队友的点子真正拼起来", ["团队", "组织"], "你没写最多的代码，却让四个半成品变成了一个完整故事。", { communication: 6, influence: 3 }, { leadership: 1, teamwork: 2 })
    ]
  ),
  event(
    "s1_x6_support_shadow",
    "stage_1_entry",
    "用户现实",
    "去客服旁边坐一天",
    "主管让你旁听用户来电。你第一次听见自己写的报错提示被人完整念出来。",
    [
      choice("a", "记录高频困惑并改掉前三个", ["用户", "改进"], "客服少解释了几十遍，你也开始把错误提示当成功能写。", { tech: 3, communication: 3, influence: 2 }, { customer: 2, ownership: 1 }),
      choice("b", "解释技术限制，请客服优化话术", ["沟通", "现实"], "话术顺了，产品没变；这也确实解决了一半问题。", { communication: 4, energy: 1 }, { customer: 1, product: 1 }),
      choice("c", "觉得这些都是用户不会用", ["判断", "疏离"], "你保住了开发时间，也错过了最便宜的一次用户研究。", { tech: 1, communication: -3 }, { customer: -1, integrity: -1 })
    ]
  ),
  event(
    "s1_x7_meetup",
    "stage_1_entry",
    "社区支线",
    "第一次社区闪电演讲",
    "分享只有五分钟，紧张却提前了五天。台下可能有大牛，也可能只有等披萨的人。",
    [
      choice("a", "讲一次真实失败和修复过程", ["分享", "真诚"], "大家记住了你的坑，也记住了你没有把失败包装成最佳实践。", { communication: 6, influence: 4, energy: -2 }, { visibility: 2, integrity: 1, networking: 1 }, [
        pending("community_invite", 10, "一位听众邀请你参加更大的技术圆桌。", { influence: 5, communication: 2 }, { reputation: 1 })
      ]),
      choice("b", "做一页密度极高的技术干货", ["技术", "展示"], "懂的人拍了照，不懂的人也拍了照，可能只是因为来不及看。", { tech: 4, influence: 3 }, { visibility: 1, openSource: 1 }),
      choice("c", "临场退缩，把机会让给队友", ["能量", "退让"], "你松了一口气，也发现害怕不会因为缺席自动消失。", { energy: 2, influence: -2 }, { teamwork: 1 })
    ]
  ),
  event(
    "s1_x8_side_project",
    "stage_1_entry",
    "创意实验",
    "副项目突然有了一千个用户",
    "你随手做的小工具被推荐上首页。增长曲线很好看，未读反馈更好看。",
    [
      choice("a", "连续几个晚上把它做成产品", ["独立", "产品"], "你拥有了真正的用户，也拥有了第二份没有工资的工作。", { tech: 4, influence: 5, energy: -8 }, { sideProject: 3, product: 2, independence: 1 }, [
        pending("side_income", 8, "一部分用户愿意付费，副项目第一次带来真实收入。", { savings: 6, influence: 2 }, { entrepreneurship: 1 })
      ]),
      choice("b", "开源并邀请用户一起维护", ["开源", "社区"], "问题列表没有变短，但开始出现你不认识的贡献者。", { tech: 3, influence: 5, energy: -4 }, { openSource: 3, sideProject: 2, teamwork: 1 }),
      choice("c", "及时关掉增长入口，先保住生活", ["边界", "生活"], "热度过去了，你睡了一个完整的周末，并没有因此失去职业未来。", { energy: 7, influence: -1 }, { balance: 2, sideProject: 1 })
    ]
  ),
  event(
    "s1_x9_imposter",
    "stage_1_entry",
    "内心现场",
    "你怀疑自己是误招进来的",
    "同事讨论编译器时像在聊天气，你只听懂了连接词。日历上还有一场你要参加的评审。",
    [
      choice("a", "列出不会的内容，逐项补齐", ["学习", "耐心"], "未知没有立刻变少，但它们从浓雾变成了一张清单。", { tech: 5, energy: -2 }, { learning: 2, documentation: 1 }),
      choice("b", "找可信任的前辈坦白焦虑", ["沟通", "支持"], "前辈展示了自己的搜索记录，你第一次发现高手也经常搜索基础问题。", { communication: 5, energy: 4 }, { mentoring: 1, balance: 1 }),
      choice("c", "用更长工时掩盖不安", ["投入", "消耗"], "短期产出上去了，焦虑也学会了在深夜准时打卡。", { tech: 3, influence: 2, energy: -8 }, { burnout: 2, highPay: 1 })
    ]
  ),
  event(
    "s1_x10_thanks",
    "stage_1_entry",
    "用户现实",
    "第一封用户感谢信",
    "用户说你修的小功能让她每天少做十分钟重复操作。需求单上原本只写着“体验优化”。",
    [
      choice("a", "把反馈分享给整个团队", ["团队", "意义"], "那天下午的例会第一次有人主动提起真实用户。", { communication: 4, influence: 4, energy: 2 }, { customer: 2, teamwork: 1 }, [
        pending("user_memory", 6, "当团队争论优先级时，这个真实故事成为了有分量的证据。", { influence: 3 }, { product: 1 })
      ]),
      choice("b", "默默收藏，继续做下一张单", ["稳健", "执行"], "你得到了一点私人能量，但没有人知道这项改动为何值得。", { energy: 4, tech: 1 }, { reliability: 1 }),
      choice("c", "顺势向主管争取更多用户研究", ["产品", "主动"], "你多了几场访谈，也少了几次凭感觉拍脑袋。", { communication: 4, influence: 3, energy: -2 }, { customer: 2, product: 2, ownership: 1 })
    ]
  ),

  event(
    "s2_x1_ai_bug",
    "stage_2_growth",
    "AI 回响",
    "AI 生成代码里的隐形漏洞",
    "一段运行了两个月的自动生成代码在极端输入下泄露了内部字段。提交记录里有你的名字。",
    [
      choice("a", "承认审查不足并补上系统性检查", ["责任", "安全"], "你没有把锅甩给工具，团队也终于把“AI 写的”从免责理由里删掉。", { tech: 5, communication: 3, energy: -4 }, { integrity: 2, reliability: 2, crisisHandled: 1 }, [
        pending("ai_guardrail", 7, "新检查拦住了另一处更昂贵的自动生成缺陷。", { tech: 4, influence: 3 }, { reputation: 1 })
      ]),
      choice("b", "快速修复，不扩大讨论", ["效率", "风险"], "问题消失了，产生问题的方式仍留在流水线上。", { tech: 3, energy: -2 }, { reliability: 1, documentation: -1 }),
      choice("c", "主张全面禁用 AI 工具", ["原则", "保守"], "风险暂时归零，团队速度也回到了工具开放前。", { communication: 2, influence: -1 }, { integrity: 1, adaptability: -2 })
    ],
    { priority: 34, requirements: history("s1_x1_ai_pair_a") }
  ),
  event(
    "s2_x2_supply_chain",
    "stage_2_growth",
    "安全警报",
    "依赖包供应链告警",
    "核心依赖的维护者账号被盗。安全公告写着“建议立即升级”，升级说明写着“包含不兼容改动”。",
    [
      choice("a", "隔离风险并组织受控升级", ["安全", "工程"], "上线慢了一天，但每一步都有回退点。", { tech: 5, energy: -5, influence: 2 }, { reliability: 2, ownership: 1 }, [
        pending("dependency_map", 8, "这次整理的依赖清单让下一次安全响应快了很多。", { tech: 3, energy: 2 }, { documentation: 1 })
      ]),
      choice("b", "先锁死旧版本，等待社区结论", ["稳健", "等待"], "短期没有事故，风险时钟却仍在后台计时。", { energy: 2, tech: 1 }, { reliability: 1 }),
      choice("c", "直接升级并相信测试", ["速度", "冒险"], "漏洞补上了，两个边缘功能在第二天用工单介绍了自己。", { tech: 3, energy: -5 }, { adaptability: 1, crisisHandled: 1 })
    ]
  ),
  event(
    "s2_x3_feature_flags",
    "stage_2_growth",
    "工程现场",
    "功能开关考古",
    "系统里有 83 个功能开关，最老的创建于五年前。没人敢删，因为每个名字都像某次事故的纪念碑。",
    [
      choice("a", "建立所有者清单，分批清理", ["治理", "耐心"], "删除第一批开关时没有掌声，构建时间却诚实地快了。", { tech: 5, influence: 3, energy: -4 }, { documentation: 2, ownership: 2 }),
      choice("b", "只清理自己模块里确定无用的", ["边界", "稳健"], "你的小花园干净了，公共走廊仍堆满纸箱。", { tech: 3, energy: -1 }, { reliability: 1 }),
      choice("c", "不动它们，先做有业务价值的需求", ["业务", "短期"], "本季度指标没有受影响，下季度又多了七个开关。", { savings: 3, influence: 1 }, { product: 1, documentation: -1 })
    ]
  ),
  event(
    "s2_x4_timezone",
    "stage_2_growth",
    "协作现场",
    "跨时区接力",
    "旧金山下班前把任务交给上海，上海下班前再交回去。理论上项目全天运转，实际上问题全天等待。",
    [
      choice("a", "制定异步交接模板和重叠时间", ["远程", "流程"], "消息变长了，等待变短了，大家终于不用靠猜测接棒。", { communication: 5, influence: 3, energy: -2 }, { remote: 2, documentation: 2, teamwork: 1 }, [
        pending("async_reputation", 7, "清晰的异步协作让你被邀请参与更重要的跨区项目。", { influence: 4, communication: 2 }, { reputation: 1 })
      ]),
      choice("b", "自己多熬几次夜把接口对齐", ["负责", "消耗"], "项目确实动了，你的作息也开始跨时区。", { influence: 3, energy: -7 }, { ownership: 1, burnout: 1, remote: 1 }),
      choice("c", "要求项目必须指定单一时区负责人", ["边界", "管理"], "责任更清楚了，全球协作也变成了全球排队。", { communication: 3, energy: 2 }, { management: 1, remote: -1 })
    ]
  ),
  event(
    "s2_x5_maintainer",
    "stage_2_growth",
    "社区回响",
    "开源维护者回复了你",
    "你半年前提交的修复终于收到回复：“方向不错，但需要重写一半。”下面还有一串具体建议。",
    [
      choice("a", "按反馈重写，并补齐测试", ["开源", "长期"], "合并通知到达时，你对这套代码的理解已经超过最初的问题。", { tech: 6, influence: 5, energy: -5 }, { openSource: 3, reputation: 1 }, [
        pending("maintainer_trust", 9, "维护者把一个更重要的议题指派给了你。", { influence: 5, tech: 2 }, { openSource: 1 })
      ]),
      choice("b", "解释现有方案为什么已经足够", ["沟通", "坚持"], "讨论很专业，补丁仍没有合并；你学会了社区共识也是代码的一部分。", { communication: 4, tech: 2 }, { openSource: 1, integrity: 1 }),
      choice("c", "没有精力继续，礼貌关闭提交", ["边界", "生活"], "你失去了一次合并记录，保住了一个周末。", { energy: 5, influence: -1 }, { balance: 2 })
    ],
    { priority: 32, requirements: flag("openSource") }
  ),
  event(
    "s2_x6_analytics",
    "stage_2_growth",
    "用户现实",
    "数据埋点揭穿了直觉",
    "团队最自豪的新入口几乎没人点，那个被嫌弃的旧按钮却承担了七成转化。",
    [
      choice("a", "承认判断错了，按数据重新设计", ["产品", "诚实"], "方案回到了起点，你的可信度反而没有归零。", { communication: 4, influence: 3, energy: -2 }, { product: 2, integrity: 2, customer: 1 }),
      choice("b", "继续观察，避免被短期数据误导", ["分析", "耐心"], "你发现新用户需要时间适应，也发现等待本身需要截止日期。", { tech: 2, energy: 1 }, { product: 1, reliability: 1 }),
      choice("c", "调整汇报口径，强调其他正向指标", ["政治", "自保"], "汇报顺利通过，用户行为没有参加那场会议。", { influence: 2, communication: 1 }, { politics: 2, integrity: -2 })
    ]
  ),
  event(
    "s2_x7_load_test",
    "stage_2_growth",
    "工程现场",
    "压测把系统压醒了",
    "目标是十万并发。两万时数据库先举手，三万时日志系统也加入了讨论。",
    [
      choice("a", "先找真实瓶颈，再逐层优化", ["技术", "证据"], "你没有买更多机器，而是删掉了一次藏在循环里的查询。", { tech: 7, influence: 3, energy: -4 }, { architecture: 1, reliability: 2 }),
      choice("b", "扩容换时间，确保发布节点", ["交付", "成本"], "发布稳住了，云账单也开始拥有自己的增长曲线。", { influence: 3, savings: -5, energy: -1 }, { product: 1, reliability: 1 }),
      choice("c", "把目标改成更现实的五万", ["谈判", "取舍"], "你避免了过度建设，也留下了一个需要被持续验证的假设。", { communication: 4, savings: 3 }, { negotiation: 1, product: 1 })
    ]
  ),
  event(
    "s2_x8_salary_sheet",
    "stage_2_growth",
    "职场现实",
    "匿名薪资表在群里流传",
    "表格显示同级薪资差距比你想象得大。没人确认真实性，但每个人都突然想约一对一。",
    [
      choice("a", "带着成果和市场数据正式沟通", ["谈判", "理性"], "你没有拿表格质问，而是让主管必须回应你的价值证据。", { communication: 5, savings: 5, energy: -2 }, { negotiation: 2, visibility: 1 }, [
        pending("salary_adjustment", 6, "薪酬调整终于落地，幅度不夸张，但改变了后续基数。", { savings: 5 }, { highPay: 1 })
      ]),
      choice("b", "先提升能力，等下次周期再说", ["长期", "忍耐"], "你继续成长，也把一次谈判机会交给了未来的自己。", { tech: 4, energy: -2 }, { learning: 1 }),
      choice("c", "立刻开始投简历验证市场", ["机会", "行动"], "你得到了一些面试，也重新认识了自己的可替代性。", { communication: 2, influence: 2, energy: -4 }, { networking: 2, adaptability: 1 })
    ]
  ),
  event(
    "s2_x9_bad_habit",
    "stage_2_growth",
    "团队回响",
    "新人学会了你的坏习惯",
    "你发现新人复制了你的代码，也复制了你“先上线再补文档”的注释。",
    [
      choice("a", "坦白这是坏示范，并一起补齐", ["导师", "责任"], "你失去了一点完美前辈的形象，换来了更可信的合作关系。", { communication: 5, tech: 2, energy: -2 }, { mentoring: 2, integrity: 2, documentation: 1 }, [
        pending("junior_growth", 8, "新人后来主动补上了另一个模块的文档。", { influence: 3, energy: 2 }, { teamwork: 1 })
      ]),
      choice("b", "只指出问题，不提代码来源", ["权威", "回避"], "代码改好了，新人也学会了前辈从不犯错。", { influence: 2, communication: -2 }, { management: 1, integrity: -1 }),
      choice("c", "把它当作流程问题推动统一规范", ["系统", "治理"], "个人尴尬被转化成团队改进，只是会议比道歉长很多。", { communication: 4, influence: 3, energy: -3 }, { leadership: 1, documentation: 2 })
    ],
    { priority: 30, requirements: flag("mentoring") }
  ),
  event(
    "s2_x10_fire_drill",
    "stage_2_growth",
    "安全警报",
    "没人当真的事故演练",
    "演练通知提前发了，所有人都知道故障是假的。真正的问题是值班电话在一位离职同事那里。",
    [
      choice("a", "把演练当真，修正整条响应链", ["可靠", "治理"], "你们没有漂亮的演练成绩，却找出了五个真实漏洞。", { tech: 3, influence: 4, energy: -3 }, { crisisHandled: 2, reliability: 2, ownership: 1 }, [
        pending("real_incident", 10, "真正的故障到来时，更新后的响应链没有掉线。", { influence: 5, energy: 2 }, { reputation: 1 })
      ]),
      choice("b", "按脚本完成，先拿到合格结果", ["流程", "交付"], "演练准时结束，电话仍然打给了那个已经离职的人。", { influence: 2, energy: 1 }, { documentation: 1 }),
      choice("c", "提出不预告的下一次演练", ["挑战", "真实"], "团队短暂沉默，然后开始认真检查自己的联系方式。", { communication: 4, influence: 3, energy: -2 }, { leadership: 1, crisisHandled: 1 })
    ]
  ),

  event(
    "s3_x1_platform_migration",
    "stage_3_senior",
    "工程现场",
    "平台迁移没有回头路",
    "旧平台年底停止支持，新平台文档还在“持续完善”。业务希望无感迁移，两个平台都希望你先相信未来。",
    [
      choice("a", "分层迁移，让新旧系统并行一段时间", ["架构", "稳健"], "速度不快，但每次切换都能回答“失败后怎么办”。", { tech: 6, influence: 4, energy: -5 }, { architecture: 2, reliability: 2, ownership: 1 }, [
        pending("migration_compound", 8, "早期留下的兼容层让最后一批迁移比预计轻松。", { tech: 4, energy: 3 }, { reputation: 1 })
      ]),
      choice("b", "集中资源一次性切换", ["决断", "风险"], "切换夜像一场直播，成功时掌声很响，报警声也很响。", { tech: 5, influence: 5, energy: -9 }, { crisisHandled: 2, leadership: 1 }),
      choice("c", "争取延期，先把业务收益说清楚", ["谈判", "业务"], "你为团队换来时间，也让迁移第一次必须回答它究竟解决什么。", { communication: 5, savings: 3, influence: 2 }, { negotiation: 2, product: 1 })
    ]
  ),
  event(
    "s3_x2_privacy",
    "stage_3_senior",
    "伦理岔路",
    "隐私设计需要知道多少",
    "产品希望记录用户的每一次停留和犹豫，用来训练推荐。法律说可以，用户从未真正想过这个问题。",
    [
      choice("a", "默认最小采集，并把选择权交给用户", ["隐私", "长期"], "短期数据少了一些，团队却第一次能清楚解释自己收集了什么。", { tech: 4, communication: 4, savings: -2 }, { integrity: 3, customer: 2, product: 1 }, [
        pending("privacy_trust", 9, "一次外部审查中，克制的数据设计替公司省下了昂贵整改。", { savings: 5, influence: 4 }, { reputation: 1 })
      ]),
      choice("b", "先完整采集，等用户反对再调整", ["增长", "风险"], "模型指标上升了，删除数据的需求也开始排队。", { savings: 5, influence: 2, energy: -2 }, { product: 2, integrity: -2, customer: -1 }),
      choice("c", "拒绝参与，要求负责人书面决策", ["原则", "边界"], "你保护了自己的底线，却把设计权完整交给了别人。", { influence: -1, energy: 2, communication: 2 }, { integrity: 3, politics: 1 })
    ]
  ),
  event(
    "s3_x3_traffic_spike",
    "stage_3_senior",
    "工程现场",
    "流量突然涨了二十倍",
    "一位主播意外推荐了产品。新用户正在涌入，仪表盘像心电图，产品经理在问能不能趁机加个弹窗。",
    [
      choice("a", "启动降级，只保住最关键路径", ["可靠", "取舍"], "部分功能暂时消失，核心服务却撑过了最贵的十分钟。", { tech: 5, influence: 5, energy: -5 }, { crisisHandled: 2, reliability: 2, product: 1 }, [
        pending("spike_users", 6, "稳定体验留下了一批原本只打算看一眼的新用户。", { savings: 4, influence: 3 }, { customer: 1 })
      ]),
      choice("b", "全面扩容，不让任何功能掉线", ["投入", "成本"], "用户体验完整，账单也完整地多了一个零。", { influence: 4, savings: -9, energy: -3 }, { customer: 1, highPay: 1 }),
      choice("c", "暂时关闭注册，先保护老用户", ["边界", "稳健"], "系统平稳了，社交媒体上也出现了“为什么不让我进”的热门讨论。", { energy: 1, influence: -3 }, { reliability: 2, customer: 1 })
    ]
  ),
  event(
    "s3_x4_principal_mentor",
    "stage_3_senior",
    "成长回响",
    "导师只会反问",
    "资深专家同意指导你，但每次你问“该怎么做”，他都回答“你有哪些选择”。",
    [
      choice("a", "每次带着三个方案去讨论", ["判断", "成长"], "答案没有变容易，你形成答案的速度却越来越快。", { tech: 6, communication: 3, energy: -2 }, { learning: 2, architecture: 1, independence: 1 }, [
        pending("mentor_sponsor", 8, "导师开始在你不在场的会议里推荐你。", { influence: 5 }, { reputation: 1 })
      ]),
      choice("b", "要求更直接的标准答案", ["效率", "依赖"], "你少走了弯路，也很难判断这条路离开导师后是否还成立。", { tech: 4, energy: 2 }, { mentoring: 1, independence: -1 }),
      choice("c", "减少求助，靠自己证明能力", ["独立", "消耗"], "你解决了大部分问题，也重复踩了两个本可以被提醒的坑。", { tech: 4, energy: -5 }, { independence: 2, teamwork: -1 })
    ]
  ),
  event(
    "s3_x5_hiring_freeze",
    "stage_3_senior",
    "职场现实",
    "招聘冻结，目标没有冻结",
    "计划里的三名新人不会来了，发布日期仍写在墙上。负责人问大家能否“共同想办法”。",
    [
      choice("a", "削减范围，公开资源与目标的差距", ["沟通", "取舍"], "你放弃了几个漂亮功能，保住了团队对承诺的信任。", { communication: 5, influence: 4, energy: 1 }, { leadership: 2, product: 2, integrity: 1 }),
      choice("b", "带队冲刺，先把这个节点扛过去", ["担当", "消耗"], "节点过去了，团队看你的眼神同时包含敬佩和疲惫。", { influence: 5, energy: -10 }, { leadership: 1, burnout: 2, highPay: 1 }),
      choice("c", "用自动化替代原计划的人力", ["技术", "效率"], "你省下了一部分重复工作，也发现自动化本身需要一个人维护。", { tech: 6, energy: -4, influence: 2 }, { ownership: 2, adaptability: 1 })
    ]
  ),
  event(
    "s3_x6_build_or_buy",
    "stage_3_senior",
    "架构抉择",
    "自建还是采购",
    "供应商承诺两周接入，团队估算自建需要三个月。供应商没说涨价后会怎样，团队也没说维护五年会怎样。",
    [
      choice("a", "采购成熟服务，合同里锁定退出路径", ["谈判", "现实"], "你买到了速度，也为未来保留了一扇不便宜但能打开的门。", { communication: 4, savings: -4, energy: 2 }, { negotiation: 2, architecture: 1, product: 1 }),
      choice("b", "坚持自建，把核心能力留在内部", ["技术", "长期"], "上线推迟了，团队却真正掌握了这条能力链。", { tech: 7, influence: 3, energy: -7, savings: -2 }, { architecture: 2, ownership: 2 }),
      choice("c", "先采购验证，再逐步替换关键部分", ["平衡", "适应"], "两套方案并存了一阵，复杂度上升，但错误方向更早暴露。", { tech: 4, communication: 3, energy: -4 }, { adaptability: 2, product: 1 })
    ]
  ),
  event(
    "s3_x7_global_team",
    "stage_3_senior",
    "协作现场",
    "一句“没问题”引发的误会",
    "跨国同事说“应该没问题”，你以为已经承诺；对方以为只是礼貌地结束讨论。",
    [
      choice("a", "补一份明确的决策和责任记录", ["异步", "清晰"], "文字略显生硬，却让承诺不再依赖语气和文化猜谜。", { communication: 6, influence: 3 }, { documentation: 2, remote: 2, reliability: 1 }),
      choice("b", "把所有关键讨论改成实时会议", ["同步", "成本"], "误会少了，时差也开始成为固定参会人。", { communication: 3, energy: -6 }, { remote: 1, burnout: 1 }),
      choice("c", "私下了解对方的表达习惯", ["关系", "耐心"], "你没有制定新流程，却建立了一条更有温度的翻译通道。", { communication: 5, energy: -2 }, { networking: 2, teamwork: 1 })
    ]
  ),
  event(
    "s3_x8_internal_platform",
    "stage_3_senior",
    "产品视角",
    "给程序员做产品",
    "你负责内部开发平台。用户也是工程师，他们既会提需求，也会在群里直接贴出绕过你的脚本。",
    [
      choice("a", "观察真实工作流，再决定平台边界", ["用户", "平台"], "你删掉了两个自以为重要的页面，换来了真正被使用的命令。", { tech: 5, communication: 4, influence: 4 }, { customer: 2, product: 2, architecture: 1 }),
      choice("b", "先做统一而完整的平台标准", ["架构", "治理"], "平台很一致，使用者则一致地保留了自己的脚本。", { tech: 6, influence: 2, energy: -5 }, { architecture: 2, management: 1 }),
      choice("c", "提供模板和护栏，不强制迁移", ["赋能", "平衡"], "采用速度不快，但每个加入的团队都更愿意留下。", { tech: 4, communication: 3, influence: 3 }, { leadership: 1, teamwork: 2 })
    ]
  ),
  event(
    "s3_x9_ai_review",
    "stage_3_senior",
    "AI 回响",
    "AI 评审员一天提了四百条意见",
    "新工具能自动审代码。第一天它发现了两个真问题，也把变量命名风格讨论了三百九十八次。",
    [
      choice("a", "用真实误报数据调规则，保留人工决定", ["AI", "治理"], "意见变少了，信任开始上升；大家也更愿意认真看剩下的警告。", { tech: 5, influence: 4, energy: -3 }, { learning: 2, reliability: 2, management: 1 }, [
        pending("review_quality", 7, "被持续校准的评审规则逐渐成为团队质量资产。", { tech: 4, influence: 3 }, { documentation: 1 })
      ]),
      choice("b", "强制全部修复，先建立纪律", ["标准", "强硬"], "仓库非常整齐，评审者也学会了不看机器人意见直接点通过。", { influence: 3, energy: -6 }, { management: 2, teamwork: -1 }),
      choice("c", "停用工具，避免噪声伤害效率", ["效率", "保守"], "噪声消失了，两个真问题也跟着失去了提醒者。", { energy: 3, tech: 1 }, { balance: 1, adaptability: -1 })
    ],
    { priority: 31, requirements: flag("learning") }
  ),
  event(
    "s3_x10_accessibility_budget",
    "stage_3_senior",
    "伦理回响",
    "无障碍预算被划走",
    "季度预算只够做增长实验或无障碍改造。增长能写进周报，无法使用产品的人不会出现在活跃数据里。",
    [
      choice("a", "拿用户证据争取最低保障", ["用户", "原则"], "你没有赢得全部预算，但让无障碍第一次成为必须解释的取舍。", { communication: 6, influence: 4, energy: -3 }, { customer: 3, integrity: 2, negotiation: 1 }, [
        pending("accessibility_signal", 8, "被保留的基础改造帮助产品进入一个此前忽略的市场。", { savings: 4, influence: 3 }, { reputation: 1 })
      ]),
      choice("b", "接受增长优先，承诺下季度补上", ["业务", "延后"], "增长实验按时上线，承诺则进入了没有提醒日期的待办列表。", { savings: 4, influence: 2 }, { product: 2, integrity: -1 }),
      choice("c", "用团队余量悄悄完成关键改造", ["行动", "消耗"], "用户得到帮助，团队却为一项正确的事支付了隐形加班。", { tech: 3, influence: 2, energy: -7 }, { customer: 2, ownership: 1, burnout: 1 })
    ],
    { priority: 33, requirements: flag("customer") }
  ),

  event(
    "s4_x1_ai_mandate",
    "stage_4_core",
    "AI 时代",
    "全公司的 AI 提效指标",
    "管理层宣布所有团队必须提升三成研发效率。指标很明确，什么叫效率仍在生成中。",
    [
      choice("a", "先测量交付瓶颈，再选择 AI 场景", ["判断", "治理"], "你没有最快提交工具采购单，却最早拿出了可信的前后对比。", { tech: 4, communication: 4, influence: 5, energy: -3 }, { learning: 2, management: 2, product: 1 }, [
        pending("ai_case_study", 8, "务实的改造方案被其他团队复制，你成了内部案例而非宣传口号。", { influence: 6 }, { reputation: 2 })
      ]),
      choice("b", "全面推广，以使用率推动习惯改变", ["变革", "速度"], "使用率迅速达标，真实收益和隐藏返工还在统计口径里争论。", { influence: 5, energy: -5 }, { adaptability: 2, management: 2, politics: 1 }),
      choice("c", "公开质疑指标，拒绝为了数字使用工具", ["原则", "风险"], "不少工程师私下赞同你，管理层则要求你下周带着替代方案回来。", { communication: 5, influence: 2, energy: -3 }, { integrity: 2, politics: 2 })
    ],
    { priority: 34, requirements: flag("learning") }
  ),
  event(
    "s4_x2_breach_disclosure",
    "stage_4_core",
    "伦理回响",
    "数据泄露要说多少",
    "安全团队确认部分用户数据外泄。公关建议等调查完整再说，用户的密码不会等调查报告。",
    [
      choice("a", "先通知受影响用户，再持续更新事实", ["透明", "责任"], "第一封通知并不完美，却让用户能立刻保护自己。", { communication: 5, influence: 3, savings: -4, energy: -5 }, { integrity: 4, crisisHandled: 2, customer: 2 }, [
        pending("trust_after_breach", 9, "透明处置没有消除损失，却保住了最难重建的信任。", { influence: 6, savings: 2 }, { reputation: 2 })
      ]),
      choice("b", "等全部调查完成后统一发布", ["谨慎", "控制"], "声明非常完整，只是部分用户从媒体那里更早知道了自己受影响。", { communication: 2, energy: -2 }, { crisisHandled: 1, integrity: -1 }),
      choice("c", "严格按最低法律义务披露", ["合规", "自保"], "公司控制住了短期叙事，长期搜索结果却替你保存了这次选择。", { savings: 3, influence: -4 }, { politics: 2, integrity: -2, customer: -1 })
    ],
    { priority: 36, requirements: flag("crisisHandled") }
  ),
  event(
    "s4_x3_after_layoffs",
    "stage_4_core",
    "职场现实",
    "裁员之后的周一",
    "空工位还没有收走，目标已经重新分配。留下的人既庆幸又愧疚，还要参加“重新出发”会议。",
    [
      choice("a", "先承认不安，再重新谈目标和容量", ["团队", "诚实"], "你没能给出所有答案，但没有要求大家假装什么都没发生。", { communication: 7, influence: 4, energy: -3 }, { leadership: 3, integrity: 2, teamwork: 2 }),
      choice("b", "稳定军心，尽快让工作恢复正常", ["管理", "执行"], "节奏恢复得很快，离职网站的访问量也没有降下来。", { influence: 4, energy: -2 }, { management: 2, politics: 1 }),
      choice("c", "主动联系离开的同事提供帮助", ["关系", "长期"], "你无法改变决定，却保留了比组织关系更长的同行关系。", { communication: 5, energy: -2, influence: 2 }, { networking: 3, integrity: 1 })
    ]
  ),
  event(
    "s4_x4_arch_council",
    "stage_4_core",
    "架构抉择",
    "架构委员会的第七张票",
    "六位负责人三比三僵持。你的票决定采用统一平台，还是允许团队继续自治。",
    [
      choice("a", "支持统一，但设置明确例外机制", ["治理", "平衡"], "标准终于能推进，例外也不必靠地下通道存在。", { communication: 5, influence: 6, energy: -3 }, { architecture: 2, management: 2, negotiation: 1 }),
      choice("b", "支持自治，让结果证明路线", ["独立", "创新"], "团队保住了速度，也把整合成本留给了未来的跨团队项目。", { tech: 3, influence: 3 }, { independence: 2, adaptability: 2 }),
      choice("c", "要求补充实验数据后再投票", ["证据", "耐心"], "会议没有得到想要的即时答案，却第一次同意了共同的评价标准。", { tech: 3, communication: 4, energy: -2 }, { reliability: 1, integrity: 1 })
    ]
  ),
  event(
    "s4_x5_toxic_star",
    "stage_4_core",
    "团队现场",
    "明星工程师的坏脾气",
    "他解决了最难的问题，也让三名新人不敢在评审里发言。业务负责人提醒你：他真的非常重要。",
    [
      choice("a", "明确反馈并设置不可越过的行为边界", ["管理", "公平"], "短期气氛更紧张，沉默的人却开始重新开口。", { communication: 6, influence: 4, energy: -4 }, { leadership: 3, integrity: 2, management: 2 }, [
        pending("team_voice", 7, "更多人开始贡献方案，团队不再只有一个技术声音。", { tech: 3, influence: 4 }, { teamwork: 2 })
      ]),
      choice("b", "保护核心产出，私下安抚其他成员", ["业务", "妥协"], "季度交付保住了，团队把真正的意见移到了没有他的群。", { savings: 4, influence: 2, energy: -3 }, { politics: 2, teamwork: -2 }),
      choice("c", "把他调到独立项目，减少协作摩擦", ["安排", "隔离"], "冲突少了，他的知识也跟着成为了一个更大的单点。", { energy: 2, tech: 1 }, { management: 2, reliability: -1 })
    ]
  ),
  event(
    "s4_x6_observability",
    "stage_4_core",
    "工程现场",
    "看不见的系统最省预算",
    "业务问为什么要花一季度完善监控：“系统现在不是好好的吗？”恰好你也拿不出过去没发生事故的截图。",
    [
      choice("a", "用故障成本和盲区演示争取投入", ["沟通", "可靠"], "你把“看不见”变成了可以计价的风险。", { communication: 5, influence: 5, energy: -3 }, { reliability: 3, ownership: 1 }, [
        pending("observability_return", 8, "新监控提前发现了一次缓慢恶化，避免了高峰期停机。", { savings: 6, influence: 4 }, { reputation: 1 })
      ]),
      choice("b", "在现有需求里顺手补监控", ["务实", "隐形工作"], "覆盖率慢慢上升，只是团队容量表从未承认这项工作存在。", { tech: 4, energy: -5 }, { reliability: 2, burnout: 1 }),
      choice("c", "接受优先级，等出现事故再立项", ["业务", "现实"], "预算没有被占用，风险也没有因此取消预约。", { savings: 3, energy: 1 }, { product: 1, crisisHandled: -1 })
    ]
  ),
  event(
    "s4_x7_vendor_lock",
    "stage_4_core",
    "商业现实",
    "云厂商把价格改了",
    "核心服务明年涨价四成。迁移成本很高，留下的成本写得更清楚。",
    [
      choice("a", "拿真实迁移方案去重新谈判", ["谈判", "准备"], "供应商第一次相信你真的能离开，折扣也第一次像个数字。", { communication: 6, savings: 7, energy: -4 }, { negotiation: 3, architecture: 1 }),
      choice("b", "立即启动多云改造", ["独立", "成本"], "你买到了选择权，也买到了两套账单和两套故障方式。", { tech: 6, savings: -7, energy: -7 }, { independence: 2, architecture: 2 }),
      choice("c", "接受涨价，把精力放在核心业务", ["聚焦", "现实"], "团队没有被迁移拖住，利润表替你记住了这次决定。", { energy: 4, savings: -5, influence: 1 }, { product: 2 })
    ]
  ),
  event(
    "s4_x8_blame_review",
    "stage_4_core",
    "团队现场",
    "复盘报告要不要写名字",
    "高层要求明确“谁导致了事故”。你知道有一个直接操作人，也知道系统允许一次操作摧毁全部防线。",
    [
      choice("a", "写清行为，不把个人当根因", ["系统", "公平"], "报告没有满足猎巫冲动，却推动了真正能阻止复发的改动。", { communication: 5, tech: 3, influence: 4 }, { integrity: 3, crisisHandled: 2, reliability: 2 }),
      choice("b", "按要求标明责任人和处分建议", ["问责", "秩序"], "高层得到了明确答案，值班人员开始尽量避免做任何高风险决定。", { influence: 4, communication: -3 }, { management: 2, politics: 2, teamwork: -2 }),
      choice("c", "拒绝提交，要求由独立团队复盘", ["原则", "对抗"], "你保护了程序正义，也把自己放进了下一场高层会议。", { influence: 2, energy: -4, communication: 3 }, { integrity: 3, politics: 2 })
    ]
  ),
  event(
    "s4_x9_zero_downtime",
    "stage_4_core",
    "工程现场",
    "零停机迁移的最后一夜",
    "双写已经运行三周，数据差异只剩万分之一。业务说可以切，工程师知道万分之一也有姓名。",
    [
      choice("a", "继续追完差异，推迟最终切换", ["质量", "耐心"], "你错过了宣传窗口，却没有让那批用户替团队完成验收。", { tech: 5, influence: 2, energy: -4 }, { reliability: 3, integrity: 1 }),
      choice("b", "按计划切换，并准备快速补偿", ["决断", "风险"], "迁移准时完成，补偿脚本也准时拥有了真实用户。", { influence: 5, energy: -6, savings: -2 }, { crisisHandled: 2, leadership: 1 }),
      choice("c", "只迁移低风险用户，继续灰度", ["稳健", "复杂度"], "风险被摊薄，团队则多维护了一段时间的三套状态。", { tech: 4, energy: -5 }, { architecture: 2, adaptability: 1 })
    ],
    { priority: 30, requirements: flag("architecture") }
  ),
  event(
    "s4_x10_successor",
    "stage_4_core",
    "团队回响",
    "接班人否定了你的方案",
    "你培养的同事在评审会上公开指出，现有路线已经落后。更麻烦的是，他的证据很充分。",
    [
      choice("a", "支持他继续论证，并公开修正自己", ["传承", "诚实"], "你的方案输了，团队对不同意见的安全感赢了。", { communication: 5, influence: 5, energy: -2 }, { mentoring: 3, integrity: 2, leadership: 2 }, [
        pending("successor_ready", 9, "接班人独立扛住了一次关键决策，你终于不再是唯一答案。", { energy: 5, influence: 3 }, { management: 1 })
      ]),
      choice("b", "私下认可，但要求会上保持一致", ["权威", "秩序"], "方向最终调整了，他也学会了正确意见需要先通过层级。", { influence: 3, communication: -2 }, { management: 2, politics: 1 }),
      choice("c", "坚持原方案，避免团队频繁摇摆", ["稳定", "保守"], "短期路线很清楚，下一次事实更新却只会来得更贵。", { influence: 2, tech: -2 }, { reliability: 1, adaptability: -1 })
    ],
    { priority: 33, requirements: flag("mentoring") }
  ),

  event(
    "s5_x1_cofounder",
    "stage_5_fork",
    "创业岔路",
    "联合创始人的深夜电话",
    "前同事说机会窗口只有半年，产品已经有客户，只差一个能把技术和团队都扛起来的人。工资也只差一大截。",
    [
      choice("a", "加入，拿时间和积蓄换可能性", ["创业", "冒险"], "你获得了决定方向的权力，也失去了下个月一定会发生什么的答案。", { influence: 7, savings: -10, energy: -6 }, { entrepreneurship: 4, leadership: 2, ownership: 2 }, [
        pending("startup_customer", 6, "第一个真正付费的客户到来，证明这不是只有创始人喜欢的点子。", { savings: 6, influence: 4 }, { product: 2 })
      ]),
      choice("b", "先以顾问身份合作，验证彼此", ["试探", "稳健"], "你保留了主业，也让合作在真实压力下先跑了一个小版本。", { communication: 4, savings: 3, energy: -5 }, { entrepreneurship: 2, networking: 2, independence: 1 }),
      choice("c", "拒绝，把稳定留给当前生活", ["边界", "生活"], "机会继续向前，你也第一次没有把“错过”自动翻译成“失败”。", { energy: 6, savings: 3 }, { balance: 3, integrity: 1 })
    ],
    { priority: 36, requirements: flag("ownership") }
  ),
  event(
    "s5_x2_creator",
    "stage_5_fork",
    "影响力支线",
    "有人请你把经验做成课",
    "平台说你的职业分享很受欢迎，愿意包装成付费课程。大纲里甚至已经写好了“七天成为架构师”。",
    [
      choice("a", "做一门诚实但不保证速成的课程", ["分享", "长期"], "销量没有标题党夸张，学员的问题却迫使你重新理解了很多旧经验。", { communication: 6, savings: 5, influence: 6, energy: -5 }, { visibility: 3, mentoring: 2, integrity: 2 }, [
        pending("student_network", 7, "曾经的学员在新的团队里继续引用你的方法。", { influence: 5 }, { reputation: 2 })
      ]),
      choice("b", "免费写成系列文章", ["开放", "社区"], "收入少了，内容传播得更远，也收到更多无法批改的作业。", { communication: 4, influence: 7, energy: -4 }, { openSource: 2, visibility: 3 }),
      choice("c", "拒绝，把精力留给真实项目", ["聚焦", "边界"], "你的经验没有被包装，项目也获得了一个没有录课的周末。", { tech: 3, energy: 5 }, { balance: 2, reliability: 1 })
    ],
    { priority: 32, requirements: flag("visibility") }
  ),
  event(
    "s5_x3_oss_funding",
    "stage_5_fork",
    "社区回响",
    "开源项目收到一笔资助",
    "基金会愿意支持你维护一年。金额够认真投入，却不够让所有现实问题消失。",
    [
      choice("a", "减少主业，全力改善社区基础设施", ["开源", "投入"], "发布节奏更稳了，你也第一次把维护劳动当成真正的工作。", { tech: 5, influence: 8, savings: -3, energy: -3 }, { openSource: 4, independence: 2, reputation: 2 }, [
        pending("community_growth", 7, "更健康的维护流程吸引了新的长期贡献者。", { influence: 5, energy: 3 }, { teamwork: 2 })
      ]),
      choice("b", "继续业余维护，把资助用于贡献者", ["社区", "分配"], "你没有成为唯一明星，项目却拥有了更多能独立做决定的人。", { influence: 6, energy: -4, savings: 2 }, { openSource: 3, leadership: 2, mentoring: 1 }),
      choice("c", "把项目商业化，寻找可持续收入", ["商业", "长期"], "用户开始讨论许可证，你开始讨论发票。社区和公司需要新的边界。", { savings: 7, influence: 3, energy: -5 }, { entrepreneurship: 2, product: 2, openSource: 1 })
    ],
    { priority: 38, requirements: flag("openSource") }
  ),
  event(
    "s5_x4_overseas_remote",
    "stage_5_fork",
    "人生变量",
    "一份跨国远程职位",
    "薪资更高、技术栈更新，也意味着每天有一半同事活在你的夜里。合同里还有三页税务名词。",
    [
      choice("a", "接受，把生活也迁移到新节奏", ["远程", "机会"], "收入和视野一起扩大，孤独也获得了更稳定的网络连接。", { savings: 9, tech: 4, energy: -5 }, { remote: 4, adaptability: 2, highPay: 2 }),
      choice("b", "争取三个月试用和固定重叠时间", ["谈判", "平衡"], "你没有假装时差不存在，而是让合作先证明它能进入生活。", { communication: 6, savings: 5, energy: -2 }, { remote: 3, negotiation: 2, balance: 2 }, [
        pending("remote_fit", 6, "试运行证明了边界可行，你获得了长期远程安排。", { energy: 3, savings: 3 }, { independence: 1 })
      ]),
      choice("c", "拒绝，不让高薪决定作息", ["生活", "取舍"], "报价过期了，你的晚上仍属于自己。", { energy: 7, savings: -2 }, { balance: 3, integrity: 1 })
    ],
    { priority: 34, requirements: flag("remote") }
  ),
  event(
    "s5_x5_consulting",
    "stage_5_fork",
    "独立支线",
    "独立咨询的第一位客户",
    "客户愿意为两周诊断付出你一个月的工资，也希望你顺便“保证系统以后不出问题”。",
    [
      choice("a", "明确范围、风险和交付边界", ["谈判", "专业"], "你少卖了一个不可能的承诺，多建立了一段可以续约的信任。", { communication: 6, savings: 7, influence: 4, energy: -4 }, { independence: 3, negotiation: 2, integrity: 2 }, [
        pending("consulting_referral", 6, "客户把你推荐给了另一家公司，独立路线出现了第二个支点。", { savings: 6, influence: 4 }, { networking: 2 })
      ]),
      choice("b", "先接下来，用结果证明自己", ["行动", "风险"], "你交付了很多额外工作，也学会合同里的模糊会变成日历里的具体。", { tech: 4, savings: 6, energy: -8 }, { independence: 2, burnout: 1 }),
      choice("c", "介绍给更合适的同行并收顾问费", ["网络", "取舍"], "你没有亲自解决问题，却开始像经营能力网络一样经营职业。", { communication: 4, savings: 3, influence: 3 }, { networking: 3, entrepreneurship: 1 })
    ],
    { priority: 33, requirements: flag("networking") }
  ),
  event(
    "s5_x6_acquisition",
    "stage_5_fork",
    "创意回响",
    "有人想收购你的副项目",
    "报价足以覆盖两年生活，但对方计划关闭免费版。那些陪项目长大的用户还不知道这场谈判。",
    [
      choice("a", "出售，但谈下用户迁移和数据保护条款", ["谈判", "责任"], "你获得了退出回报，也没有把用户当成报价表里的附赠品。", { savings: 12, communication: 5, influence: 3 }, { entrepreneurship: 2, integrity: 2, negotiation: 2 }),
      choice("b", "拒绝，继续独立经营", ["独立", "长期"], "你保住了方向，也继续承担每一次宕机和续费提醒。", { influence: 5, energy: -5, savings: 2 }, { independence: 4, sideProject: 3, product: 1 }, [
        pending("indie_growth", 7, "拒绝收购后，稳定增长让项目真正成为一门小生意。", { savings: 7, influence: 4 }, { entrepreneurship: 2 })
      ]),
      choice("c", "接受最高报价，及时兑现成果", ["财富", "现实"], "账户余额让你松了口气，老用户的告别邮件则让这次成功有了重量。", { savings: 15, energy: 4, influence: -2 }, { highPay: 3, entrepreneurship: 1, customer: -1 })
    ],
    { priority: 40, requirements: flag("sideProject") }
  ),
  event(
    "s5_x7_caregiving",
    "stage_5_fork",
    "人生变量",
    "家庭照护需要你稳定出现",
    "一位家人进入长期恢复期。安排可以外包一部分，但陪伴无法完全写进服务合同。",
    [
      choice("a", "主动调整岗位和工作强度", ["家庭", "边界"], "职业速度慢了下来，生活里重要的人却不再只能等你的空档。", { energy: 6, savings: -4, influence: -2 }, { balance: 4, integrity: 2 }),
      choice("b", "维持工作，用积蓄购买照护支持", ["现实", "责任"], "你保住了职业连续性，也第一次认真计算时间和金钱如何互相替代。", { savings: -8, energy: -2, influence: 2 }, { highPay: 1, reliability: 1 }),
      choice("c", "和团队坦白，共同设计弹性安排", ["沟通", "信任"], "你没有独自扛住所有事，团队也获得了一套更适合真实人生的制度。", { communication: 6, energy: 4, influence: 3 }, { leadership: 2, teamwork: 2, remote: 1 }, [
        pending("care_policy", 5, "弹性安排后来也帮助了其他正经历生活变化的同事。", { influence: 4 }, { reputation: 1 })
      ])
    ]
  ),
  event(
    "s5_x8_public_interest",
    "stage_5_fork",
    "价值岔路",
    "公益技术项目的邀请",
    "项目能帮助基层机构减少重复录入，预算只有商业项目的三分之一，需求复杂度却没有打折。",
    [
      choice("a", "加入，把成熟工程方法带过去", ["价值", "用户"], "收入下降了，代码第一次直接改变了你能叫出名字的一群人。", { savings: -7, influence: 6, energy: -4 }, { integrity: 3, customer: 3, leadership: 1 }),
      choice("b", "保留主业，以固定时间提供技术支持", ["平衡", "贡献"], "进度不快，但项目获得了持续而不是燃烧式的帮助。", { influence: 4, energy: -5, savings: 1 }, { balance: 2, mentoring: 2, integrity: 2 }, [
        pending("social_impact", 6, "项目稳定运行后，更多机构开始复用这套方案。", { influence: 5 }, { reputation: 1 })
      ]),
      choice("c", "帮助对方寻找更匹配的资金与团队", ["网络", "现实"], "你没有亲自写代码，却让资源找到了真正能长期承担它的人。", { communication: 5, influence: 3 }, { networking: 3, product: 1 })
    ],
    { priority: 31, requirements: flag("integrity") }
  ),
  event(
    "s5_x9_ai_pivot",
    "stage_5_fork",
    "AI 时代",
    "创业项目突然要“全面 AI 化”",
    "投资人认为原产品故事不够性感，建议两周内加入大模型。客户只关心原来的问题能不能解决。",
    [
      choice("a", "只在能改善用户结果的环节使用 AI", ["产品", "克制"], "演示少了几个炫目的动画，留存却第一次跟上了宣传。", { tech: 5, influence: 4, savings: 3 }, { product: 3, customer: 2, integrity: 2 }),
      choice("b", "快速转向，先拿到下一轮资源", ["资本", "速度"], "发布会很成功，团队接下来需要把演示里的未来补成现实。", { savings: 8, influence: 7, energy: -8 }, { entrepreneurship: 3, politics: 2, burnout: 1 }),
      choice("c", "拒绝追风口，继续原来的价值主张", ["原则", "独立"], "融资难度上升了，产品也避免变成一张会聊天的贴纸。", { influence: 2, savings: -4, energy: 2 }, { integrity: 3, independence: 2 })
    ],
    { priority: 32, requirements: flag("product") }
  ),
  event(
    "s5_x10_four_day",
    "stage_5_fork",
    "管理实验",
    "四天工作制试验",
    "公司允许一个团队试行三个月，但产出目标不变。所有人都支持，直到要决定哪些会议和需求不再做。",
    [
      choice("a", "减少并行项目，用结果衡量而非在线时长", ["管理", "聚焦"], "工作日少了一天，优先级讨论反而终于变得真实。", { communication: 5, energy: 7, influence: 4 }, { management: 3, balance: 4, product: 2 }, [
        pending("four_day_proof", 6, "试验数据证明产出没有下降，制度被扩大到更多团队。", { influence: 5, energy: 3 }, { reputation: 1 })
      ]),
      choice("b", "压缩同样工作到四天完成", ["效率", "消耗"], "周五自由了，周一到周四则像把五天塞进一个压缩包。", { influence: 3, energy: -6 }, { management: 1, burnout: 2 }),
      choice("c", "不参加试验，避免团队承担额外风险", ["稳健", "保守"], "节奏没有改变，你也失去了一次用数据改变制度的机会。", { energy: 2, influence: -2 }, { reliability: 1 })
    ],
    { priority: 33, requirements: flag("management") }
  ),

  event(
    "s6_x1_ai_role",
    "stage_6_answer",
    "AI 时代",
    "职位说明被 AI 重写了",
    "公司重新定义高级岗位：少写代码，多设计人和 AI 如何一起工作。你熟悉的价值证明方式正在过期。",
    [
      choice("a", "主动重塑角色，把判断力变成新核心", ["适应", "领导"], "你写的代码变少了，负责的问题却更接近真正的系统边界。", { communication: 5, influence: 7, tech: 2 }, { adaptability: 3, leadership: 2, learning: 2 }),
      choice("b", "继续深挖难以替代的底层技术", ["技术", "专注"], "工具改变了工作表面，你把自己扎进了仍需要长期积累的深水区。", { tech: 8, influence: 3, energy: -3 }, { architecture: 3, independence: 2 }),
      choice("c", "抵制变化，守住成熟的工程方式", ["稳定", "保守"], "你的质量标准仍然可靠，机会却逐渐用新的词汇发布。", { tech: 3, energy: 2, influence: -3 }, { reliability: 2, adaptability: -2 })
    ],
    { priority: 35, requirements: flag("learning") }
  ),
  event(
    "s6_x2_oss_fork",
    "stage_6_answer",
    "社区回响",
    "开源社区分裂成两个分支",
    "商业化方向引发争议。双方都希望你站队，你的名字也出现在两边的贡献名单里。",
    [
      choice("a", "推动公开治理，接受慢一点的共识", ["开源", "治理"], "争论没有消失，但决定不再只发生在私聊和公司会议里。", { communication: 7, influence: 7, energy: -5 }, { openSource: 4, leadership: 2, integrity: 2 }),
      choice("b", "选择资源更强的一方保证项目存活", ["现实", "商业"], "版本更新继续了，一部分老贡献者也永远停在了分叉点。", { savings: 6, influence: 5 }, { entrepreneurship: 2, politics: 2, openSource: 1 }),
      choice("c", "退出治理，只保留技术贡献", ["边界", "独立"], "你避开了权力争斗，也把社区方向交给了更愿意争取的人。", { tech: 5, energy: 3, influence: -2 }, { independence: 2, openSource: 2 })
    ],
    { priority: 38, requirements: flag("openSource") }
  ),
  event(
    "s6_x3_algorithm_law",
    "stage_6_answer",
    "伦理岔路",
    "新法规要求解释算法",
    "系统必须向用户说明为什么得到这个结果。团队能解释模型的大致逻辑，却解释不了每一个具体决定。",
    [
      choice("a", "重构产品，让不可解释时也允许人工复核", ["责任", "用户"], "自动化比例下降了一点，错误决定却终于有了出口。", { tech: 5, communication: 4, savings: -3 }, { integrity: 4, customer: 3, product: 2 }),
      choice("b", "生成符合法规的标准说明文本", ["合规", "效率"], "审查通过了，用户得到了一段正确但没有帮助的话。", { savings: 4, influence: 2 }, { politics: 2, documentation: 1 }),
      choice("c", "暂停高风险功能，等待技术成熟", ["边界", "稳健"], "增长停了一段，团队也没有让不确定性继续替人做重要决定。", { influence: -1, energy: 3, savings: -2 }, { integrity: 3, reliability: 2 })
    ],
    { priority: 34, requirements: flag("product") }
  ),
  event(
    "s6_x4_board_metric",
    "stage_6_answer",
    "价值岔路",
    "董事会不想看那条红色指标",
    "关键指标连续下降。负责人建议先换一种统计方式，“避免市场误解短期波动”。数字没有错，只是讲法可以选择。",
    [
      choice("a", "坚持同时展示原指标和解释", ["透明", "风险"], "会议不轻松，但所有决定至少建立在同一份现实上。", { communication: 6, influence: 4, energy: -4 }, { integrity: 4, leadership: 2, reputation: 1 }),
      choice("b", "接受新口径，争取时间修复问题", ["政治", "现实"], "图表变好看了，问题则获得了一个季度的隐身时间。", { influence: 5, savings: 3 }, { politics: 3, integrity: -2 }),
      choice("c", "拒绝签字，把决定升级给审计", ["原则", "代价"], "你保护了记录，也可能亲手关闭了自己在这家公司的上升通道。", { influence: 2, savings: -3, energy: -3 }, { integrity: 4, independence: 2, politics: 2 })
    ]
  ),
  event(
    "s6_x5_legacy_shutdown",
    "stage_6_answer",
    "工程回响",
    "旧系统的最后一个夜班",
    "你曾经害怕触碰的系统终于要关机。最后一批流量归零后，机房里没有烟花，只有风扇声慢慢变轻。",
    [
      choice("a", "完整归档决策、事故和迁移经验", ["传承", "记录"], "系统结束了，它教过团队的东西没有一起断电。", { tech: 4, influence: 5, energy: -2 }, { documentation: 4, mentoring: 2, reliability: 2 }),
      choice("b", "确认关机后安静离开", ["告别", "边界"], "不是每次完成都需要庆典。你把这一晚留给自己。", { energy: 6, influence: 1 }, { balance: 2, integrity: 1 }),
      choice("c", "把最后一个组件开源留作纪念", ["开源", "社区"], "公司系统消失了，其中一小段代码却开始了第二次生命。", { tech: 3, influence: 6 }, { openSource: 3, reputation: 1 })
    ],
    { priority: 32, requirements: flag("reliability") }
  ),
  event(
    "s6_x6_mentee_lead",
    "stage_6_answer",
    "团队回响",
    "被你带过的人成了负责人",
    "她邀请你参加第一次重大评审，也明确说希望最后由她做决定。",
    [
      choice("a", "只提关键问题，把决定权留给她", ["传承", "信任"], "你第一次清楚地看到，影响力不一定需要出现在最终署名里。", { communication: 5, influence: 6, energy: 3 }, { mentoring: 4, leadership: 2, integrity: 1 }),
      choice("b", "给出完整方案，帮她降低第一次风险", ["保护", "经验"], "项目更稳了，她也需要再等一次真正独立承担的机会。", { tech: 4, influence: 3 }, { mentoring: 2, management: 1 }),
      choice("c", "完全退出，让她自行建立权威", ["边界", "独立"], "你避免了干预，也错过了提供安全网而不抢方向盘的练习。", { energy: 4, influence: -1 }, { balance: 1, independence: 2 })
    ],
    { priority: 39, requirements: flag("mentoring") }
  ),
  event(
    "s6_x7_public_controversy",
    "stage_6_answer",
    "影响力回响",
    "一句旧演讲被截成了二十秒",
    "多年前的技术判断被重新传播，脱离上下文后像是在支持一件你并不认同的事。",
    [
      choice("a", "公开完整上下文，也承认判断变化", ["表达", "成长"], "不是所有人都接受解释，但你的立场不再由剪辑替你定义。", { communication: 7, influence: 4, energy: -4 }, { integrity: 3, adaptability: 2, reputation: 1 }),
      choice("b", "不回应，让热度自然过去", ["克制", "边界"], "争议确实降温了，那二十秒也成为了部分人唯一认识你的方式。", { energy: 5, influence: -3 }, { balance: 2 }),
      choice("c", "要求平台删除并追究传播者", ["权利", "对抗"], "部分内容下架了，争议也因为“被删除”获得了第二轮传播。", { communication: 2, savings: -3, energy: -5 }, { politics: 2, reputation: -1 })
    ],
    { priority: 34, requirements: flag("visibility") }
  ),
  event(
    "s6_x8_health_report",
    "stage_6_answer",
    "人生变量",
    "体检报告上的红字",
    "医生没有谈职业理想，只说这些指标不会因为项目重要就暂停累积。",
    [
      choice("a", "立刻停下来，重新安排工作和恢复", ["健康", "边界"], "项目由别人接手，世界没有停，你的睡眠终于开始修复。", { energy: 14, influence: -3, savings: -2 }, { balance: 5, burnout: -1 }),
      choice("b", "完成关键节点后再休息", ["责任", "延后"], "你又撑过了一个节点，身体也把提醒升级成了更明确的版本。", { influence: 4, energy: -8 }, { reliability: 1, burnout: 3 }),
      choice("c", "调整日常节奏，不做戏剧化离开", ["持续", "平衡"], "变化不够适合发朋友圈，却更可能真的持续下去。", { energy: 8, influence: 1 }, { balance: 4, management: 1 })
    ],
    { priority: 120, requirements: stat("energy", "lte", 28) }
  ),
  event(
    "s6_x9_standards",
    "stage_6_answer",
    "行业支线",
    "行业标准委员会的席位",
    "你可以参与制定未来几年所有团队都要遵守的规则。会议很多，代码很少，影响很慢。",
    [
      choice("a", "加入，把一线经验带进规则", ["行业", "影响"], "你写的不是产品功能，却可能改变无数团队默认怎么做。", { communication: 6, influence: 9, energy: -5 }, { reputation: 3, leadership: 2, documentation: 2 }),
      choice("b", "只担任技术顾问，不进入治理", ["技术", "边界"], "你提供了专业判断，也避开了大部分程序和妥协。", { tech: 5, influence: 4, energy: -2 }, { reputation: 2, balance: 1 }),
      choice("c", "拒绝，继续做离用户更近的事", ["产品", "聚焦"], "行业规则由别人书写，你则继续听见真实用户的下一条反馈。", { energy: 4, communication: 2 }, { customer: 2, product: 2 })
    ],
    { priority: 33, requirements: flag("reputation") }
  ),
  event(
    "s6_x10_two_offers_again",
    "stage_6_answer",
    "职业回环",
    "新人拿着两份 Offer 来找你",
    "一份钱多但节奏凶，一份成长稳但起薪低。问题和你当年几乎一样，答案却已经不再属于你。",
    [
      choice("a", "讲自己的代价，不替对方做决定", ["导师", "诚实"], "经验没有变成标准答案，而是帮助另一个人看清自己愿意承担什么。", { communication: 7, influence: 5, energy: 2 }, { mentoring: 4, integrity: 2, leadership: 1 }),
      choice("b", "根据对方阶段给出明确建议", ["判断", "负责"], "新人获得了方向，你也承担了建议可能改变别人几年生活的重量。", { communication: 5, influence: 4 }, { mentoring: 3, reputation: 1 }),
      choice("c", "建议继续谈判，不必接受二选一", ["谈判", "可能"], "你把当年学会的第三种答案交给了后来的人。", { communication: 6, influence: 4 }, { negotiation: 3, mentoring: 2 })
    ]
  )
];

module.exports = Object.freeze(EXTRA_EVENTS);
