import { useCallback } from 'react';
import toast from 'react-hot-toast';
import type { RowData } from '@/components/SpreadsheetGrid';
import { AMAZON_AI_DROPDOWN_OPTIONS, AMAZON_AI_TEXT_FIELDS } from '@/lib/amazonAiConstants';

export function useAmazonAIPipeline(dataRef: React.MutableRefObject<RowData[]>, setData: React.Dispatch<React.SetStateAction<RowData[]>>) {
  const triggerAmazonAIGeneration = useCallback((row: number, forceRegenerate: string[] = []): Promise<void> => {
    return new Promise((resolve) => {
      const current = dataRef.current[row];
      if (!current) { resolve(); return; }
      const requested = new Set<string>();
      if (!current.title || forceRegenerate.includes('title')) requested.add('title');
      if (!current.description || forceRegenerate.includes('description')) requested.add('description');
      for (const field of AMAZON_AI_TEXT_FIELDS) {
        if (current[field + '_auto'] === true || forceRegenerate.includes(field)) requested.add(field);
      }
      for (const field of Object.keys(AMAZON_AI_DROPDOWN_OPTIONS)) {
        if (current[field] === 'Auto' || forceRegenerate.includes(field)) requested.add(field);
      }
      for (const field of ['sport_type', 'lifestyle', 'league_name', 'team_name']) {
        if (current[field] === 'Auto' || forceRegenerate.includes(field)) requested.add(field);
      }
      if (requested.size === 0) { toast('No missing or Auto Amazon fields to generate.'); resolve(); return; }

      const optimistic = [...dataRef.current];
      optimistic[row] = { ...optimistic[row], status: 'Generating...' };
      dataRef.current = optimistic; setData(optimistic);
      const imagePaths = (current.images || '').split(',').map(value => value.trim()).filter(Boolean);
      const context = [current.context || '', current.folder ? 'Folder/Product Name: ' + current.folder : ''].filter(Boolean).join('\n');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      fetch('/api/amazon/generate', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, imagePaths, existingData: current, requestedFields: [...requested], rules: {
          title: current.ai_title_rules || '', description: current.ai_desc_rules || '',
          bullet_points: current.ai_bullet_rules || '', keywords: current.ai_keyword_rules || '',
          attributes: current.ai_attribute_rules || ''
        } })
      }).then(async response => {
        clearTimeout(timeoutId); const payload = await response.json();
        if (!response.ok || payload.error) throw new Error(payload.error || 'Amazon AI generation failed.');
        const next = [...dataRef.current]; next[row] = { ...next[row], ...payload, status: 'Review' };
        dataRef.current = next; setData(next); toast.success('Amazon AI generation complete'); resolve();
      }).catch(error => {
        clearTimeout(timeoutId); const next = [...dataRef.current]; next[row] = { ...next[row], status: 'Error' };
        dataRef.current = next; setData(next);
        toast.error(error.name === 'AbortError' ? 'Amazon AI generation timed out.' : error.message || 'Amazon AI generation failed.'); resolve();
      });
    });
  }, [dataRef, setData]);

  return { triggerAmazonAIGeneration };
}
