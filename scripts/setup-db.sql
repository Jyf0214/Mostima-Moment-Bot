-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  github_login VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 应用配置表
CREATE TABLE IF NOT EXISTS app_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook 配置表
CREATE TABLE IF NOT EXISTS webhook_config (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(100) NOT NULL,
  webhook_secret_encrypted TEXT NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  repo_owner VARCHAR(255) NOT NULL,
  repo_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 构建记录表
CREATE TABLE IF NOT EXISTS builds (
  id SERIAL PRIMARY KEY,
  pr_number INTEGER NOT NULL,
  branch_name VARCHAR(255) NOT NULL,
  trigger_user VARCHAR(255) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  total_duration INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 构建步骤表
CREATE TABLE IF NOT EXISTS build_steps (
  id SERIAL PRIMARY KEY,
  build_id INTEGER REFERENCES builds(id),
  step_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  duration INTEGER,
  exit_code INTEGER,
  output TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_builds_pr_number ON builds(pr_number);
CREATE INDEX IF NOT EXISTS idx_builds_created_at ON builds(created_at);
CREATE INDEX IF NOT EXISTS idx_admins_github_id ON admins(github_id);
