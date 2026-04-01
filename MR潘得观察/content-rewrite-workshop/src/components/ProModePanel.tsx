import { useState, useEffect } from 'react';
import {
  Sparkles,
  Target,
  Edit3,
  Check,
  X,
  ArrowRight,
  AlertCircle,
  Wand2,
  HelpCircle,
} from 'lucide-react';
import { hasApiConfig, getApiConfigError } from '../services/llm/llmService';
import { promptRouter } from '../services/promptRouter';
import type { StreamingChunk } from '../services/llm/types';
import { useSettingsStore } from '../stores/settingsStore';
import { getFormulaDetail } from '../data/titleFormulas';
import { PlatformProgressBar } from './ui/ProgressBar';
import gzhIcon from '../assets/公众号.png';
import xhsIcon from '../assets/小红书.jpg';
import dyIcon from '../assets/抖音.jpg';

interface Title {
  id: number;
  content: string;
  type: string;
  score: number;
}

interface PlatformData {
  platform: string;
  title: string;
  content: string;
  coverPrompt: string;
  coverStyles: string[];
}

interface ProModePanelProps {
  inputContent: string;
  analysisResult: any;
  preInfo?: {
    platform: string;
    contentType: string;
    track: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  };
  onGenerate: (data: {
    platformsData: PlatformData[];
  }) => void;
  onBack: () => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

export default function ProModePanel({
  inputContent,
  analysisResult,
  preInfo,
  onGenerate,
  onBack,
  isGenerating,
  setIsGenerating,
}: ProModePanelProps) {
  const testMode = useSettingsStore((state) => state.testMode);

  // 专业模式独立状态
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [titleCount, setTitleCount] = useState<number>(5);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [selectedTitles, setSelectedTitles] = useState<number[]>([]);
  const [editedTitles, setEditedTitles] = useState<{ [key: number]: string }>({});
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCoverStyles, setSelectedCoverStyles] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_generationSteps, setGenerationSteps] = useState<{ step: string; status: 'pending' | 'success' | 'error' }[]>([]);
  const [showPlatformTip, setShowPlatformTip] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  // 流式内容状态 - 按平台存储实时显示内容
  const [streamingContents, setStreamingContents] = useState<{ [platform: string]: string }>({});

  // 生成的标题，按平台分组
  const [platformTitles, setPlatformTitles] = useState<{ [platformId: string]: Title[] }>({});

  // 生成结果预览状态
  const [showPreview, setShowPreview] = useState(false);
  const [previewResults, setPreviewResults] = useState<PlatformData[]>([]);
  const [optimizedContent, setOptimizedContent] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // 内容展示模式: form(表单) | generating(生成中) | result(结果) | comparing(对比)
  const [viewMode, setViewMode] = useState<'form' | 'generating' | 'result' | 'comparing'>('form');
  // 当前选中的内容版本: 'original' | 'optimized'
  const [selectedVersion, setSelectedVersion] = useState<'original' | 'optimized'>('original');
  // 是否已生成过内容（用于控制按钮状态）
  const [hasGenerated, setHasGenerated] = useState(false);

  // 所有生成的标题（扁平列表，用于选择）
  const allGeneratedTitles = Object.values(platformTitles).flat();

  // 流式内容生成回调
  const createStreamingCallback = (platform: string, onComplete?: (content: string) => void) => {
    // 在回调里直接累积，不依赖 React state 同步读取
    let accumulated = '';
    return (chunk: StreamingChunk) => {
      if (chunk.done) {
        // 同时更新 React state 用于实时显示
        setStreamingContents(prev => ({ ...prev, [platform]: accumulated }));
        onComplete?.(accumulated);
        return;
      }
      accumulated += chunk.content;
      // 实时更新显示
      setStreamingContents(prev => ({ ...prev, [platform]: accumulated }));
    };
  };

  // 标题数量校验
  const handleTitleCountChange = (value: string) => {
    const num = parseInt(value) || 2;
    setTitleCount(Math.min(10, Math.max(2, num)));
  };

  // 生成标题（第一次调用：使用titlePrompt）
  const handleGenerateTitles = async () => {
    if (!testMode && !hasApiConfig()) {
      const error = getApiConfigError();
      setApiError(error || '请检查您的API配置');
      return;
    }

    if (selectedPlatforms.length === 0) {
      setApiError('请先选择至少一个平台');
      return;
    }

    setIsGeneratingTitles(true);
    setApiError(null);

    const newPlatformTitles: { [platformId: string]: Title[] } = {};
    let titleIdCounter = Date.now();

    try {
      for (const platformId of selectedPlatforms) {
        const context: Record<string, string> = {
          content: inputContent,
          keywords: analysisResult?.核心议题 || '',
          emotion: analysisResult?.情绪基调?.join(', ') || '',
          audience: analysisResult?.目标受众 || '',
          category: analysisResult?.主题分类 || '',
          // 前置信息
          platform: preInfo?.platform || '',
          contentType: preInfo?.contentType || '',
          track: preInfo?.track || '',
          likes: String(preInfo?.likes || 0),
          collectCount: String(preInfo?.collectCount || 0),
          viewCount: String(preInfo?.viewCount || 0),
          shareCount: String(preInfo?.shareCount || 0),
        };

        let titles: string[] = [];

        if (testMode) {
          // 测试模式：生成模拟标题
          titles = Array.from({ length: titleCount }, (_, i) => {
            const templates = [
              '你绝对想不到的{topic}真相',
              '为什么{topic}正在悄悄改变一切',
              '关于{topic}，大多数人都会犯的错',
              '看完这篇文章，你就懂{topic}了',
              '{topic}的终极秘诀，一般人我不告诉',
            ];
            return templates[i % templates.length].replace('{topic}', '内容');
          });
        } else {
          // 真实API调用（使用promptRouter）
          const result = await promptRouter.execute(`${platformId}-title`, context, {});
          if (!result.success && !result.raw) {
            throw new Error(result.error || '生成标题失败');
          }

          let titlesData: any[] = [];
          // 优先从 parsed 提取 titles
          if (result.parsed?.titles) {
            titlesData = result.parsed.titles;
          } else if (result.raw) {
            // JSON 解析失败时，尝试从 raw 文本解析
            // 支持：1) JSON 数组 2) 按行分割的列表 3) 数字前缀的标题
            try {
              const jsonMatch = result.raw.match(/\[[\s\S]*?\]/);
              if (jsonMatch) {
                titlesData = JSON.parse(jsonMatch[0]);
              } else {
                // 按行分割，尝试提取标题
                const lines = result.raw.split('\n')
                  .map(l => l.trim())
                  .filter(l => l.length > 0 && l.length < 100);
                titlesData = lines.map(l => {
                  // 去掉数字前缀如 "1. " 或 "1、"
                  const cleaned = l.replace(/^\d+[.、:：]\s*/, '');
                  return { text: cleaned, type: 'AI生成', reason: '' };
                });
              }
            } catch {
              // 解析失败，使用空数组
            }
          }

          // titlesData 可能是字符串数组，也可能是 {text, type, reason} 对象数组
          titles = titlesData.slice(0, titleCount).map((item: any) =>
            typeof item === 'string' ? item : (item.text || item.title || '')
          ).filter(t => t);
        }

        newPlatformTitles[platformId] = titles.map((content, index) => ({
          id: titleIdCounter + index,
          content,
          type: 'AI生成',
          score: 10 - index,
        }));

        titleIdCounter += titleCount;
      }

      setPlatformTitles(newPlatformTitles);
      setSelectedTitles([]);

    } catch (error: any) {
      console.error('生成标题失败:', error);
      setApiError(error.message || '生成标题失败，请检查API配置');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

  // 封面风格选项
  const coverStyles = [
    { id: 'bold-editorial', name: 'Bold Editorial', desc: '大胆编辑风格' },
    { id: 'intuition-machine', name: 'Intuition Machine', desc: '直觉机器风格' },
    { id: 'pixel-art', name: 'Pixel Art', desc: '像素艺术风格' },
    { id: 'claymation', name: 'Claymation', desc: '黏土动画风格' },
    { id: 'craft-handmade', name: 'Craft Handmade', desc: '手工制作风格' },
  ];

  // 平台信息
  const platforms = [
    { id: 'gzh', name: '公众号', icon: gzhIcon },
    { id: 'xhs', name: '小红书', icon: xhsIcon },
    { id: 'douyin', name: '抖音', icon: dyIcon },
  ];

  // 平台名称到ID的映射
  const platformNameToId: Record<string, string> = {
    '公众号': 'gzh',
    '小红书': 'xhs',
    '抖音': 'douyin',
    '视频号': 'sp',
    '微博': 'wb',
  };

  // 根据前置信息设置默认选中的平台
  useEffect(() => {
    if (selectedPlatforms.length === 0) {
      let defaultPlatformId = platforms[0].id; // 默认选中第一个

      // 如果前置信息有平台，根据前置信息设置
      if (preInfo?.platform) {
        const mappedId = platformNameToId[preInfo.platform];
        if (mappedId) {
          // 检查映射的ID是否在可用平台中
          const exists = platforms.find(p => p.id === mappedId);
          if (exists) {
            defaultPlatformId = mappedId;
          }
        }
      }

      setSelectedPlatforms([defaultPlatformId]);
    }
  }, []);

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleTitleToggle = (titleId: number) => {
    if (selectedTitles.includes(titleId)) {
      setSelectedTitles(prev => prev.filter(id => id !== titleId));
    } else {
      if (selectedTitles.length < 3) {
        setSelectedTitles(prev => [...prev, titleId]);
      }
    }
  };

  const handleTitleEdit = (titleId: number, newContent: string) => {
    setEditedTitles(prev => ({ ...prev, [titleId]: newContent }));
    setEditingTitleId(null);
  };

  const startEditing = (titleId: number, currentContent: string) => {
    setEditingTitleId(titleId);
    setEditValue(currentContent);
  };

  // 获取推荐理由
  const getRecommendationReason = (score: number) => {
    if (score >= 9) return '高热度词汇，爆款潜力强';
    if (score >= 8) return '精准触达用户痛点';
    return '有一定吸引力';
  };

  // 计算列宽：选中平台等比例，未选中收缩
  const getColumnWidth = (platformId: string): string => {
    const selectedCount = selectedPlatforms.length;
    const hasGenerated = platformTitles[platformId] && platformTitles[platformId].length > 0;
    const isSelected = selectedPlatforms.includes(platformId);

    // 如果没有生成标题，全部等宽
    if (Object.keys(platformTitles).length === 0) {
      return 'flex-1';
    }

    // 已选中且有生成的列，宽一些
    if (isSelected && hasGenerated) {
      return selectedCount === 1 ? 'flex-[2]' : 'flex-1';
    }

    // 未选中或没有生成的列，收缩
    return selectedCount === 0 ? 'flex-1' : 'w-24';
  };

  const handleCoverStyleToggle = (styleId: string) => {
    setSelectedCoverStyles(prev =>
      prev.includes(styleId)
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  const canGenerate = selectedPlatforms.length > 0 && selectedTitles.length > 0 && Object.keys(platformTitles).length > 0;

  // 生成处理（第二次调用：使用contentPrompt）
  const handleGenerate = async () => {
    console.log('[handleGenerate] called, canGenerate:', canGenerate, 'isGenerating:', isGenerating);
    console.log('[handleGenerate] selectedPlatforms:', selectedPlatforms, 'selectedTitles:', selectedTitles, 'platformTitles:', Object.keys(platformTitles));

    if (!testMode && !hasApiConfig()) {
      const error = getApiConfigError();
      console.log('[handleGenerate] No API config, error:', error);
      setApiError(error || '请检查您的API配置');
      alert(error || '请检查您的API配置');
      return;
    }

    if (Object.keys(platformTitles).length === 0) {
      setApiError('请先点击"生成标题"按钮');
      return;
    }

    const steps = [
      { step: '调取AI大模型', status: 'pending' as const },
      { step: '撰写内容正文', status: 'pending' as const },
    ];

    setIsGenerating(true);
    setGenerationSteps(steps);
    setViewMode('generating');
    setOptimizedContent(null);
    setSelectedVersion('original');
    setHasGenerated(true);

    try {
      setGenerationSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, status: 'success' } : s));

      // 获取选中的标题内容
      const selectedTitlesList = selectedTitles.map(id => {
        const title = allGeneratedTitles.find(t => t.id === id);
        return title ? (editedTitles[id] || title.content) : '';
      }).filter(t => t);

      // 为每个平台生成正文
      const generatedContents: { [platformId: string]: string } = {};

      for (const platformId of selectedPlatforms) {
        const selectedTitle = selectedTitlesList[selectedPlatforms.indexOf(platformId)] || '';

        const context: Record<string, string> = {
          content: inputContent,
          title: selectedTitle,
          keywords: analysisResult?.核心议题 || '',
          emotion: analysisResult?.情绪基调?.join(', ') || '',
          audience: analysisResult?.目标受众 || '',
          category: analysisResult?.主题分类 || '',
          // 新增：完整的分析结果字段
          contentStructure: analysisResult?._rawJson?.['二、结构脉络']
            ? JSON.stringify(analysisResult._rawJson['二、结构脉络'])
            : '',
          valuePoints: analysisResult?._rawJson?.['三、价值与情绪']
            ? JSON.stringify(analysisResult._rawJson['三、价值与情绪'])
            : '',
          highlightClips: analysisResult?.金句?.map((g: any) => typeof g === 'string' ? g : g.内容).join(' | ') || '',
          // 前置信息
          platform: preInfo?.platform || '',
          contentType: preInfo?.contentType || '',
          track: preInfo?.track || '',
          likes: String(preInfo?.likes || 0),
          collectCount: String(preInfo?.collectCount || 0),
          viewCount: String(preInfo?.viewCount || 0),
          shareCount: String(preInfo?.shareCount || 0),
        };

        if (testMode) {
          // 测试模式：生成模拟正文
          generatedContents[platformId] = `这是测试模式下生成的正文内容...\n\n${inputContent.slice(0, 200)}`;
        } else {
          // 初始化流式显示状态
          setStreamingContents(prev => ({ ...prev, [platformId]: '' }));

          // 使用流式生成内容（promptRouter）
          const streamResult = await promptRouter.executeStream(
            `${platformId}-content`,
            context,
            createStreamingCallback(platformId),
            {}
          );
          if (!streamResult.success) {
            throw new Error(streamResult.error || '生成正文失败');
          }
          generatedContents[platformId] = streamResult.content;
        }
      }

      setGenerationSteps(prev => prev.map((s, idx) => idx === 1 ? { ...s, status: 'success' } : s));

      setIsGenerating(false);

      // 构建每个平台的数据
      const platformsData = selectedPlatforms.map((platformId, idx) => ({
        platform: platformId,
        title: selectedTitlesList[idx] || '',
        content: generatedContents[platformId] || '',
        coverPrompt: '',
        coverStyles: selectedCoverStyles,
      }));

      // 显示结果（不再弹浮窗）
      setPreviewResults(platformsData);
      setViewMode('result');
      onGenerate({ platformsData });

    } catch (error: any) {
      console.error('生成失败:', error);
      setApiError(error.message || '生成失败，请检查API配置');
    } finally {
      // 确保 loading 状态总是被重置
      console.log('[handleGenerate] finally block, resetting isGenerating to false');
      setIsGenerating(false);
      setGenerationSteps([]);
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* API错误提示 */}
      {apiError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{apiError}</span>
          <button onClick={() => setApiError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 平台选择 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-800">选择目标平台</span>
          </div>
          <button onClick={() => setShowPlatformTip(!showPlatformTip)} className="text-slate-400 hover:text-slate-600">
            <AlertCircle className="w-5 h-5" />
          </button>
        </div>
        {showPlatformTip && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-slate-600">
            请选择您希望发布的目标平台，默认选中公众号。
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {platforms.map(platform => {
            const isSelected = selectedPlatforms.includes(platform.id);
            return (
              <button
                key={platform.id}
                onClick={() => handlePlatformToggle(platform.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-blue-200'
                }`}
              >
                <img
                  src={platform.icon}
                  alt={platform.name}
                  className="w-10 h-10 object-contain"
                />
                <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                  {platform.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 标题生成 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-slate-500" />
            <span className="font-medium text-slate-800">生成标题</span>
          </div>
          <span className="text-sm text-slate-500">已选 {selectedTitles.length}/3</span>
        </div>

        {/* 生成控制区 */}
        <div className="flex items-end gap-4 mb-6 p-5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-1">
            <label htmlFor="titleCount" className="block text-sm text-slate-600 mb-2 font-medium">每个平台生成标题数量</label>
            <div className="flex items-center gap-3">
              <input
                id="titleCount"
                name="titleCount"
                type="number"
                min={2}
                max={10}
                value={titleCount}
                onChange={(e) => handleTitleCountChange(e.target.value)}
                className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              <span className="text-sm text-slate-500">个 (2-10)</span>
            </div>
          </div>
          <button
            onClick={handleGenerateTitles}
            disabled={selectedPlatforms.length === 0 || isGeneratingTitles}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 text-white rounded-lg font-semibold shadow-sm hover:shadow transition-all"
          >
            <Wand2 className="w-5 h-5" />
            {isGeneratingTitles ? '生成中...' : '生成标题'}
          </button>
        </div>

        {/* 生成的标题三列展示 - 水平折叠 */}
        {Object.keys(platformTitles).length > 0 && (
          <div className="flex gap-4">
            {platforms.map(platform => {
              const titles = platformTitles[platform.id] || [];
              const isSelected = selectedPlatforms.includes(platform.id);
              const hasTitles = titles.length > 0;
              const columnWidth = getColumnWidth(platform.id);

              return (
                <div
                  key={platform.id}
                  className={`${columnWidth} rounded-2xl overflow-hidden transition-all duration-500 ${
                    isSelected && hasTitles
                      ? 'bg-white shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/20'
                      : 'bg-slate-50 shadow-sm'
                  }`}
                >
                  {/* 平台列头部 */}
                  <div className={`px-5 py-4 border-b transition-all ${
                    isSelected && hasTitles
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'
                      : 'bg-slate-100 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-lg ${isSelected && hasTitles ? 'text-slate-800' : 'text-slate-500'}`}>
                        {platform.name}
                      </span>
                      {hasTitles && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          isSelected
                            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {titles.length} 个标题
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 标题列表 - 选中平台显示，未选中不显示 */}
                  {isSelected && hasTitles ? (
                    <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                      {titles.map((title, idx) => {
                        const isTitleSelected = selectedTitles.includes(title.id);
                        const isEditing = editingTitleId === title.id;
                        const displayContent = editedTitles[title.id] !== undefined ? editedTitles[title.id] : title.content;

                        return (
                          <div
                            key={title.id}
                            className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                              isTitleSelected
                                ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg shadow-blue-500/20'
                                : 'border-slate-100 bg-white hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/10'
                            }`}
                            onClick={() => !isEditing && handleTitleToggle(title.id)}
                          >
                            {/* 序号标签 */}
                            <div className={`absolute -top-3 left-4 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                              isTitleSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-slate-400 border border-slate-200'
                            }`}>
                              {idx + 1}
                            </div>

                            {isEditing ? (
                              <div className="flex gap-2 mt-1">
                                <input
                                  type="text"
                                  id={`title-edit-${title.id}`}
                                  name={`title-edit-${title.id}`}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="flex-1 px-3 py-2 text-sm border-2 border-blue-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                  autoFocus
                                  aria-label="编辑标题"
                                />
                                <button onClick={(e) => { e.stopPropagation(); handleTitleEdit(title.id, editValue); }} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingTitleId(null); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* 标题内容 */}
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <span className={`text-base font-semibold leading-relaxed flex-1 ${isTitleSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {displayContent}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEditing(title.id, displayContent); }}
                                    className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* 评分、类型和选择按钮 */}
                                <div className="flex items-center justify-between gap-2">
                                  {/* 星级评分 + 类型 */}
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="flex items-center">
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                                        <span
                                          key={star}
                                          className={`text-sm ${
                                            star <= title.score
                                              ? isTitleSelected ? 'text-amber-400' : 'text-amber-300'
                                              : 'text-slate-200'
                                          }`}
                                        >
                                          ★
                                        </span>
                                      ))}
                                    </div>
                                    <span className={`text-xs font-medium ${isTitleSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                                      {title.score}/10
                                    </span>
                                    {/* 公式类型 - 带气泡提示 */}
                                    <div className="relative group">
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 cursor-help flex items-center gap-1">
                                        {title.type}
                                        <HelpCircle className="w-3 h-3" />
                                      </span>
                                      {/* 公式详情气泡 */}
                                      {(() => {
                                        const formulaDetail = getFormulaDetail(platform.id, title.type);
                                        if (!formulaDetail) return null;
                                        return (
                                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-72">
                                            <div className="bg-slate-800 text-white text-xs rounded-lg p-3 shadow-xl">
                                              <div className="font-semibold text-amber-400 mb-1">{formulaDetail.name}</div>
                                              <div className="text-slate-300 mb-2">结构：{formulaDetail.structure}</div>
                                              <div className="text-slate-400 text-[11px] mb-2">{formulaDetail.description}</div>
                                              <div className="text-emerald-400 text-[11px] italic">例：{formulaDetail.example}</div>
                                              <div className="text-slate-500 text-[10px] mt-2">适用：{formulaDetail.applicable}</div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* 选择按钮 */}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleTitleToggle(title.id); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                                      isTitleSelected
                                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                                        : 'bg-slate-100 text-slate-600 hover:bg-blue-500 hover:text-white'
                                    }`}
                                  >
                                    {isTitleSelected ? '✓ 已选' : '选择此标题'}
                                  </button>
                                </div>

                                {/* 推荐理由 */}
                                <div className={`text-xs py-2 px-2 rounded mt-1 ${
                                  isTitleSelected
                                    ? 'bg-white/50 text-blue-600'
                                    : 'bg-slate-50 text-slate-500'
                                }`}>
                                  💡 {getRecommendationReason(title.score)}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* 未选中时显示提示 */
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium">{!hasTitles ? '等待生成标题' : '未选择该平台'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 无标题时提示 */}
        {Object.keys(platformTitles).length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>请先选择平台并点击"生成标题"</p>
          </div>
        )}
      </div>

      {/* 封面建议 - 已隐藏 */}
      {/* <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-slate-500" />
          <span className="font-medium text-slate-800">封面建议</span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {coverStyles.map(style => {
            const isSelected = selectedCoverStyles.includes(style.id);
            return (
              <button
                key={style.id}
                onClick={() => handleCoverStyleToggle(style.id)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'
                }`}
              >
                <div className={`w-10 h-10 mx-auto mb-2 rounded-lg ${
                  style.id === 'bold-editorial' ? 'bg-red-100' :
                  style.id === 'intuition-machine' ? 'bg-blue-100' :
                  style.id === 'pixel-art' ? 'bg-purple-100' :
                  style.id === 'claymation' ? 'bg-amber-100' : 'bg-green-100'
                }`} />
                <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                  {style.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">{style.desc}</div>
              </button>
            );
          })}
        </div>
      </div> */}

      {/* 内容展示区（生成中/结果/对比） */}
      {(viewMode === 'generating' || viewMode === 'result' || viewMode === 'comparing') && previewResults.length > 0 && (
        <div className="border-t border-slate-200 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-slate-800">
              {viewMode === 'generating' ? '内容生成中...' : '生成结果'}
            </span>
            {viewMode === 'comparing' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">已优化</span>
            )}
          </div>

          {/* 平台 Tab 切换 */}
          <div className="flex gap-2 mb-4">
            {previewResults.map((result) => {
              const platformName = result.platform === 'gzh' ? '公众号' : result.platform === 'xhs' ? '小红书' : '抖音';
              return (
                <span
                  key={result.platform}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    result.platform === 'gzh' ? 'bg-blue-100 text-blue-700' :
                    result.platform === 'xhs' ? 'bg-pink-100 text-pink-700' :
                    'bg-cyan-100 text-cyan-700'
                  }`}
                >
                  {platformName}
                </span>
              );
            })}
            {viewMode === 'generating' && selectedPlatforms.map((platformId) => {
              const platformName = platformId === 'gzh' ? '公众号' : platformId === 'xhs' ? '小红书' : '抖音';
              return (
                <span
                  key={platformId}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    platformId === 'gzh' ? 'bg-blue-100 text-blue-700' :
                    platformId === 'xhs' ? 'bg-pink-100 text-pink-700' :
                    'bg-cyan-100 text-cyan-700'
                  }`}
                >
                  {platformName}
                </span>
              );
            })}
          </div>

          {/* 当前平台内容 - 流式显示或结果 */}
          {(viewMode === 'generating' || previewResults[0]) && (
            <div className="space-y-4">
              {/* 标题 - 生成完成后显示 */}
              {viewMode !== 'generating' && previewResults[0] && (
                <div>
                  <div className="text-sm text-slate-500 mb-1">标题</div>
                  <div className="text-lg font-semibold text-slate-800">{previewResults[0].title}</div>
                </div>
              )}

              {/* 对比模式：两列布局 */}
              {viewMode === 'comparing' ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* 原文 */}
                  <div
                    onClick={() => setSelectedVersion('original')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedVersion === 'original'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">原文</span>
                      {selectedVersion === 'original' && (
                        <Check className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-700 max-h-80 overflow-y-auto">
                      {previewResults[0].content}
                    </div>
                  </div>

                  {/* 优化版 */}
                  <div
                    onClick={() => setSelectedVersion('optimized')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedVersion === 'optimized'
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 bg-slate-50 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">优化版</span>
                      {selectedVersion === 'optimized' && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-slate-700 max-h-80 overflow-y-auto">
                      {optimizedContent || '(优化中...)'}
                    </div>
                  </div>
                </div>
              ) : (
                /* 非对比模式：单列显示 */
                <div>
                  <div className="text-sm text-slate-500 mb-1">
                    {viewMode === 'generating' ? '正文内容（实时生成中）' : '正文内容'}
                  </div>
                  <div className={`rounded-lg p-4 whitespace-pre-wrap text-sm ${
                    viewMode === 'generating'
                      ? 'bg-slate-100 animate-pulse'
                      : 'bg-slate-50'
                  }`}>
                    {streamingContents[selectedPlatforms[0]] || previewResults[0]?.content || '(生成中...)'}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <div className="text-sm text-slate-500">
                  {viewMode === 'comparing'
                    ? `已选择：${selectedVersion === 'original' ? '原文' : '优化版'}`
                    : '点击下方按钮进行优化'}
                </div>
                <div className="flex gap-3">
                  {viewMode === 'comparing' && (
                    <button
                      onClick={() => {
                        const content = selectedVersion === 'original'
                          ? previewResults[0].content
                          : optimizedContent || '';
                        // 导出功能
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${previewResults[0].title}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      导出选中内容
                    </button>
                  )}
                  {viewMode !== 'comparing' && (
                    <button
                      onClick={async () => {
                        if (previewResults.length === 0) return;
                        const result = previewResults[0];
                        setIsOptimizing(true);
                        try {
                          // 传递更丰富的上下文给优化模板
                          const optimizeContext = {
                            content: result.content,
                            title: result.title,
                            // 传递分析结果中的关键信息
                            核心议题: analysisResult?.核心议题 || '',
                            情绪基调: analysisResult?.情绪基调?.join(', ') || '',
                            目标受众: analysisResult?.目标受众 || '',
                            内容类型: preInfo?.contentType || '',
                            赛道: preInfo?.track || '',
                            账号人设: `${preInfo?.contentType || ''}，赛道${preInfo?.track || ''}`,
                          };
                          const optimizeResult = await promptRouter.execute(
                            `${result.platform}-optimization`,
                            optimizeContext,
                            {}
                          );
                          if (optimizeResult.success && optimizeResult.raw) {
                            setOptimizedContent(optimizeResult.raw);
                            setViewMode('comparing');
                            console.log('[一键优化] 优化成功');
                          } else {
                            console.error('[一键优化] 优化失败:', optimizeResult.error);
                            alert('优化失败：' + (optimizeResult.error || '未知错误'));
                          }
                        } catch (error: any) {
                          console.error('[一键优化] 异常:', error);
                          alert('优化异常：' + error.message);
                        } finally {
                          setIsOptimizing(false);
                        }
                      }}
                      disabled={isOptimizing}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-blue-400"
                    >
                      {isOptimizing ? '优化中...' : '一键优化'}
                    </button>
                  )}
                  {viewMode === 'comparing' && (
                    <button
                      onClick={() => {
                        setViewMode('result');
                        setSelectedVersion('original');
                      }}
                      className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                    >
                      关闭对比
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 底部操作区 */}
      <div className="flex items-center justify-center pt-4 border-t border-slate-200">
        <button
          onClick={onBack}
          className="px-6 py-3 text-slate-600 hover:text-slate-800 hover:bg-white border border-slate-200 rounded-lg font-medium text-base transition-colors"
        >
          上一步
        </button>

        {/* 生成进度可视化 */}
        {isGenerating && selectedPlatforms.length > 0 && (
          <div className="flex-1 mx-8 max-w-md">
            <div className="space-y-2">
              {selectedPlatforms.map(platformId => {
                const platform = platforms.find(p => p.id === platformId);
                const platformColor = platformId === 'xhs' ? 'pink' : platformId === 'douyin' ? 'cyan' : 'blue';
                return (
                  <PlatformProgressBar
                    key={platformId}
                    platformName={platform?.name || platformId}
                    progress={100}
                    status="generating"
                    platformColor={platformColor as 'blue' | 'pink' | 'cyan'}
                  />
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating || viewMode === 'result' || viewMode === 'comparing'}
          className={`
            flex items-center gap-2 px-8 py-3 font-medium text-base ml-auto rounded-lg transition-all duration-200
            ${canGenerate && !isGenerating && viewMode !== 'result' && viewMode !== 'comparing'
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 hover:scale-105 shadow-lg hover:shadow-xl'
              : 'bg-slate-300 cursor-not-allowed text-slate-500'
            }
            ${isGenerating ? 'bg-blue-600 cursor-wait' : ''}
          `}
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              生成中...
            </>
          ) : (
            <>
              {viewMode === 'result' || viewMode === 'comparing'
                ? '内容已生成'
                : canGenerate
                  ? '爆款制作启动'
                  : '请先选择平台和标题'
              }
              {canGenerate && viewMode !== 'result' && viewMode !== 'comparing' && <ArrowRight className="w-5 h-5" />}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
