import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getCachedTextTranslation, translateWithGemini, subscribeToTranslations } from '../utils/aiTranslator';

/**
 * Renders text translated into Bangla via Gemini 3.8 Flash with client-side caching,
 * lightweight loading indicator during first-time translation, and graceful English fallback.
 */
export function TranslatedText({ 
  text, 
  fallback = null, 
  className = '', 
  showIndicator = true,
  as: Component = 'span' 
}) {
  const { language } = useDatabase();
  const rawText = text || '';
  const defaultFallback = fallback !== null ? fallback : rawText;

  const [translatedText, setTranslatedText] = useState(() => {
    if (language !== 'bn') return rawText;
    return getCachedTextTranslation(rawText, 'bn') || null;
  });
  const [isTranslating, setIsTranslating] = useState(false);

  // Synchronize with external cache updates
  useEffect(() => {
    const unsubscribe = subscribeToTranslations(({ type, key, value }) => {
      if (type === 'text' && key === `bn:${rawText.trim()}`) {
        setTranslatedText(value);
        setIsTranslating(false);
      }
    });
    return unsubscribe;
  }, [rawText]);

  useEffect(() => {
    if (language !== 'bn' || !rawText.trim()) {
      setIsTranslating(false);
      return;
    }

    const cached = getCachedTextTranslation(rawText, 'bn');
    if (cached) {
      setTranslatedText(cached);
      setIsTranslating(false);
      return;
    }

    // Cache miss: initiate Gemini 3.8 Flash translation
    let active = true;
    setIsTranslating(true);

    translateWithGemini({ text: rawText, targetLanguage: 'bn' })
      .then(result => {
        if (!active) return;
        if (result && result.success && result.translatedText) {
          setTranslatedText(result.translatedText);
        } else {
          // Fallback to English on error
          setTranslatedText(defaultFallback);
        }
        setIsTranslating(false);
      })
      .catch(() => {
        if (!active) return;
        setTranslatedText(defaultFallback);
        setIsTranslating(false);
      });

    return () => {
      active = false;
    };
  }, [language, rawText, defaultFallback]);

  if (language !== 'bn') {
    return <Component className={className}>{rawText}</Component>;
  }

  const displayText = translatedText || defaultFallback;

  return (
    <Component className={`translated-text-wrapper ${className}`}>
      {displayText}
      {isTranslating && showIndicator && (
        <span 
          className="translating-pill" 
          title="Translating with Gemini 3.8 Flash..."
          style={{ marginLeft: '6px' }}
        >
          <span className="translating-dot"></span>
        </span>
      )}
    </Component>
  );
}

export default TranslatedText;
