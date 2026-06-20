'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Stack,
  FileInput,
  TextInput,
  Alert,
  Loader,
  Center,
} from '@mantine/core';
import { IconUpload, IconBrandGithub, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export default function SetupPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [privateKey, setPrivateKey] = useState<File | null>(null);
  const [appId, setAppId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAppStatus();
  }, []);

  const checkAppStatus = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setIsNew(data.isNew);
    } catch (err) {
      setError('检查应用状态失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!privateKey || !appId || !webhookSecret || !repoOwner || !repoName) {
      setError('请填写所有必填字段');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('privateKey', privateKey);
      formData.append('appId', appId);
      formData.append('webhookSecret', webhookSecret);
      formData.append('repoOwner', repoOwner);
      formData.append('repoName', repoName);

      const response = await fetch('/api/setup', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '设置失败');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="xl" />
      </Center>
    );
  }

  if (success) {
    return (
      <Container size="sm" py="xl">
        <Paper shadow="md" p="xl" radius="md">
          <Stack align="center" gap="md">
            <IconCheck size={48} color="var(--mantine-color-green-6)" />
            <Title order={2}>设置完成</Title>
            <Text c="dimmed">应用已配置成功，请登录以继续</Text>
            <Button
              component="a"
              href="/api/auth/login"
              leftSection={<IconBrandGithub size={20} />}
              size="lg"
            >
              使用 GitHub 登录
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (!isNew) {
    return (
      <Container size="sm" py="xl">
        <Paper shadow="md" p="xl" radius="md">
          <Stack align="center" gap="md">
            <Title order={2}>欢迎回来</Title>
            <Text c="dimmed">请使用 GitHub 登录</Text>
            <Button
              component="a"
              href="/api/auth/login"
              leftSection={<IconBrandGithub size={20} />}
              size="lg"
            >
              使用 GitHub 登录
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Paper shadow="md" p="xl" radius="md">
        <Stack gap="md">
          <Title order={2}>初始设置</Title>
          <Text c="dimmed">首次使用，请完成以下配置</Text>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          <FileInput
            label="GitHub App 私钥文件"
            accept=".pem"
            value={privateKey}
            onChange={setPrivateKey}
            required
          />

          <TextInput
            label="GitHub App ID"
            placeholder="输入 App ID"
            value={appId}
            onChange={(e) => setAppId(e.currentTarget.value)}
            required
          />

          <TextInput
            label="Webhook Secret"
            placeholder="输入 Webhook Secret"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.currentTarget.value)}
            required
          />

          <TextInput
            label="仓库所有者"
            placeholder="例如: username"
            value={repoOwner}
            onChange={(e) => setRepoOwner(e.currentTarget.value)}
            required
          />

          <TextInput
            label="仓库名称"
            placeholder="例如: Mostima-Moment-Bot"
            value={repoName}
            onChange={(e) => setRepoName(e.currentTarget.value)}
            required
          />

          <Button
            onClick={handleSubmit}
            loading={submitting}
            leftSection={<IconUpload size={20} />}
            size="lg"
          >
            保存配置
          </Button>

          <Button
            component="a"
            href="/api/auth/login"
            variant="subtle"
            leftSection={<IconBrandGithub size={20} />}
          >
            跳过，直接登录
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
