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
      setError(t('setup.checkStatusFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!privateKey || !appId || !webhookSecret || !repoOwner || !repoName) {
      setError(t('setup.fillAllFields'));
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
        throw new Error(data.error || t('setup.setupFailed'));
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
            <Title order={2}>{t('setup.complete')}</Title>
            <Text c="dimmed">{t('setup.completeSubtitle')}</Text>
            <Button
              component="a"
              href="/api/auth/login"
              leftSection={<IconBrandGithub size={20} />}
              size="lg"
            >
              {t('setup.loginGithub')}
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
            <Title order={2}>{t('setup.welcomeBack')}</Title>
            <Text c="dimmed">{t('setup.welcomeBackSubtitle')}</Text>
            <Button
              component="a"
              href="/api/auth/login"
              leftSection={<IconBrandGithub size={20} />}
              size="lg"
            >
              {t('setup.loginGithub')}
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
          <Title order={2}>{t('setup.title')}</Title>
          <Text c="dimmed">{t('setup.subtitle')}</Text>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          <FileInput
            label={t('setup.privateKey')}
            accept=".pem"
            value={privateKey}
            onChange={setPrivateKey}
            required
          />

          <TextInput
            label={t('setup.appId')}
            placeholder={t('setup.appIdPlaceholder')}
            value={appId}
            onChange={(e) => setAppId(e.currentTarget.value)}
            required
          />

          <TextInput
            label={t('setup.webhookSecret')}
            placeholder={t('setup.webhookSecretPlaceholder')}
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.currentTarget.value)}
            required
          />

          <TextInput
            label={t('setup.repoOwner')}
            placeholder={t('setup.repoOwnerPlaceholder')}
            value={repoOwner}
            onChange={(e) => setRepoOwner(e.currentTarget.value)}
            required
          />

          <TextInput
            label={t('setup.repoName')}
            placeholder={t('setup.repoNamePlaceholder')}
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
            {t('setup.saveConfig')}
          </Button>

          <Button
            component="a"
            href="/api/auth/login"
            variant="subtle"
            leftSection={<IconBrandGithub size={20} />}
          >
            {t('setup.skipLogin')}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
