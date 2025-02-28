import { exec } from 'child_process';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import fetch from 'node-fetch';
import ollama from 'ollama';
import path from 'path';

// 扩展Express的Request类型
declare global {
  namespace Express {
    interface Request {
      file?: Multer.File;
    }
  }
}

// 创建 Express 应用
const app = express();
const port = process.env.PORT || 3000;

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// 中间件设置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 确保public目录存在
const publicDir = path.join(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

/**
 * 翻译文本函数
 * @param text 要翻译的文本
 * @param sourceLanguage 源语言代码
 * @param targetLanguage 目标语言代码
 * @param apiUrl 翻译API的URL
 * @returns 翻译后的文本
 */
async function translateText(
  text: string, 
  sourceLanguage: string = 'zh', 
  targetLanguage: string = 'en',
  apiUrl: string = 'http://127.0.0.1:5000/translate'
): Promise<string> {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text',
        alternatives: 3,
        api_key: ''
      })
    });

    if (!response.ok) {
      throw new Error(`翻译请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { translatedText: string };
    return data.translatedText;
  } catch (error) {
    console.error('翻译出错:', error);
    throw error;
  }
}

/**
 * 多语言翻译函数
 * @param text 要翻译的文本
 * @param sourceLanguage 源语言代码
 * @param intermediateLanguage 中间语言代码（如英语）
 * @param targetLanguage 目标语言代码
 * @param apiUrl 翻译API的URL
 * @returns 包含所有翻译结果的对象
 */
async function multiTranslate(
  text: string,
  sourceLanguage: string = 'zh',
  intermediateLanguage: string = 'en',
  targetLanguage: string = 'th',
  apiUrl: string = 'http://127.0.0.1:5000/translate'
): Promise<{ englishText: string; thaiText: string }> {
  try {
    // 先翻译成英文
    const englishText = await translateText(text, sourceLanguage, intermediateLanguage, apiUrl);
    
    // 再从英文翻译成泰文
    const thaiText = await translateText(englishText, intermediateLanguage, targetLanguage, apiUrl);
    
    return {
      englishText,
      thaiText
    };
  } catch (error) {
    console.error('多语言翻译出错:', error);
    throw error;
  }
}

// 路由定义

// 优化/model路由
app.post('/model', async (req, res) => {
  console.log(`req.body`, req.body);
  
  // 流式返回内容
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');

  const message = req.body.message || '你是谁？'; // 从请求中获取消息
  const response = await ollama.chat({ model: 'deepseek-r1:14b', messages: [{ role: 'user', content: message }], stream: true });

  for await (const part of response) {
    // 发送每个部分
    res.write(`${part.message.content}`);
  }
  
  // res.end();
});

// 语音转文本路由
(app as any).post('/transcribe', upload.single('file'), async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: '未提供音频文件' });
  }

  const audioFilePath = req.file.path;
  const language = req.body.language || 'zh'; // 默认中文
  const model = req.body.model || 'large'; // 默认使用large模型
  
  // 翻译相关参数
  const translateApiUrl = req.body.translateApiUrl || 'http://127.0.0.1:5000/translate'; // 使用本地翻译API

  // 构建Whisper命令
  const command = `whisper "${audioFilePath}" --language ${language} --fp16 False --output_dir ./uploads --output_format txt`;

  console.log(`执行命令: ${command}`);

  // 执行Whisper命令
  exec(command, async (error, stdout, stderr) => {
    console.log(`执行Whisper命令`,{stdout, stderr, error});
    
    if (error) {
      console.error(`执行出错: ${error.message}`);
      return res.status(500)
        .set('Content-Type', 'application/json; charset=utf-8')
        .json({ error: '转录处理失败', details: error.message });
    }
    
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }

    // 获取生成的文本文件路径（Whisper默认输出与音频同名的.txt文件）
    const txtFilePath = audioFilePath.replace(/\.[^/.]+$/, '.txt');
    
    try {
      // 读取转录结果
      if (fs.existsSync(txtFilePath)) {
        const transcription = fs.readFileSync(txtFilePath, 'utf8');
        
        // 翻译转录文本（先翻译成英文，再翻译成泰文）
        let translations = {
          englishText: '',
          thaiText: ''
        };
        
        try {
          translations = await multiTranslate(
            transcription,
            language,
            'en',
            'th',
            translateApiUrl
          );
        } catch (translateError) {
          console.error('翻译失败:', translateError);
          // 翻译失败不影响整体流程，只是没有翻译结果
        }
        
        res.json({ 
          success: true, 
          transcription,
          englishText: translations.englishText,
          thaiText: translations.thaiText,
          audioFile: path.basename(audioFilePath),
          outputFile: path.basename(txtFilePath)
        });
      } else {
        res.status(404)
          .set('Content-Type', 'application/json; charset=utf-8')
          .json({ 
            error: '转录文件未找到',
            command,
            stdout
          });
      }
    } catch (readError: unknown) {
      const errorMessage = readError instanceof Error ? readError.message : String(readError);
      res.status(500)
        .set('Content-Type', 'application/json; charset=utf-8')
        .json({ 
          error: '读取转录结果失败', 
          details: errorMessage 
        });
    }
  });
});

// 首页路由
app.get('/', (req, res) => {
  res.send('欢迎访问 Express 服务器！');
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 