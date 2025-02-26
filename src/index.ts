import express, { Request, Response } from 'express';

// 创建 Express 应用
const app = express();
const port = process.env.PORT || 3000;

// 中间件设置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由定义
// 首页路由
app.get('/', (req: Request, res: Response) => {
  res.send('欢迎访问 Express 服务器！');
});

// 用户路由
app.get('/users', (req: Request, res: Response) => {
  res.json([
    { id: 1, name: '张三' },
    { id: 2, name: '李四' },
    { id: 3, name: '王五' }
  ]);
});

// 获取单个用户信息
app.get('/users/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  res.json({ id: userId, name: `用户${userId}` });
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 