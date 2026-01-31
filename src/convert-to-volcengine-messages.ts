import type { LanguageModelV3Prompt } from '@ai-sdk/provider';

export type VolcengineMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | VolcengineContentPart[];
  name?: string;
  tool_calls?: VolcengineToolCall[];
  tool_call_id?: string;
};

export type VolcengineContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export type VolcengineToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export function convertToVolcengineMessages(
  prompt: LanguageModelV3Prompt
): VolcengineMessage[] {
  const messages: VolcengineMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system': {
        messages.push({
          role: 'system',
          content: message.content,
        });
        break;
      }

      case 'user': {
        const content: VolcengineContentPart[] = [];

        for (const part of message.content) {
          switch (part.type) {
            case 'text':
              content.push({ type: 'text', text: part.text });
              break;
            case 'file':
              // Handle file parts - check if it's an image
              if (part.mediaType?.startsWith('image/')) {
                if (typeof part.data === 'string') {
                  // URL or base64 string
                  if (part.data.startsWith('http://') || part.data.startsWith('https://')) {
                    content.push({
                      type: 'image_url',
                      image_url: { url: part.data },
                    });
                  } else {
                    // Base64 encoded
                    content.push({
                      type: 'image_url',
                      image_url: { url: `data:${part.mediaType};base64,${part.data}` },
                    });
                  }
                } else if (part.data instanceof Uint8Array) {
                  // Binary data - convert to base64
                  const base64 = Buffer.from(part.data).toString('base64');
                  content.push({
                    type: 'image_url',
                    image_url: { url: `data:${part.mediaType};base64,${base64}` },
                  });
                }
              }
              break;
          }
        }

        messages.push({
          role: 'user',
          content: content.length === 1 && content[0].type === 'text'
            ? content[0].text
            : content,
        });
        break;
      }

      case 'assistant': {
        let textContent = '';
        const toolCalls: VolcengineToolCall[] = [];

        for (const part of message.content) {
          switch (part.type) {
            case 'text':
              textContent += part.text;
              break;
            case 'tool-call':
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.input),
                },
              });
              break;
          }
        }

        const assistantMessage: VolcengineMessage = {
          role: 'assistant',
          content: textContent,
        };

        if (toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
        }

        messages.push(assistantMessage);
        break;
      }

      case 'tool': {
        for (const part of message.content) {
          if (part.type === 'tool-result') {
            messages.push({
              role: 'tool',
              content: JSON.stringify(part.output),
              tool_call_id: part.toolCallId,
            });
          }
        }
        break;
      }
    }
  }

  return messages;
}
