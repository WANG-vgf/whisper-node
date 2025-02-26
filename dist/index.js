"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
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
// 创建HTML页面
const htmlContent = `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Whisper语音转文本</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      color: #333;
      text-align: center;
    }
    .container {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    select, input[type="file"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #45a049;
    }
    #result {
      margin-top: 20px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: #fff;
      min-height: 100px;
    }
    .loading {
      text-align: center;
      display: none;
    }
    .error {
      color: #d9534f;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>Whisper语音转文本</h1>
  <div class="container">
    <form id="uploadForm" enctype="multipart/form-data">
      <div class="form-group">
        <label for="audio">选择音频文件:</label>
        <input type="file" id="audio" name="audio" accept="audio/*" required>
      </div>
      <div class="form-group">
        <label for="language">语言:</label>
        <select id="language" name="language">
          <option value="zh">中文</option>
          <option value="en">英文</option>
          <option value="auto">自动检测</option>
        </select>
      </div>
      <div class="form-group">
        <label for="model">模型:</label>
        <select id="model" name="model">
          <option value="large">大型模型 (最准确)</option>
          <option value="medium">中型模型</option>
          <option value="small">小型模型 (最快)</option>
        </select>
      </div>
      <button type="submit">开始转录</button>
    </form>
    
    <div class="loading" id="loading">
      <p>正在处理，请稍候...</p>
    </div>
    
    <div id="result">
      <p>转录结果将显示在这里...</p>
    </div>
  </div>

  <script>
    document.getElementById('uploadForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const resultDiv = document.getElementById('result');
      const loadingDiv = document.getElementById('loading');
      
      // 显示加载状态
      loadingDiv.style.display = 'block';
      resultDiv.innerHTML = '<p>正在处理，请稍候...</p>';
      
      try {
        const response = await fetch('/transcribe', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        // 隐藏加载状态
        loadingDiv.style.display = 'none';
        
        if (data.success) {
          resultDiv.innerHTML = '<h3>转录结果:</h3><p>' + data.transcription + '</p>';
        } else {
          resultDiv.innerHTML = '<p class="error">错误: ' + (data.error || '未知错误') + '</p>';
          if (data.details) {
            resultDiv.innerHTML += '<p>' + data.details + '</p>';
          }
        }
      } catch (error) {
        // 隐藏加载状态
        loadingDiv.style.display = 'none';
        resultDiv.innerHTML = '<p class="error">请求失败: ' + error.message + '</p>';
      }
    });
  </script>
</body>
</html>
`;
// 写入HTML文件
fs_1.default.writeFileSync(path_1.default.join(publicDir, 'index.html'), htmlContent);
// 路由定义
// 语音转文本路由
app.post('/transcribe', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '未提供音频文件' });
    }
    const audioFilePath = req.file.path;
    const language = req.body.language || 'zh'; // 默认中文
    const model = req.body.model || 'large'; // 默认使用large模型
    // 构建Whisper命令
    const command = `whisper "${audioFilePath}" --language ${language} --fp16 False --model ${model}`;
    console.log(`执行命令: ${command}`);
    // 执行Whisper命令
    (0, child_process_1.exec)(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`执行出错: ${error.message}`);
            return res.status(500).json({ error: '转录处理失败', details: error.message });
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
                res.json({
                    success: true,
                    transcription,
                    audioFile: path_1.default.basename(audioFilePath),
                    outputFile: path_1.default.basename(txtFilePath)
                });
            }
            else {
                res.status(404).json({
                    error: '转录文件未找到',
                    command,
                    stdout
                });
            }
        }
        catch (readError) {
            const errorMessage = readError instanceof Error ? readError.message : String(readError);
            res.status(500).json({
                error: '读取转录结果失败',
                details: errorMessage
            });
        }
    });
});
// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(publicDir, 'index.html'));
});
// 用户路由
app.get('/users', (req, res) => {
    res.json([
        { id: 1, name: '张三' },
        { id: 2, name: '李四' },
        { id: 3, name: '王五' }
    ]);
});
// 获取单个用户信息
app.get('/users/:id', (req, res) => {
    const userId = req.params.id;
    res.json({ id: userId, name: `用户${userId}` });
});
// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    console.log(`请访问 http://localhost:${port} 使用语音转文本功能`);
});
