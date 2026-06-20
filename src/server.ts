import express from 'express';
import compression from 'compression';
import { webhookRouter } from './routes/webhook';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Manticore Bot running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// 处理服务器错误
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
});

// 处理进程退出
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
