import type { ImageModelV3, ImageModelV3CallOptions, SharedV3Warning, ImageModelV3ProviderMetadata, ImageModelV3Usage } from '@ai-sdk/provider';
import type { VolcengineImageSettings } from './volcengine-image-settings';

export interface VolcengineImageConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

interface VolcengineImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export class VolcengineImageModel implements ImageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider: string;
  readonly modelId: string;
  readonly maxImagesPerCall = 4;

  private readonly config: VolcengineImageConfig;
  private readonly settings: VolcengineImageSettings;

  constructor(
    modelId: string,
    settings: VolcengineImageSettings,
    config: VolcengineImageConfig
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.provider = config.provider;
  }

  async doGenerate(options: ImageModelV3CallOptions): Promise<{
    images: string[];
    warnings: SharedV3Warning[];
    providerMetadata?: ImageModelV3ProviderMetadata;
    response: {
      timestamp: Date;
      modelId: string;
      headers: Record<string, string> | undefined;
    };
    usage?: ImageModelV3Usage;
  }> {
    const { prompt, n, size, providerOptions } = options;

    const body: Record<string, unknown> = {
      model: this.modelId,
      prompt,
      n: n ?? this.settings.n ?? 1,
      response_format: this.settings.responseFormat ?? 'b64_json',
    };

    // Handle size
    if (size) {
      body.size = size;
    } else if (this.settings.size) {
      body.size = this.settings.size;
    }

    // Handle quality and style
    if (this.settings.quality) {
      body.quality = this.settings.quality;
    }
    if (this.settings.style) {
      body.style = this.settings.style;
    }
    if (this.settings.user) {
      body.user = this.settings.user;
    }

    // Merge provider options
    if (providerOptions?.volcengine) {
      Object.assign(body, providerOptions.volcengine);
    }

    const fetchImpl = this.config.fetch ?? globalThis.fetch;
    const response = await fetchImpl(`${this.config.baseURL}/images/generations`, {
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

    const imageResponse = (await response.json()) as VolcengineImageResponse;

    const images = imageResponse.data.map((item) => {
      if (item.b64_json) {
        return item.b64_json;
      }
      if (item.url) {
        return item.url;
      }
      throw new Error('No image data in response');
    });

    // Build provider metadata with required 'images' array for each provider entry
    const revisedPrompts = imageResponse.data
      .map((item) => item.revised_prompt)
      .filter((p): p is string => p !== undefined);

    return {
      images,
      warnings: [],
      providerMetadata: {
        volcengine: {
          images: revisedPrompts,
        },
      },
      response: {
        timestamp: new Date(imageResponse.created * 1000),
        modelId: this.modelId,
        headers: responseHeaders,
      },
      usage: {
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      },
    };
  }
}
