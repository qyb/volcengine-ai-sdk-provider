import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Content,
  LanguageModelV3FunctionTool,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { convertToVolcengineMessages, VolcengineMessage } from './convert-to-volcengine-messages';
import { mapVolcengineFinishReason } from './map-volcengine-finish-reason';
import type { VolcengineChatSettings } from './volcengine-chat-settings';

export interface VolcengineChatConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

interface VolcengineChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface VolcengineStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class VolcengineChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  private readonly config: VolcengineChatConfig;
  private readonly settings: VolcengineChatSettings;

  constructor(
    modelId: string,
    settings: VolcengineChatSettings,
    config: VolcengineChatConfig
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.provider = config.provider;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const { prompt } = options;
    const messages = convertToVolcengineMessages(prompt);
    const body = this.buildRequestBody(messages, options, false);

    const fetchImpl = this.config.fetch ?? globalThis.fetch;
    const response = await fetchImpl(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.config.headers(),
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Volcengine API error: ${response.status} ${errorBody}`);
    }

    const chatResponse = (await response.json()) as VolcengineChatResponse;
    const choice = chatResponse.choices[0];

    // Build content array
    const content: LanguageModelV3Content[] = [];

    // Add text content if present
    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content,
      });
    }

    // Add tool calls if present
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: tc.id,
          toolName: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      content,
      finishReason: mapVolcengineFinishReason(choice.finish_reason),
      usage: {
        inputTokens: {
          total: chatResponse.usage.prompt_tokens,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: chatResponse.usage.completion_tokens,
          text: chatResponse.usage.completion_tokens,
          reasoning: undefined,
        },
      },
      request: {
        body,
      },
      response: {
        id: chatResponse.id,
        timestamp: new Date(chatResponse.created * 1000),
        modelId: chatResponse.model,
        headers: responseHeaders,
        body: chatResponse,
      },
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const { prompt } = options;
    const messages = convertToVolcengineMessages(prompt);
    const body = this.buildRequestBody(messages, options, true);

    const fetchImpl = this.config.fetch ?? globalThis.fetch;
    const response = await fetchImpl(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.config.headers(),
      body: JSON.stringify(body),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Volcengine API error: ${response.status} ${errorBody}`);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const toolCallBuffers: Map<number, {
      id: string;
      name: string;
      arguments: string;
    }> = new Map();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let textId = 'text-0';
    let textStarted = false;

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // End text if started
            if (textStarted) {
              controller.enqueue({
                type: 'text-end',
                id: textId,
              });
            }

            // Emit any buffered tool calls
            for (const [, toolCall] of toolCallBuffers) {
              controller.enqueue({
                type: 'tool-input-end',
                id: toolCall.id,
              });
            }

            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed: VolcengineStreamChunk = JSON.parse(data);
              const choice = parsed.choices?.[0];

              if (!choice) continue;

              // Handle finish
              if (choice.finish_reason) {
                controller.enqueue({
                  type: 'finish',
                  finishReason: mapVolcengineFinishReason(choice.finish_reason),
                  usage: parsed.usage ? {
                    inputTokens: {
                      total: parsed.usage.prompt_tokens,
                      noCache: undefined,
                      cacheRead: undefined,
                      cacheWrite: undefined,
                    },
                    outputTokens: {
                      total: parsed.usage.completion_tokens,
                      text: parsed.usage.completion_tokens,
                      reasoning: undefined,
                    },
                  } : {
                    inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
                    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
                  },
                });
              }

              // Handle text delta
              if (choice.delta.content) {
                if (!textStarted) {
                  controller.enqueue({
                    type: 'text-start',
                    id: textId,
                  });
                  textStarted = true;
                }
                controller.enqueue({
                  type: 'text-delta',
                  id: textId,
                  delta: choice.delta.content,
                });
              }

              // Handle tool calls
              if (choice.delta.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  let toolBuffer = toolCallBuffers.get(tc.index);

                  if (!toolBuffer) {
                    toolBuffer = { id: '', name: '', arguments: '' };
                    toolCallBuffers.set(tc.index, toolBuffer);
                  }

                  if (tc.id) {
                    toolBuffer.id = tc.id;
                  }

                  if (tc.function?.name) {
                    toolBuffer.name = tc.function.name;
                    controller.enqueue({
                      type: 'tool-input-start',
                      id: toolBuffer.id,
                      toolName: toolBuffer.name,
                    });
                  }

                  if (tc.function?.arguments) {
                    toolBuffer.arguments += tc.function.arguments;
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: toolBuffer.id,
                      delta: tc.function.arguments,
                    });
                  }
                }
              }
            } catch {
              // Ignore parse errors for non-JSON data
            }
          }
        }
      },
    });

    return {
      stream,
      request: {
        body,
      },
      response: {
        headers: responseHeaders,
      },
    };
  }

  private buildRequestBody(
    messages: VolcengineMessage[],
    options: LanguageModelV3CallOptions,
    stream: boolean
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages,
      stream,
    };

    // Add settings
    if (this.settings.temperature !== undefined || options.temperature !== undefined) {
      body.temperature = options.temperature ?? this.settings.temperature;
    }
    if (this.settings.maxTokens !== undefined || options.maxOutputTokens !== undefined) {
      body.max_tokens = options.maxOutputTokens ?? this.settings.maxTokens;
    }
    if (this.settings.topP !== undefined || options.topP !== undefined) {
      body.top_p = options.topP ?? this.settings.topP;
    }
    if (this.settings.frequencyPenalty !== undefined || options.frequencyPenalty !== undefined) {
      body.frequency_penalty = options.frequencyPenalty ?? this.settings.frequencyPenalty;
    }
    if (this.settings.presencePenalty !== undefined || options.presencePenalty !== undefined) {
      body.presence_penalty = options.presencePenalty ?? this.settings.presencePenalty;
    }
    if (this.settings.stop !== undefined || options.stopSequences !== undefined) {
      body.stop = options.stopSequences ?? this.settings.stop;
    }
    if (this.settings.user !== undefined) {
      body.user = this.settings.user;
    }
    if (options.seed !== undefined) {
      body.seed = options.seed;
    }

    // Handle tools
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools
        .filter((tool): tool is LanguageModelV3FunctionTool => tool.type === 'function')
        .map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        }));

      if (options.toolChoice) {
        if (options.toolChoice.type === 'auto') {
          body.tool_choice = 'auto';
        } else if (options.toolChoice.type === 'none') {
          body.tool_choice = 'none';
        } else if (options.toolChoice.type === 'required') {
          body.tool_choice = 'required';
        } else if (options.toolChoice.type === 'tool') {
          body.tool_choice = {
            type: 'function',
            function: { name: options.toolChoice.toolName },
          };
        }
      }
    }

    // Handle response format (JSON mode)
    if (options.responseFormat?.type === 'json') {
      body.response_format = { type: 'json_object' };
      if (options.responseFormat.schema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: options.responseFormat.name ?? 'response',
            schema: options.responseFormat.schema,
          },
        };
      }
    }

    // Stream options for usage
    if (stream) {
      body.stream_options = { include_usage: true };
    }

    return body;
  }
}
