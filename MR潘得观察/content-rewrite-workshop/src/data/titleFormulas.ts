/**
 * 标题公式配置
 *
 * 各平台标题公式的详细说明，用于标题选择时的气泡展示
 */

// 公式详情类型
export interface FormulaDetail {
  name: string;           // 公式名称
  structure: string;      // 公式结构
  description: string;    // 公式描述
  example: string;        // 示例标题
  applicable: string;     // 适用范围
}

// 公众号公式配置
export const gzhTitleFormulas: Record<string, FormulaDetail> = {
  '颠覆认知型': {
    name: '颠覆认知型',
    structure: '你以为X，其实是Y',
    description: '通过打破用户固有认知，引发好奇心和震惊感，促使用户点击寻求真相',
    example: '《你以为努力就能成功？其实大多数人都选错了方向》',
    applicable: '认知类、成长类、职场类内容',
  },
  '痛点共鸣型': {
    name: '痛点共鸣型',
    structure: '痛点场景 + 解决方案暗示',
    description: '精准戳中用户痛点，让用户感到"这就是我"，产生共鸣和认同感',
    example: '《30岁还一事无成？你缺的不是努力，是这3个认知》',
    applicable: '情感类、职场类、心理类内容',
  },
  '悬念钩子型': {
    name: '悬念钩子型',
    structure: '不说透，留悬念',
    description: '只说一半，让用户好奇后续发展，忍不住点击查看',
    example: '《那个从来不加班的同事，最近却天天早退，直到我看到了...》',
    applicable: '故事类、人物类、经历类内容',
  },
  '数字清单型': {
    name: '数字清单型',
    structure: '数字 + 价值承诺',
    description: '用具体数字增加可信度，让用户觉得内容有结构、有干货',
    example: '《5个微习惯，让我从拖延症变成行动派》',
    applicable: '干货类、方法类、清单类内容',
  },
  '身份标签型': {
    name: '身份标签型',
    structure: '人群标签 + 专属内容',
    description: '精准定位目标人群，让目标用户觉得"这是专门写给我的"',
    example: '《内向者的社交指南：不必变外向，也能有好人缘》',
    applicable: '垂直人群、细分领域内容',
  },
  '热点借力型': {
    name: '热点借力型',
    structure: '热点事件 + 独特观点',
    description: '借势热点流量，叠加个人独特解读，吸引关注',
    example: '《从某明星离婚事件，看职场中的契约精神》',
    applicable: '热点评论、观点输出类内容',
  },
  '对话口语型': {
    name: '对话口语型',
    structure: '像朋友聊天',
    description: '降低距离感，像朋友间的对话，自然亲切',
    example: '《跟你说个事，你别不信》',
    applicable: '情感类、随笔类、观点类内容',
  },
  '金句前置型': {
    name: '金句前置型',
    structure: '金句 + 主题',
    description: '用一句有力量的话先抓住用户，再展开内容',
    example: '《人生不是轨道，是旷野》',
    applicable: '情感类、哲理类、成长类内容',
  },
};

// 小红书公式配置
export const xhsTitleFormulas: Record<string, FormulaDetail> = {
  '痛点+解决方案': {
    name: '痛点+解决方案',
    structure: '被X困扰，X方法救了我',
    description: '先描述痛苦经历，再给出解决方案，让用户看到希望',
    example: '《被拖延症困扰多年，这3个方法救了我》',
    applicable: '干货、方法、改变类内容',
  },
  '身份+专属内容': {
    name: '身份+专属内容',
    structure: '精准人群 + 实用内容',
    description: '用身份标签精准锁定目标用户，让目标用户产生认同',
    example: '《打工人必看！这份职场保命指南越早知道越好》',
    applicable: '特定人群、垂直领域内容',
  },
  '数字+价值': {
    name: '数字+价值',
    structure: 'X个X / X天 / X本书',
    description: '具体数字增加可信度和价值感，让用户觉得值得收藏',
    example: '《读了30本书，这3本彻底改变了我的人生观》',
    applicable: '书单、干货、清单类内容',
  },
  '情绪+共鸣': {
    name: '情绪+共鸣',
    structure: '强烈情绪词 + 共鸣内容',
    description: '用情绪强烈的词汇引发共鸣，让用户感到被理解',
    example: '《破防了！这段话说到我心里去了》',
    applicable: '情感、共鸣、故事类内容',
  },
  '悬念+反转': {
    name: '悬念+反转',
    structure: '说一半 + 留悬念',
    description: '只揭示部分信息，引发好奇心，促使用户点击',
    example: '《原来我一直理解错了，真正的自律是这样的》',
    applicable: '认知颠覆、反常识类内容',
  },
  '对比+冲击': {
    name: '对比+冲击',
    structure: 'X vs Y / X和X的差距',
    description: '通过强烈对比制造冲击感，吸引眼球',
    example: '《月薪3000和30000的人，差距到底在哪里》',
    applicable: '职场、情感、观点类内容',
  },
};

