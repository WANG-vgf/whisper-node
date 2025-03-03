"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const ollama_1 = __importDefault(require("ollama"));
const path_1 = __importDefault(require("path"));
// 创建 Express 应用
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// 配置文件上传
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../uploads');
        // 确保上传目录存在
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = (0, multer_1.default)({ storage });
// 中间件设置
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// 确保public目录存在
const publicDir = path_1.default.join(__dirname, '../public');
if (!fs_1.default.existsSync(publicDir)) {
    fs_1.default.mkdirSync(publicDir, { recursive: true });
}
/**
 * 翻译文本函数
 * @param text 要翻译的文本
 * @param targetLanguage 目标语言代码
 * @returns 翻译后的文本
 */
async function translateText(text, targetLanguage = 'en') {
    try {
        const response = await (0, node_fetch_1.default)('http://127.0.0.1:5000/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: text,
                source: 'auto',
                target: targetLanguage,
                format: 'text',
                alternatives: 3,
                api_key: ''
            })
        });
        if (!response.ok) {
            throw new Error(`翻译请求失败: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.translatedText;
    }
    catch (error) {
        console.error('翻译出错:', error);
        throw error;
    }
}
/**
 * 多语言翻译函数
 * @param text 要翻译的文本
 * @param targetLanguage 目标语言代码
 * @returns 包含所有翻译结果的对象
 */
async function multiTranslate(text, targetLanguage = 'en') {
    try {
        const _text = await translateText(text, targetLanguage);
        return [_text];
    }
    catch (error) {
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
    const response = await ollama_1.default.chat({ model: 'deepseek-r1:14b', messages: [{ role: 'user', content: message }], stream: true });
    for await (const part of response) {
        // 发送每个部分
        res.write(`${part.message.content}`);
    }
    // res.end();
});
// 语音转文本路由
app.post('/transcribe', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '未提供音频文件' });
    }
    console.log(`req.body`, req.body);
    const audioFilePath = req.file.path;
    const language = req.body.language || 'en'; // 默认中文
    const model = req.body.model || 'large'; // 默认使用large模型
    // 构建Whisper命令
    const command = `whisper "${audioFilePath}" --model ${model} --fp16 False --output_dir ./uploads --output_format txt`;
    console.log(`执行命令: ${command}`);
    // 执行Whisper命令
    (0, child_process_1.exec)(command, async (error, stdout, stderr) => {
        console.log(`执行Whisper命令`, { stdout, stderr, error });
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
            if (fs_1.default.existsSync(txtFilePath)) {
                const transcription = fs_1.default.readFileSync(txtFilePath, 'utf8');
                // 翻译转录文本（先翻译成英文，再翻译成泰文）
                let translations = [];
                try {
                    translations = await multiTranslate(transcription, language);
                }
                catch (translateError) {
                    console.error('翻译失败:', translateError);
                    // 翻译失败不影响整体流程，只是没有翻译结果
                }
                res.json({
                    success: true,
                    transcription,
                    translations,
                });
            }
            else {
                res.status(404)
                    .set('Content-Type', 'application/json; charset=utf-8')
                    .json({
                    error: '转录文件未找到',
                    command,
                    stdout
                });
            }
        }
        catch (readError) {
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
