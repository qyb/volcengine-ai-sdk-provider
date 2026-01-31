import type { LanguageModelV3FinishReason } from '@ai-sdk/provider';

export function mapVolcengineFinishReason(
  finishReason: string | null | undefined
): LanguageModelV3FinishReason {
  switch (finishReason) {
    case 'stop':
      return { unified: 'stop', raw: finishReason };
    case 'length':
      return { unified: 'length', raw: finishReason };
    case 'tool_calls':
    case 'function_call':
      return { unified: 'tool-calls', raw: finishReason };
    case 'content_filter':
      return { unified: 'content-filter', raw: finishReason };
    default:
      return { unified: 'other', raw: finishReason ?? undefined };
  }
}
