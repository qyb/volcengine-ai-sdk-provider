# Volcengine AI SDK Provider

火山引擎 (Volcengine) 的 [Vercel AI SDK](https://sdk.vercel.ai/) Provider，实现 V3 规范。

## 安装

```bash
npm install @qyb/volcengine-ai-sdk-provider ai
```

## 使用 (AI SDK v6)

### 聊天补全

```typescript
import { generateText } from 'ai';
import { createVolcengine } from '@qyb/volcengine-ai-sdk-provider';

const volcengine = createVolcengine({
  apiKey: 'your-api-key', // 或设置 VOLCENGINE_API_KEY 环境变量
});

const { text } = await generateText({
  model: volcengine.chat('doubao-seed-1-6-flash-250828'),
  prompt: '你好，请介绍一下你自己。',
});

console.log(text);
```

### 流式输出

```typescript
import { streamText } from 'ai';
import { createVolcengine } from '@qyb/volcengine-ai-sdk-provider';

const volcengine = createVolcengine();

const { textStream } = await streamText({
  model: volcengine.chat('your-model-endpoint-id'),
  prompt: '写一首关于春天的诗。',
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

### 图像生成

```typescript
import { generateImage } from 'ai';
import { createVolcengine } from '@qyb/volcengine-ai-sdk-provider';

const volcengine = createVolcengine();

const { images } = await generateImage({
  model: volcengine.image('doubao-seedream-4-0-250828'),
  prompt: '一只可爱的猫咪在阳光下睡觉',
  n: 1,
  size: '1024x1024',
});

console.log(images[0]); // base64 编码的图片
```

### 工具调用

```typescript
import { generateText, tool, stepCountIs } from 'ai';
import { createVolcengine } from '@qyb/volcengine-ai-sdk-provider';
import { z } from 'zod';

const volcengine = createVolcengine();

const { text, toolCalls } = await generateText({
  model: volcengine.chat('doubao-seed-1-6-flash-250828'),
  prompt: '北京今天的天气怎么样？',
  tools: {
    getWeather: tool({
      description: '获取指定城市的天气',
      inputSchema: z.object({
        city: z.string().describe('城市名称'),
      }),
      execute: async ({ city }) => {
        return { temperature: 25, condition: '晴天' };
      },
    }),
  },
  stopWhen: stepCountIs(2),
});

// 获取所有步骤
console.log('所有步骤:', result.steps);

// 获取第一步的工具调用和结果
const step1 = result.steps[0];
console.log('Step 1 工具调用:', step1.toolCalls);
console.log('Step 1 工具结果:', step1.toolResults);

console.log('最终回复:', result.text);
```

## 配置选项（以下内容为 AI 自动生成，尚未人工确认）

### Provider 配置

```typescript
const volcengine = createVolcengine({
  apiKey: 'your-api-key',           // API 密钥
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3', // API 基础 URL
  headers: { 'X-Custom': 'value' }, // 自定义请求头
});
```

### 聊天模型配置

```typescript
const model = volcengine.chat('endpoint-id', {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stop: ['\n\n'],
  user: 'user-id',
});
```

### 图像模型配置

```typescript
const model = volcengine.image('endpoint-id', {
  n: 1,
  size: '1024x1024',
  quality: 'standard',
  style: 'natural',
  responseFormat: 'b64_json', // 'b64_json' | 'url'
  user: 'user-id',
});
```

## API 端点

- 聊天补全: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- 图像生成: `https://ark.cn-beijing.volces.com/api/v3/images/generations`

## 环境变量

| 变量名 | 描述 |
|--------|------|
| `VOLCENGINE_API_KEY` | 火山引擎 API 密钥 |

## 项目结构

```
volcengine-ai-sdk-provider/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                          # 导出入口
│   ├── volcengine-provider.ts            # Provider 工厂函数
│   ├── volcengine-chat-language-model.ts # LanguageModelV3 实现
│   ├── volcengine-image-model.ts         # ImageModelV3 实现
│   ├── volcengine-chat-settings.ts       # 聊天模型配置类型
│   ├── volcengine-image-settings.ts      # 图片模型配置类型
│   ├── convert-to-volcengine-messages.ts # 消息格式转换
│   └── map-volcengine-finish-reason.ts   # 完成原因映射
└── dist/                                 # 编译输出目录
```

## 开发

```bash
npm install     # 安装依赖
npm run build   # 编译
npm run dev     # 监听模式编译
npm run clean   # 清理构建产物
```

## 许可证

MIT
