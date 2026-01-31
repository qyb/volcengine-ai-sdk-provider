# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 构建命令

```bash
npm run build    # 编译 TypeScript 到 dist/
npm run dev      # 监听模式编译
npm run clean    # 删除 dist/ 目录
```

## 架构

这是一个火山引擎 (Volcengine) 的 Vercel AI SDK provider，实现了 **V3 规范**。

### 核心组件

- **volcengine-provider.ts** - 工厂函数 `createVolcengine()`，创建包含 `chat()` 和 `image()` 方法的 provider 实例
- **volcengine-chat-language-model.ts** - 实现 `LanguageModelV3` 接口，提供 `doGenerate()` 和 `doStream()` 方法用于聊天补全
- **volcengine-image-model.ts** - 实现 `ImageModelV3` 接口，提供 `doGenerate()` 方法用于图像生成

### 消息与类型转换

- **convert-to-volcengine-messages.ts** - 将 `LanguageModelV3Prompt` 转换为火山引擎的 OpenAI 兼容消息格式
- **map-volcengine-finish-reason.ts** - 将火山引擎的 finish reason 映射为 V3 的 `{ unified, raw }` 格式

### API 端点

- 聊天补全: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- 图像生成: `https://ark.cn-beijing.volces.com/api/v3/images/generations`

### V3 规范要点

- 所有模型类使用 `specificationVersion: 'v3'`
- `LanguageModelV3` 使用 `content` 数组替代 `text/toolCalls`
- 流式输出使用 `text-start/text-delta/text-end` 和 `tool-input-start/tool-input-delta/tool-input-end` 模式
- `LanguageModelV3FunctionTool` 使用 `inputSchema`（不是 `parameters`）
- `LanguageModelV3ToolCallPart` 使用 `input`（不是 `args`）
- `LanguageModelV3ToolResultPart` 使用 `output`（不是 `result`）