// 抖音公式配置
export const douyinTitleFormulas: Record<string, FormulaDetail> = {
  '反常识开头': {
    name: '反常识开头',
    structure: '你以为X，其实Y',
    description: '用反常识的观点打破用户固有认知，制造震惊感',
    example: '《你以为努力就能成功？其实大多数人都努力错了方向》',
    applicable: '认知类、成长类观点输出',
  },
  '强情绪开头': {
    name: '强情绪开头',
    structure: '太扎心！/ 听完后我沉默了...',
    description: '用强情绪词开场，迅速调动用户情绪',
    example: '《太扎心了！原来我不是懒，是这个原因》',
    applicable: '情感类、共鸣类、观点类',
  },
  '悬念钩子开头': {
    name: '悬念钩子开头',
    structure: '我终于知道为什么... / ...的秘密',
    description: '用悬念引发好奇，让用户想知道答案',
    example: '《我终于知道为什么我总是焦虑了》',
    applicable: '知识类、揭秘类、教程类',
  },
  '身份锁定开头': {
    name: '身份锁定开头',
    structure: 'X岁以上的人... / ...的人别划走',
    description: '用身份标签精准筛选目标用户，提高互动率',
    example: '《25岁到35岁的人，建议认真听完这段话》',
    applicable: '职场、情感、成长类内容',
  },
  '冲突矛盾开头': {
    name: '冲突矛盾开头',
    structure: 'X却Y / X和X的差距',
    description: '用矛盾冲突制造张力，吸引眼球',
    example: '《他月薪3000，却比我月薪3万过得还幸福》',
    applicable: '情感类、职场类、社会观察',
  },
  '数字冲击开头': {
    name: '数字冲击开头',
    structure: '只用了X天 / X个人中只有1个...',
    description: '用具体数字制造冲击感和紧迫感',
    example: '《只用了3天，我就彻底改变了拖延症》',
    applicable: '方法类、教程类、成果展示',
  },
  '直接提问开头': {
    name: '直接提问开头',
    structure: '你有没有发现... / 为什么你总是...',
    description: '用问题引发思考，让用户自我代入',
    example: '《你有没有发现，越努力越焦虑》',
    applicable: '情感类、职场类、心理学',
  },
  '结果前置开头': {
    name: '结果前置开头',
    structure: '看完这个，你会... / 学会这招，...',
    description: '先给出结果承诺，激发用户期待',
    example: '《看完这个视频，你会彻底告别拖延症》',
    applicable: '方法类、教程类、结果展示',
  },
  '情绪爆发开头': {
    name: '情绪爆发开头',
    structure: '直接播放最精彩/最感人的片段',
    description: '跳过铺垫，直接呈现最抓眼球的内容',
    example: '（直接播放最精彩的3秒片段）',
    applicable: '剧情类、情感类、娱乐类',
  },
  '场景代入开头': {
    name: '场景代入开头',
    structure: '具体场景描述',
    description: '用具体场景让用户产生代入感',
    example: '《凌晨2点，我又失眠了，躺在床上想...》',
    applicable: '情感类、生活类、故事类',
  },
};

// 获取平台的公式配置
export function getFormulaConfig(platformId: string): Record<string, FormulaDetail> {
  switch (platformId) {
    case 'gzh':
      return gzhTitleFormulas;
    case 'xhs':
      return xhsTitleFormulas;
    case 'douyin':
      return douyinTitleFormulas;
    default:
      return gzhTitleFormulas;
  }
}

// 获取公式详情
export function getFormulaDetail(platformId: string, formulaType: string): FormulaDetail | null {
  const formulas = getFormulaConfig(platformId);
  return formulas[formulaType] || null;
}
