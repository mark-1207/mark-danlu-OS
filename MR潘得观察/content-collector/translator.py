"""
翻译模块 - 支持将外网内容翻译成中文
"""

import logging
import re
import os
import sys

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from config import TRANSLATION_SERVICE
except ImportError:
    TRANSLATION_SERVICE = "google"

logger = logging.getLogger(__name__)

# 需要翻译的语言
LANGUAGES_TO_TRANSLATE = ['en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'ar', 'vi', 'th', 'id', 'ms', 'hi']


def detect_language(text: str) -> str:
    """
    简单语言检测（基于字符范围）

    Returns:
        str: 语言代码
    """
    if not text:
        return "unknown"

    # 统计字符分布
    cn_chars = len(re.findall(r'[\u4e00-\u9fff]', text))  # 中文
    en_chars = len(re.findall(r'[a-zA-Z]', text))  # 英文
    ja_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', text))  # 日文
    ko_chars = len(re.findall(r'[\uac00-\ud7af]', text))  # 韩文

    total = len(text)
    if total == 0:
        return "unknown"

    # 根据字符比例判断
    if cn_chars / total > 0.1:
        return "zh"
    elif ja_chars / total > 0.05:
        return "ja"
    elif ko_chars / total > 0.05:
        return "ko"
    elif en_chars / total > 0.5:
        return "en"

    return "unknown"


def translate_to_chinese(text: str, source_lang: str = None) -> str:
    """
    将文本翻译成中文

    Args:
        text: 待翻译文本
        source_lang: 源语言（可选，自动检测）

    Returns:
        str: 翻译后的中文文本
    """
    if not text or len(text.strip()) < 10:
        return ""

    # 自动检测语言
    if source_lang is None:
        source_lang = detect_language(text)

    # 如果已经是中文，无需翻译
    if source_lang == "zh":
        return ""

    # 如果不在需要翻译的语言列表中
    if source_lang not in LANGUAGES_TO_TRANSLATE:
        logger.info(f"语言 {source_lang} 不在翻译列表中，跳过翻译")
        return ""

    logger.info(f"检测到语言: {source_lang}，开始翻译...")

    try:
        if TRANSLATION_SERVICE == "google":
            return translate_with_google(text, source_lang, "zh-CN")
        elif TRANSLATION_SERVICE == "deepL":
            return translate_with_deepl(text, source_lang, "ZH")
        elif TRANSLATION_SERVICE == "openai":
            return translate_with_openai(text, source_lang)
        else:
            return translate_with_google(text, source_lang, "zh-CN")
    except Exception as e:
        logger.error(f"翻译失败: {str(e)}")
        return ""


def translate_with_google(text: str, source: str, target: str) -> str:
    """使用Google翻译API"""
    try:
        from googletrans import Translator
        translator = Translator()
        result = translator.translate(text, src=source, dest=target)
        return result.text
    except ImportError:
        logger.warning("googletrans 未安装，使用备选方案")
        return text[:500]  # 返回原文前500字作为替代


def translate_with_deepl(text: str, source: str, target: str) -> str:
    """使用DeepL翻译API"""
    try:
        import deepl
        # 需要设置 DEEPL_API_KEY 环境变量
        api_key = os.environ.get("DEEPL_API_KEY", "")
        if not api_key:
            logger.warning("未设置 DEEPL_API_KEY")
            return text[:500]

        translator = deepl.Translator(api_key)
        result = translator.translate_text(text, source_lang=source.upper(), target_lang=target)
        return str(result)
    except ImportError:
        logger.warning("deepl 未安装")
        return text[:500]


def translate_with_openai(text: str, source_lang: str) -> str:
    """使用OpenAI翻译"""
    try:
        import openai
        import os

        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            logger.warning("未设置 OPENAI_API_KEY")
            return text[:500]

        openai.api_key = api_key

        # 截取过长文本（GPT有token限制）
        max_chars = 8000
        if len(text) > max_chars:
            text = text[:max_chars] + "..."

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "你是一个专业翻译助手，请将以下内容翻译成简体中文，保留原文格式和语气。"},
                {"role": "user", "content": text}
            ],
            temperature=0.3
        )

        return response.choices[0].message.content

    except Exception as e:
        logger.error(f"OpenAI翻译失败: {str(e)}")
        return ""


def translate_batch(texts: list, source_lang: str = None) -> list:
    """批量翻译"""
    results = []
    for text in texts:
        result = translate_to_chinese(text, source_lang)
        results.append(result)
    return results


# 导出
__all__ = ['detect_language', 'translate_to_chinese', 'translate_batch']
