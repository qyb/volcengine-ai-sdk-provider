import type { LanguageModelV3, ImageModelV3 } from '@ai-sdk/provider';
import { VolcengineChatLanguageModel } from './volcengine-chat-language-model';
import { VolcengineImageModel } from './volcengine-image-model';
import type { VolcengineChatSettings } from './volcengine-chat-settings';
import type { VolcengineImageSettings } from './volcengine-image-settings';

export interface VolcengineProviderSettings {
  /**
   * Volcengine API key. Defaults to VOLCENGINE_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Base URL for the Volcengine API.
   * @default 'https://ark.cn-beijing.volces.com/api/v3'
   */
  baseURL?: string;

  /**
   * Custom headers to include in requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation.
   */
  fetch?: typeof globalThis.fetch;
}

export interface VolcengineProvider {
  /**
   * Creates a language model for chat completions.
   */
  (modelId: string, settings?: VolcengineChatSettings): LanguageModelV3;

  /**
   * Creates a language model for chat completions.
   */
  languageModel(modelId: string, settings?: VolcengineChatSettings): LanguageModelV3;

  /**
   * Creates a language model for chat completions.
   */
  chat(modelId: string, settings?: VolcengineChatSettings): LanguageModelV3;

  /**
   * Creates an image model for image generation.
   */
  imageModel(modelId: string, settings?: VolcengineImageSettings): ImageModelV3;

  /**
   * Creates an image model for image generation.
   */
  image(modelId: string, settings?: VolcengineImageSettings): ImageModelV3;
}

function getApiKey(apiKey?: string): string {
  if (apiKey) {
    return apiKey;
  }
  const envKey = process.env.VOLCENGINE_API_KEY;
  if (envKey) {
    return envKey;
  }
  throw new Error(
    'Volcengine API key is required. Set VOLCENGINE_API_KEY environment variable or pass apiKey option.'
  );
}

function withoutTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Creates a Volcengine provider instance.
 */
export function createVolcengine(
  options: VolcengineProviderSettings = {}
): VolcengineProvider {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? 'https://ark.cn-beijing.volces.com/api/v3'
  );

  const getHeaders = () => ({
    Authorization: `Bearer ${getApiKey(options.apiKey)}`,
    'Content-Type': 'application/json',
    ...options.headers,
  });

  const createChatModel = (
    modelId: string,
    settings: VolcengineChatSettings = {}
  ): LanguageModelV3 => {
    return new VolcengineChatLanguageModel(modelId, settings, {
      provider: 'volcengine.chat',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });
  };

  const createImageModel = (
    modelId: string,
    settings: VolcengineImageSettings = {}
  ): ImageModelV3 => {
    return new VolcengineImageModel(modelId, settings, {
      provider: 'volcengine.image',
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    });
  };

  const provider = function (
    modelId: string,
    settings?: VolcengineChatSettings
  ): LanguageModelV3 {
    return createChatModel(modelId, settings);
  };

  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.imageModel = createImageModel;
  provider.image = createImageModel;

  return provider as VolcengineProvider;
}

/**
 * Default Volcengine provider instance.
 */
export const volcengine = createVolcengine();
