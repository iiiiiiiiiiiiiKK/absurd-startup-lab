import type { CategoryData } from '../lib/types';

/**
 * 素材库 B 组：学习 / 职场 / AI 自动化 / 创作者
 */
export const CATEGORY_B: CategoryData[] = [
  {
    id: 'learning',
    label: '学习成长',
    emoji: '📚',
    blurb: '知识焦虑、技能投资与「学过就忘」的生意。',
    unit: '个知识点',
    audiences: [
      {
        label: '收藏了 300 个课程、完成率 4% 的自我提升爱好者',
        short: '课程收藏家',
        trait: '囤课比上课积极',
        tags: ['learning', 'routine', 'anxiety'],
      },
      {
        label: '想学英语十年、开口次数为零的成年人',
        short: '英语重启者',
        trait: '输入多，输出零',
        tags: ['learning', 'language', 'anxiety'],
      },
      {
        label: '转行在即、需要在三个月内掌握新技能的职场人',
        short: '转行者',
        trait: '时间紧、目标明确',
        tags: ['learning', 'work', 'anxiety'],
      },
      {
        label: '每天通勤 90 分钟、想把这时间用起来的人',
        short: '通勤学习者',
        trait: '碎片时间丰富',
        tags: ['learning', 'time', 'routine'],
      },
      {
        label: '看完书就忘、连目录都想不起来的人',
        short: '阅读失忆者',
        trait: '输入没有沉淀',
        tags: ['learning', 'memory', 'routine'],
      },
    ],
    pains: [
      {
        label: '收藏夹里全是课程，打开率不到 5%',
        detail: '收藏这个动作会让人产生「已经学过」的错觉。',
        tags: ['learning', 'routine', 'anxiety'],
      },
      {
        label: '学了三个月，还是不敢开口说一句',
        detail: '输入可以独自完成，输出必须有对象。',
        tags: ['learning', 'language', 'anxiety'],
      },
      {
        label: '学完就忘，笔记从来没回头看',
        detail: '没有复习触发点，记忆自然清零。',
        tags: ['learning', 'memory', 'routine'],
      },
      {
        label: '不知道该学什么，学的都是别人说该学的东西',
        detail: '目标不明确时，任何内容都显得有道理。',
        tags: ['learning', 'anxiety', 'decision'],
      },
      {
        label: '通勤时间全用来刷短视频，回过神来很愧疚',
        detail: '碎片时间需要更轻的入口，而不是更重的课程。',
        tags: ['learning', 'time', 'routine'],
      },
    ],
    mechanics: [
      {
        label: '输出倒逼输入',
        action: '每天不给你课程，只给你一个必须回答的问题，答完才解锁下一段材料',
        why: '学习留存率取决于输出，而不是观看时长',
        tags: ['learning', 'language', 'memory'],
      },
      {
        label: '间隔复习调度',
        action: '把你记下的任何一条笔记，按遗忘曲线安排 4 次回顾，每次只需 40 秒',
        why: '忘记不是因为记性差，是因为没人提醒你在正确的时间看',
        tags: ['learning', 'memory', 'routine'],
      },
      {
        label: '通勤音频切片',
        action: '把学习材料切成 4 分钟一段，专门适配一段地铁行程，配一句可复述的总结',
        why: '碎片时间的利用率取决于内容的颗粒度',
        tags: ['learning', 'time', 'routine'],
      },
      {
        label: '目标反推路径',
        action: '从「三个月后要能做什么」反推每周任务，砍掉所有与目标无关的内容',
        why: '技能焦虑来自路径不清，而不是内容不够',
        tags: ['learning', 'work', 'decision', 'anxiety'],
      },
      {
        label: '真人陪练匹配',
        action: '每天匹配一个同水平的人，只聊 10 分钟，互相纠正一次',
        why: '输出必须有对象，而陌生人比熟人更适合练手',
        tags: ['learning', 'language', 'social'],
      },
    ],
    features: [
      { text: '问题优先模式：进入产品先答题，答完才给你看材料' },
      { text: '遗忘曲线提醒：每条笔记自动排 4 次回顾，每次 40 秒' },
      { text: '通勤切片：把任何材料切成 4 分钟一段并生成一句话总结' },
      { text: '三个月反推表：输入目标，输出每周该做什么、该砍掉什么' },
      { text: '10 分钟陪练：每天匹配一个同水平的人做一次输出' },
      { text: '收藏夹清道夫：定期提醒你删掉半年没打开的课程，减轻负债感' },
    ],
    pricing: [
      { model: '订阅制', detail: '基础复习调度免费，陪练与目标反推为付费项' },
      { model: '陪练次数包', detail: '按次购买真人陪练时长，用完再买，无订阅压力' },
      { model: '企业培训采购', detail: '打包卖给需要内部技能升级的公司，按席位计价' },
    ],
    channels: [
      { name: '学习类社群', play: '在考研 / 转行群里做免费「目标反推」活动，输出可复用表格' },
      { name: '知识区博主合作', play: '把产品做成博主的复习工具，出现在视频流程里' },
      { name: '高校与训练营', play: '与转行训练营合作，作为结课后的复习系统' },
      { name: '职场社区内容', play: '发布「我如何用 4 分钟切片学完一门课」的实证记录' },
    ],
    wilds: [
      '我们不提供课程，我们只提供「你必须说点什么」的压力。',
      '产品的成功指标是用户开口次数，不是观看时长。',
      '我们主动劝用户退掉 70% 的课，因为剩下的已经学不完了。',
      '我们不做学习计划，我们做的是「学习债务清算」。',
    ],
    investorQuestions: [
      '教育类产品的完课率普遍很低，你能给出真实数据吗？',
      '内容自己不做，靠什么保证质量？',
      '用户学完之后会离开吗？复购从哪里来？',
    ],
    dreadQuestions: [
      '如果用户发现学了也没用，你会承认这一点吗？',
      '你自己的收藏夹清空了吗？',
    ],
    taglines: [
      '不给你课程，只给你一个问题。',
      '把遗忘曲线装进通勤路。',
      '先砍掉 70% 的课，再谈学习。',
      '输出一次，胜过收藏一百次。',
    ],
    names: {
      prefixes: ['', '四分钟', '反推', '输出', '遗忘', '轻'],
      cores: ['开口', '复习', '切片', '反推', '忘不了', '说一句', '清算'],
      suffixes: ['训练营', '循环', '助手', '路径', '实验室', '计划'],
    },
  },

  {
    id: 'workplace',
    label: '职场生存',
    emoji: '💼',
    blurb: '关于周报、会议、老板语气与同事关系的生意。',
    unit: '次会议',
    audiences: [
      {
        label: '每周要写三份周报、每份都要假装有进展的打工人',
        short: '周报苦手',
        trait: '干活八小时，写报两小时',
        tags: ['work', 'routine', 'anxiety'],
      },
      {
        label: '一天开五个会、最后一个会才决定正事的人',
        short: '会议受害者',
        trait: '时间被别人的日历占据',
        tags: ['work', 'time', 'meeting'],
      },
      {
        label: '看不懂老板语气、每天都在猜意图的新人',
        short: '职场新人',
        trait: '信息不对称严重',
        tags: ['work', 'anxiety', 'communication'],
      },
      {
        label: '同时对接 6 个部门、天天当传声筒的项目经理',
        short: '项目经理',
        trait: '协调成本极高',
        tags: ['work', 'communication', 'manager'],
      },
      {
        label: '想提离职但不敢开口、已经想了 11 个月的人',
        short: '犹豫离职者',
        trait: '决策被恐惧拖住',
        tags: ['work', 'decision', 'anxiety'],
      },
    ],
    pains: [
      {
        label: '周报写不出来，因为这一周真的没什么进展',
        detail: '周报要求「有内容」，但工作本身是波动的。',
        tags: ['work', 'routine', 'communication'],
      },
      {
        label: '会议开完没有结论，任务还是回到自己身上',
        detail: '会议的成本由不发言的人承担。',
        tags: ['work', 'meeting', 'time'],
      },
      {
        label: '老板说「你看着办」，你不知道该办到哪一步',
        detail: '模糊指令的代价全在执行方。',
        tags: ['work', 'communication', 'anxiety'],
      },
      {
        label: '跨部门沟通要靠反复转述，信息每次都会丢 20%',
        detail: '传声筒结构天然失真。',
        tags: ['work', 'communication', 'manager'],
      },
      {
        label: '想离职但不知道外面什么情况，于是一直拖着',
        detail: '不确定性比不满更让人难受。',
        tags: ['work', 'decision', 'anxiety'],
      },
    ],
    mechanics: [
      {
        label: '工作痕迹自动归档',
        action: '自动收集你这一周真实做过的事（提交、评审、文档、会议），生成一版周报草稿',
        why: '周报难写的核心是「回忆成本」，而不是没有内容',
        tags: ['work', 'routine', 'communication'],
      },
      {
        label: '会议结论强制器',
        action: '会议结束前 3 分钟自动弹出三个问题：结论是什么、谁负责、什么时候交',
        why: '没有结论的会议，成本会以隐形方式转移到执行者身上',
        tags: ['work', 'meeting', 'manager'],
      },
      {
        label: '指令澄清器',
        action: '把模糊指令整理成三个具体选项，让你带着方案去确认，而不是带着疑问去执行',
        why: '向上管理的本质是把模糊成本还给决策者',
        tags: ['work', 'communication', 'anxiety'],
      },
      {
        label: '跨部门共同底稿',
        action: '所有转述都基于同一份可追溯的文档，每次修改留痕并通知相关人',
        why: '转述失真的解法是取消转述，而不是提高转述技巧',
        tags: ['work', 'communication', 'manager'],
      },
      {
        label: '离职沙盘',
        action: '用公开数据与同岗位样本估算离职后的现金流与机会窗口，生成一份不带情绪的判断',
        why: '犹豫来自没有数字，有了数字才有勇气',
        tags: ['work', 'decision', 'anxiety'],
      },
    ],
    features: [
      { text: '周报草稿机：自动汇总本周痕迹，生成三版语气（保守 / 中性 / 积极）' },
      { text: '会议三问：结束前强制确认结论、负责人、截止时间' },
      { text: '指令澄清卡：把「你看着办」翻译成三个可选项' },
      { text: '共同底稿：所有跨部门信息只有一份源头，改一次同步全员' },
      { text: '离职沙盘：用公开数据估算现金流与机会窗口，只出结论不出建议' },
      { text: '老板语气翻译器：把一句话拆成「事实 / 情绪 / 期待」三层' },
    ],
    pricing: [
      { model: '个人订阅', detail: '按月订阅，周报与会议功能为核心付费点' },
      { model: '团队版', detail: '按席位计价，团队共享共同底稿与会议结论归档' },
      { model: '一次性工具包', detail: '离职沙盘等低频功能单独买断，不做长期订阅' },
    ],
    channels: [
      { name: '职场社区（脉脉 / 即刻）', play: '发布「周报自动生成前后对比」，用真实截图引流' },
      { name: '企业内训与 HR 渠道', play: '把会议效率工具卖给管理者，个人端靠口碑扩散' },
      { name: '职场博主测评', play: '给 5 个职场博主开放团队版，换取真实测评' },
      { name: '免费模板引流', play: '先送周报模板和会议纪要模板，再引导到工具' },
    ],
    wilds: [
      '我们的目标是让周报从两小时压缩到八分钟，剩下的时间你可以用来真正做事。',
      '产品会自动标注「本周无实质进展」，因为我们相信诚实比修辞更有价值。',
      '我们不做绩效考核，我们只做记录——因为记录本身就足够有说服力。',
      '如果管理者不喜欢这个产品，说明它起作用了。',
    ],
    investorQuestions: [
      '职场工具的付费方是公司还是个人？两个都要的结果往往是两个都不买。',
      '接入企业系统（飞书 / 钉钉）的门槛你怎么过？',
      '员工会不会担心这个工具被用来监控自己？',
    ],
    dreadQuestions: [
      '如果公司用它来考核员工，你还愿意卖吗？',
      '你上一次真实地跟老板说「这周没进展」是什么时候？',
    ],
    taglines: [
      '周报两小时，八分钟写完。',
      '让会议在结束前有结论。',
      '把「你看着办」翻译成三个选项。',
      '为不擅长汇报的人做一个翻译器。',
    ],
    names: {
      prefixes: ['', '八分钟', '会后', '本周', '透明', '轻'],
      cores: ['周报', '结论', '澄清', '底稿', '看着办', '痕迹', '留痕'],
      suffixes: ['助手', '工作台', '协议', '工具', '流水线', '局'],
    },
  },

  {
    id: 'aiwork',
    label: 'AI 自动化',
    emoji: '🤖',
    blurb: '把重复劳动交给流水线，让人只做判断的那部分。',
    unit: '条任务',
    audiences: [
      {
        label: '每天复制粘贴 200 次、已经形成肌肉记忆的运营',
        short: '重复劳动运营',
        trait: '工作量取决于数据量',
        tags: ['work', 'automation', 'routine'],
      },
      {
        label: '一个人负责全流程的小团队主理人',
        short: '小团队主理人',
        trait: '所有岗位都是自己',
        tags: ['work', 'automation', 'freelancer'],
      },
      {
        label: '要处理上千条用户反馈、但只有两只手的产品经理',
        short: '反馈处理者',
        trait: '信息量超出处理能力',
        tags: ['work', 'automation', 'decision'],
      },
      {
        label: '每天整理表格到晚上十点的财务 / 数据岗',
        short: '表格整理员',
        trait: '规则明确但极其繁琐',
        tags: ['work', 'automation', 'money'],
      },
      {
        label: '想用 AI 但不知道怎么开始的传统行业老板',
        short: '想用 AI 的老板',
        trait: '知道有用但不知道用在哪',
        tags: ['work', 'automation', 'decision'],
      },
    ],
    pains: [
      {
        label: '同一套操作每天重复几十遍，一整天就没了',
        detail: '这些动作规则明确，却没有被自动化。',
        tags: ['work', 'automation', 'routine'],
      },
      {
        label: '信息太多，处理完一批又来一批，永远在追',
        detail: '人工处理速度是硬上限。',
        tags: ['work', 'automation', 'decision'],
      },
      {
        label: '试过一堆 AI 工具，最后还是要手动改一遍',
        detail: '输出质量不稳定，反而增加了校验成本。',
        tags: ['work', 'automation', 'anxiety'],
      },
      {
        label: '流程里有一步只能靠老员工的经验，人一走就断',
        detail: '经验没有沉淀成规则。',
        tags: ['work', 'automation', 'manager'],
      },
      {
        label: '想上 AI 但不知道从哪个环节切入',
        detail: '缺少低风险的试点方式。',
        tags: ['work', 'automation', 'decision'],
      },
    ],
    mechanics: [
      {
        label: '人机分工流水线',
        action: '把流程拆成「模型做 / 规则做 / 人确认」三段，每段都有明确的失败回落路径',
        why: '自动化的最大风险不是不准，是错了却没人知道',
        tags: ['work', 'automation', 'decision'],
      },
      {
        label: '批量处理 + 差异报告',
        action: '一次处理上千条，只把其中 5% 需要人判断的挑出来给你看',
        why: '人的注意力应该花在例外上，而不是常态上',
        tags: ['work', 'automation', 'routine'],
      },
      {
        label: '规则提取器',
        action: '观察老员工的操作顺序，把隐含经验整理成可检查的规则清单',
        why: '经验没有被写下来，就等于不存在',
        tags: ['work', 'automation', 'manager'],
      },
      {
        label: '校验双轨制',
        action: '每条输出都附一条「依据」，模型与规则各自打分，不一致时主动上报',
        why: '信任来自可验证，而不是准确率数字',
        tags: ['work', 'automation', 'anxiety'],
      },
      {
        label: '一周试点包',
        action: '不改动现有系统，先用一周时间在单个环节做影子运行，用真实数据对比',
        why: '传统企业的阻力来自风险，降低风险比讲道理有效',
        tags: ['work', 'automation', 'decision'],
      },
    ],
    features: [
      { text: '三段式流水线编排：模型、规则、人工确认各司其职' },
      { text: '例外队列：只把需要人判断的 5% 挑出来，其余自动通过' },
      { text: '依据溯源：每条结果都能点回原始输入' },
      { text: '影子模式：先在旁边跑一个月，不接管流程，只出对比报告' },
      { text: '经验规则提取：把口头流程整理成可检查清单' },
      { text: '成本护栏：单批处理超预算自动暂停' },
    ],
    pricing: [
      { model: '按量计费', detail: '按处理条数结算，含基础订阅额度，超出部分阶梯降价' },
      { model: '影子试点包', detail: '固定价格的一周试点，含对比报告，可抵扣后续订阅' },
      { model: '企业年框', detail: '按年预付额度，含私有化部署与规则梳理服务' },
    ],
    channels: [
      { name: '行业社群与案例内容', play: '发布「一条流程从 4 小时到 12 分钟」的真实前后对比' },
      { name: '系统集成商合作', play: '与做 ERP / CRM 实施的集成商分成，进入他们的客户名单' },
      { name: '免费诊断工具', play: '做一个「你的流程有多少可以自动化」的在线测评引流' },
      { name: '老板社群与线下沙龙', play: '办小规模闭门会，现场拆解一个真实流程' },
    ],
    wilds: [
      '我们不承诺替代人，我们只承诺把最无聊的那 80% 拿走。',
      '产品的失败模式是「主动停下并找你」，这比假装成功更有价值。',
      '我们对外公开失败案例的比例，因为客户最想知道的是边界在哪。',
      '我们的护城河是 4000 条人工修正过的边缘样例，而不是模型本身。',
    ],
    investorQuestions: [
      '模型厂商把这个能力做成原生功能，你怎么办？',
      '你的毛利率在推理成本下降后是变好还是变差？',
      '客户付费买的是「省人力」还是「用了 AI」？前者要证明 ROI，后者不可持续。',
    ],
    dreadQuestions: [
      '如果你的产品真的省掉了一半人力，那些人的位置怎么办？',
      '你自己的公司在用 AI 做这些事吗？',
    ],
    taglines: [
      '把最无聊的 80% 拿走，人只做判断。',
      '让 AI 干活，让你验收。',
      '不接管流程，先跑一个月影子。',
      '一条流水线，替代 200 次复制粘贴。',
    ],
    names: {
      prefixes: ['', 'Auto', 'Agent', '影子', '例外', '三段'],
      cores: ['流水线', '例外', '影子', '复制粘贴', '验收', '批处理', '规则'],
      suffixes: ['引擎', '流水线', 'Agent', '工作台', '平台', '系统'],
    },
  },

  {
    id: 'creator',
    label: '创作者经济',
    emoji: '🎬',
    blurb: '选题、剪辑、更新频率与「断更羞耻」的生意。',
    unit: '条内容',
    audiences: [
      {
        label: '一年发了 12 条内容、每条都改 30 遍的小创作者',
        short: '小创作者',
        trait: '完美主义拖慢更新',
        tags: ['creator', 'routine', 'anxiety'],
      },
      {
        label: '选题想到凌晨、最后发了条日常的博主',
        short: '选题困难博主',
        trait: '灵感不稳定',
        tags: ['creator', 'idea', 'anxiety'],
      },
      {
        label: '断更三个月、不敢打开后台的人',
        short: '断更者',
        trait: '羞耻感大于创作欲',
        tags: ['creator', 'anxiety', 'routine'],
      },
      {
        label: '所有平台都发、每个平台都要改一版的独立内容人',
        short: '全平台分发者',
        trait: '重复劳动极多',
        tags: ['creator', 'automation', 'routine'],
      },
      {
        label: '粉丝 5000、接不到广告但还在坚持的腰部创作者',
        short: '腰部创作者',
        trait: '有流量无变现',
        tags: ['creator', 'money', 'anxiety'],
      },
    ],
    pains: [
      {
        label: '一条内容改 30 遍，改到最后自己都不想发了',
        detail: '完美主义导致的生产周期无限延长。',
        tags: ['creator', 'routine', 'anxiety'],
      },
      {
        label: '选题比剪辑更累，经常想一整天',
        detail: '灵感没有系统，只能靠等。',
        tags: ['creator', 'idea', 'anxiety'],
      },
      {
        label: '断更之后越来越不敢发，最后彻底停更',
        detail: '恢复发布的心理成本随时间指数增长。',
        tags: ['creator', 'anxiety', 'routine'],
      },
      {
        label: '一条内容要适配 4 个平台，重复改 4 遍',
        detail: '平台差异带来的重复劳动没有工具承接。',
        tags: ['creator', 'automation', 'routine'],
      },
      {
        label: '有粉丝但不知道怎么变现，只能等品牌找上门',
        detail: '变现路径不清晰，缺乏可定价的产品。',
        tags: ['creator', 'money', 'decision'],
      },
    ],
    mechanics: [
      {
        label: '强制发布闸门',
        action: '设定发布时间后，系统在到点前 10 分钟锁定编辑权限，到点自动发布',
        why: '完美主义的解药不是自律，是取消继续修改的选项',
        tags: ['creator', 'routine', 'anxiety'],
      },
      {
        label: '选题矩阵',
        action: '从你的历史内容里抽取 20 个可复用选题角度，每周给你 5 个带钩子的具体题目',
        why: '灵感不是等来的，是从素材库里重组出来的',
        tags: ['creator', 'idea', 'routine'],
      },
      {
        label: '复更阶梯',
        action: '断更后不要求你发正式内容，只要求发一条 20 字的动态，逐步恢复',
        why: '复出的门槛必须低到无法拒绝',
        tags: ['creator', 'anxiety', 'routine'],
      },
      {
        label: '一稿多平台',
        action: '一次输入，自动改写为 4 个平台的原生格式，并保留每个平台的人工终审',
        why: '重复劳动可以被砍掉，但风格判断不能',
        tags: ['creator', 'automation', 'routine'],
      },
      {
        label: '变现拆解器',
        action: '根据粉丝画像给出三条可立刻测试的变现路径，每条附最小验证动作',
        why: '变现卡在「不知道第一步做什么」',
        tags: ['creator', 'money', 'decision'],
      },
    ],
    features: [
      { text: '发布闸门：到点锁死编辑，自动发布，杜绝第 31 版' },
      { text: '选题矩阵：每周 5 个带钩子的具体题目，来自你自己的素材库' },
      { text: '复更阶梯：断更后从 20 字动态开始，三天一级' },
      { text: '一稿四改：一次输入，四个平台格式，人工终审后分发' },
      { text: '变现沙盘：三条路径 + 每条的最小验证动作' },
      { text: '创作账本：记录每条内容的投入时间与实际回报，帮你砍掉低效形式' },
    ],
    pricing: [
      { model: '订阅制', detail: '按月订阅，含发布闸门与选题矩阵，多平台分发另计' },
      { model: '按条计费', detail: '只在大促或更新冲刺期买量，不绑定长期订阅' },
      { model: '收入分成（可选）', detail: '变现沙盘带来的直接收入按比例分成，上限写入合同' },
    ],
    channels: [
      { name: '创作者社群', play: '在创作者群里做「断更复出陪跑」，用真实案例做内容' },
      { name: '公开构建', play: '把自己用这个工具更新账号的过程做成内容，产品即案例' },
      { name: '平台官方活动', play: '参与平台创作激励计划，作为官方推荐工具出现' },
      { name: 'MCN 合作', play: '给中小 MCN 提供团队版，批量覆盖旗下创作者' },
    ],
    wilds: [
      '我们不相信「内容为王」，我们相信「发出来为王」。',
      '产品上线第一天就删掉了草稿箱功能，因为草稿箱是拖延的庇护所。',
      '我们的成功指标是用户发布次数，不是内容质量评分——质量交给观众判断。',
      '我们允许你发一条很烂的内容，只要它被发出来了。',
    ],
    investorQuestions: [
      '创作者工具的付费能力两极分化，你怎么覆盖长尾？',
      '平台政策一变，你的分发能力还剩多少？',
      '用户成长起来之后会不会直接离开？',
    ],
    dreadQuestions: [
      '如果用户按你的方法发了很多内容却没人看，你负责吗？',
      '你自己账号多久没更新了？',
    ],
    taglines: [
      '不追求完美，只追求发出去。',
      '删掉草稿箱，今天就能发。',
      '选题不用等灵感，每周五个。',
      '断更三个月，从 20 个字开始。',
    ],
    names: {
      prefixes: ['', '到点', '一稿', '复更', '发布', '不完美'],
      cores: ['发布', '选题', '断更', '一稿', '发出去', '复出', '第31版'],
      suffixes: ['闸门', '矩阵', '助手', '工作台', '计划', '实验室'],
    },
  },
];
