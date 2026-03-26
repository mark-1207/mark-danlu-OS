/**
 * 内容查看器组件
 * 展示正文内容，支持滚动定位和高亮
 */
import { useRef, useEffect, useState } from 'react';

interface ContentViewerProps {
  title: string;
  content: string;
  highlightPosition?: string;
}

export function ContentViewer({ title, content, highlightPosition }: ContentViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(false);

  // 当 highlightPosition 变化时，滚动并高亮
  useEffect(() => {
    if (!highlightPosition || !contentRef.current) return;

    // 简单的段落定位：找到包含关键词的段落
    const paragraphs = contentRef.current.querySelectorAll('.content-paragraph');
    const targetParagraph = Array.from(paragraphs).find((p) =>
      p.textContent?.includes(highlightPosition.replace(/[第（）]/g, ''))
    );

    if (targetParagraph) {
      // 滚动到目标段落
      targetParagraph.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 添加高亮效果
      setHighlighted(true);
      targetParagraph.classList.add('bg-yellow-100');

      // 2秒后移除高亮
      setTimeout(() => {
        targetParagraph.classList.remove('bg-yellow-100');
        setHighlighted(false);
      }, 2000);
    }
  }, [highlightPosition]);

  // 将内容按段落分割
  const paragraphs = content.split('\n\n').filter((p) => p.trim());

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="mb-4 pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      </div>

      {/* 正文 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="content-paragraph text-sm text-slate-600 leading-relaxed mb-4 transition-colors duration-500"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
