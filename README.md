# Whisper 语音转文本 Node.js 应用

这是一个使用 Express 和 OpenAI Whisper 构建的语音转文本应用，可以将音频文件转换为文本，并支持将转录结果翻译成多种语言。

## 功能特点

- 上传音频文件并使用 Whisper 进行转录
- 支持选择不同的语言（中文、英文、自动检测）
- 支持选择不同的模型大小（大型、中型、小型）
- 支持将转录结果翻译成多种语言（英文、中文、西班牙语等）
- 可自定义翻译 API 地址
- 简洁直观的用户界面
- RESTful API 支持

## 前提条件

在使用此应用之前，请确保您已经安装了以下软件：

1. Node.js (v14+)
2. OpenAI Whisper (已正确安装并配置在本地环境中)

## 安装步骤

1. 克隆此仓库：

```bash
git clone <repository-url>
cd whisper-node
```

2. 安装依赖：

```bash
yarn install
# 或者
npm install
```

3. 编译 TypeScript 代码：

```bash
yarn build
# 或者
npm run build
```

4. 启动服务器：

```bash
yarn start
# 或者
npm start
```

5. 在浏览器中访问：`http://localhost:3000`

## API 使用说明

### 转录音频并翻译

**端点**：`POST /transcribe`

**请求格式**：`multipart/form-data`

**参数**：
- `audio`：音频文件（必需）
- `language`：音频语言代码（可选，默认为 'zh'）
- `model`：模型大小（可选，默认为 'large'）
- `translateTo`：目标翻译语言代码（可选，默认为 'en'）
- `translateApiUrl`：自定义翻译 API 地址（可选，默认为 'https://libretranslate.com/translate'）

**响应示例**：

成功：
```json
{
  "success": true,
  "transcription": "这是转录的文本内容...",
  "translatedText": "This is the translated text content...",
  "audioFile": "1234567890-audio.wav",
  "outputFile": "1234567890-audio.txt"
}
```

失败：
```json
{
  "error": "转录处理失败",
  "details": "错误详情..."
}
```

## 翻译 API

默认情况下，应用使用 LibreTranslate API 进行翻译。您可以在高级选项中自定义翻译 API 地址。

翻译 API 需要支持以下请求格式：

```javascript
fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    q: text,           // 要翻译的文本
    source: srcLang,   // 源语言代码
    target: targetLang // 目标语言代码
  })
})
```

响应格式应为：

```json
{
  "translatedText": "翻译后的文本"
}
```

## 项目结构

```
whisper-node/
├── dist/               # 编译后的 JavaScript 文件
├── src/                # TypeScript 源代码
├── public/             # 静态文件
├── uploads/            # 上传的音频文件和转录结果
├── package.json        # 项目依赖和脚本
└── tsconfig.json       # TypeScript 配置
```

## 技术栈

- TypeScript
- Node.js
- Express
- Multer (文件上传)
- OpenAI Whisper
- LibreTranslate API (或其他翻译 API)

## 注意事项

- 确保 Whisper 已正确安装并可以通过命令行访问
- 上传的音频文件和生成的转录文本存储在 `uploads` 目录中
- 默认情况下，服务器运行在端口 3000，可以通过环境变量 `PORT` 进行修改
- 翻译功能依赖于外部 API，请确保网络连接正常

## 许可证

MIT 