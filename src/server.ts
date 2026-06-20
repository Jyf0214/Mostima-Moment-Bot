import express from 'express';
import { webhookRouter } from './routes/webhook';

const app = express();
const PORT = process.env.BOT_PORT || 3001;

// 中间件：解析 JSON 并保留原始 Body 用于签名验证
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// 路由
app.use('/api/webhook', webhookRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'manticore-bot' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Manticore Bot running on port ${PORT}`);
});
