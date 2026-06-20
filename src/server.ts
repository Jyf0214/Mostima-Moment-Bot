import express from 'express';
import compression from 'compression';
import { webhookRouter } from './routes/webhook';

const app = express();
// 支持 PORT 和 BOT_PORT，优先使用 BOT_PORT
const PORT = process.env.BOT_PORT || process.env.PORT || 3001;

// 启用 gzip 压缩
app.use(compression());

// 中间件：解析 JSON 并保留原始 Body 用于签名验证
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

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
