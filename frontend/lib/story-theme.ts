import type { NewsCard } from './types';

export type StoryWorld = 'orbital' | 'cinematic' | 'pastoral' | 'castle' | 'noir' | 'laboratory' | 'oceanic';

export interface StoryTheme {
  world: StoryWorld;
  label: string;
  accent: string;
  secondary: string;
  ink: string;
  atmosphere: string;
  motif: string;
}

const WORLDS: Record<StoryWorld, Omit<StoryTheme, 'world'>> = {
  orbital: { label: 'ORBITAL INTELLIGENCE', accent: '#8ff7ff', secondary: '#805dff', ink: '#f4fbff', atmosphere: '深空观测站', motif: '轨道、星图与遥测信号' },
  cinematic: { label: 'CINEMATIC FILE', accent: '#ffb45f', secondary: '#d84235', ink: '#fff7e8', atmosphere: '史诗电影片场', motif: '胶片、探照灯与巨幕字幕' },
  pastoral: { label: 'FIELD NOTES', accent: '#e9da95', secondary: '#799e78', ink: '#fffdf2', atmosphere: '北美旷野档案馆', motif: '山脊、风与手写观察札记' },
  castle: { label: 'THE GRAND ARCHIVE', accent: '#e8c778', secondary: '#6d1f39', ink: '#fff8e7', atmosphere: '中欧城堡议事厅', motif: '纹章、穹顶与古老契约' },
  noir: { label: 'MARKET NOIR', accent: '#f2dc91', secondary: '#137878', ink: '#fffbea', atmosphere: '午夜金融城', motif: '雨幕、霓虹与交易密电' },
  laboratory: { label: 'SPECIMEN / LIVE', accent: '#a8ffcf', secondary: '#19a6a2', ink: '#effff8', atmosphere: '未来实验室', motif: '神经网络、玻璃舱与数据脉冲' },
  oceanic: { label: 'ABYSSAL SIGNAL', accent: '#8ddcff', secondary: '#2b5b9b', ink: '#effaff', atmosphere: '深海情报站', motif: '潮汐、声呐与幽蓝生物光' },
};

export function getStoryTheme(card: NewsCard): StoryTheme {
  const directed = card.visual_direction?.world;
  let world: StoryWorld = directed && WORLDS[directed] ? directed : 'cinematic';
  if (!directed) {
    const text = `${card.title} ${card.summary || ''} ${card.interest_tags?.join(' ')}`.toLowerCase();
    if (/卫星|太空|航天|orbital|space/.test(text)) world = 'orbital';
    else if (/银行|金融|交易|市场|监管|融资/.test(text)) world = 'noir';
    else if (/模型|ai|智能体|芯片|实验|openai/.test(text)) world = 'laboratory';
    else if (/历史|欧洲|英国|政策|政府|贵族/.test(text)) world = 'castle';
    else if (/农业|气候|能源|生态|乡村/.test(text)) world = 'pastoral';
    else if (/海洋|航运|港口/.test(text)) world = 'oceanic';
  }
  const base = WORLDS[world];
  return {
    world,
    ...base,
    accent: card.visual_direction?.accent || base.accent,
    secondary: card.visual_direction?.secondary || base.secondary,
    atmosphere: card.visual_direction?.mood || base.atmosphere,
    motif: card.visual_direction?.motif || base.motif,
  };
}

export function getAnalysisSections(card: NewsCard) {
  if (card.analysis_sections?.length) return card.analysis_sections;
  return [
    { title: '事件的真正含义', thesis: card.why_it_matters || '这不只是一条孤立消息。', explanation: card.background || card.summary || '请结合原始信息源继续查证。', evidence: card.key_facts?.join('；') },
    { title: '行业结构如何被推动', thesis: '观察资源、能力和议价权流向谁。', explanation: card.why_it_matters || '后续需要关注参与者是否把一次动作变成长期能力。', implication: '把新闻放进行业链条中，才知道它改变的是效率、成本、规则还是竞争门槛。' },
    { title: '把它变成求职知识', thesis: card.career_lens || '用这条新闻建立岗位与技能之间的连接。', explanation: '面试时不要只复述标题，可以说明事件背景、关键约束、受益与承压方，以及你会如何验证后续影响。' },
  ];
}
