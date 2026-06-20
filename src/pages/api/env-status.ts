import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import i18n from '@/i18n';

const JWT_SECRET = process.env.JWT_SECRET;

interface EnvVarDef {
  key: string;
  categoryKey: string;
  required: boolean;
  descriptionKey: string;
  usageKey: string;
  hintKey: string;
}

interface JwtPayload {
  githubId: number;
}

const ENV_VARS: EnvVarDef[] = [
  // Required
  {
    key: 'GITHUB_CLIENT_ID',
    categoryKey: 'envCategory.oauth',
    required: true,
    descriptionKey: 'envVarDescriptions.githubClientId',
    usageKey: 'envUsage.githubClientId',
    hintKey: 'envVarHints.githubClientId',
  },
  {
    key: 'GITHUB_CLIENT_SECRET',
    categoryKey: 'envCategory.oauth',
    required: true,
    descriptionKey: 'envVarDescriptions.githubClientSecret',
    usageKey: 'envUsage.githubClientSecret',
    hintKey: 'envVarHints.githubClientSecret',
  },
  {
    key: 'JWT_SECRET',
    categoryKey: 'envCategory.security',
    required: true,
    descriptionKey: 'envVarDescriptions.jwtSecret',
    usageKey: 'envUsage.jwtSecret',
    hintKey: 'envVarHints.jwtSecret',
  },
  {
    key: 'ENCRYPTION_KEY',
    categoryKey: 'envCategory.security',
    required: true,
    descriptionKey: 'envVarDescriptions.encryptionKey',
    usageKey: 'envUsage.encryptionKey',
    hintKey: 'envVarHints.encryptionKey',
  },
  {
    key: 'DATABASE_URL',
    categoryKey: 'envCategory.database',
    required: true,
    descriptionKey: 'envVarDescriptions.databaseUrl',
    usageKey: 'envUsage.databaseUrl',
    hintKey: 'envVarHints.databaseUrl',
  },
  // GitHub App
  {
    key: 'GITHUB_APP_ID',
    categoryKey: 'envCategory.githubApp',
    required: false,
    descriptionKey: 'envVarDescriptions.githubAppId',
    usageKey: 'envUsage.githubAppId',
    hintKey: 'envVarHints.githubAppId',
  },
  {
    key: 'GITHUB_APP_SLUG',
    categoryKey: 'envCategory.githubApp',
    required: false,
    descriptionKey: 'envVarDescriptions.githubAppSlug',
    usageKey: 'envUsage.githubAppSlug',
    hintKey: 'envVarHints.githubAppSlug',
  },
  {
    key: 'GITHUB_PRIVATE_KEY_PATH',
    categoryKey: 'envCategory.githubApp',
    required: false,
    descriptionKey: 'envVarDescriptions.githubPrivateKeyPath',
    usageKey: 'envUsage.githubPrivateKeyPath',
    hintKey: 'envVarHints.githubPrivateKeyPath',
  },
  // CI/CD
  {
    key: 'REPO_OWNER',
    categoryKey: 'envCategory.cicd',
    required: false,
    descriptionKey: 'envVarDescriptions.repoOwner',
    usageKey: 'envUsage.repoOwner',
    hintKey: 'envVarHints.repoOwner',
  },
  {
    key: 'REPO_NAME',
    categoryKey: 'envCategory.cicd',
    required: false,
    descriptionKey: 'envVarDescriptions.repoName',
    usageKey: 'envUsage.repoName',
    hintKey: 'envVarHints.repoName',
  },
  {
    key: 'COLLABORATORS',
    categoryKey: 'envCategory.cicd',
    required: false,
    descriptionKey: 'envVarDescriptions.collaborators',
    usageKey: 'envUsage.collaborators',
    hintKey: 'envVarHints.collaborators',
  },
  {
    key: 'WORKSPACE_DIR',
    categoryKey: 'envCategory.cicd',
    required: false,
    descriptionKey: 'envVarDescriptions.workspaceDir',
    usageKey: 'envUsage.workspaceDir',
    hintKey: 'envVarHints.workspaceDir',
  },
  // App
  {
    key: 'APP_URL',
    categoryKey: 'envCategory.app',
    required: false,
    descriptionKey: 'envVarDescriptions.appUrl',
    usageKey: 'envUsage.appUrl',
    hintKey: 'envVarHints.appUrl',
  },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const categoryMap = new Map<string, typeof ENV_VARS>();
  for (const v of ENV_VARS) {
    if (!categoryMap.has(v.categoryKey)) {
      categoryMap.set(v.categoryKey, []);
    }
    categoryMap.get(v.categoryKey)!.push(v);
  }

  const groups = Array.from(categoryMap.entries()).map(([catKey, vars]) => ({
    name: i18n.t(catKey),
    description: i18n.t(`${catKey}Desc`),
    vars: vars.map((v) => ({
      key: v.key,
      category: i18n.t(v.categoryKey),
      required: v.required,
      configured: !!process.env[v.key],
      description: i18n.t(v.descriptionKey),
      usage: i18n.t(v.usageKey),
      hint: i18n.t(v.hintKey),
    })),
  }));

  return res.status(200).json({ groups });
}
