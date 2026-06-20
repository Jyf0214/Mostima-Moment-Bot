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
  Box,
  Group,
  Stepper,
  ThemeIcon,
  Divider,
  SimpleGrid,
  Card,
  Badge,
} from '@mantine/core';
import {
  IconUpload,
  IconBrandGithub,
  IconCheck,
  IconAlertCircle,
  IconKey,
  IconSettings,
  IconRocket,
  IconArrowRight,
  IconArrowLeft,
  IconServer,
  IconFileCode,
  IconGitBranch,
  IconWebhook,
  IconChartBar,
  IconMessageCircle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

const featureIcons = [IconRocket, IconWebhook, IconChartBar, IconMessageCircle, IconSettings];

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
  const [activeStep, setActiveStep] = useState(0);

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

  const handleNext = () => {
    if (activeStep === 0 && (!privateKey || !appId || !webhookSecret)) {
      setError(t('setup.fillAllFields'));
      return;
    }
    if (activeStep === 1 && (!repoOwner || !repoName)) {
      setError(t('setup.fillAllFields'));
      return;
    }
    setError('');
    setActiveStep((prev) => Math.min(prev + 1, 2));
  };

  const handlePrevious = () => {
    setError('');
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  if (loading) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        }}
      >
        <Center h="100vh">
          <Stack align="center" gap="md">
            <Loader size="xl" color="blue" />
            <Text c="dimmed" size="sm">
              {t('setup.title')}
            </Text>
          </Stack>
        </Center>
      </Box>
    );
  }

  if (success) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        }}
      >
        <Center h="100vh" p="xl">
          <Paper
            shadow="xl"
            p={48}
            radius="xl"
            style={{
              maxWidth: 480,
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Stack align="center" gap="xl">
              <ThemeIcon
                size={96}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'teal', to: 'green', deg: 135 }}
              >
                <IconCheck size={48} />
              </ThemeIcon>

              <Stack align="center" gap="xs">
                <Title order={2} c="white">
                  {t('setup.complete')}
                </Title>
                <Text c="dimmed" size="md" ta="center">
                  {t('setup.completeSubtitle')}
                </Text>
              </Stack>

              <Button
                component="a"
                href="/api/auth/login"
                leftSection={<IconBrandGithub size={20} />}
                size="lg"
                radius="md"
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
                fullWidth
              >
                {t('setup.loginGithub')}
              </Button>
            </Stack>
          </Paper>
        </Center>
      </Box>
    );
  }

  if (!isNew) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        }}
      >
        <Center h="100vh" p="xl">
          <Paper
            shadow="xl"
            p={48}
            radius="xl"
            style={{
              maxWidth: 480,
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Stack align="center" gap="xl">
              <ThemeIcon
                size={72}
                radius="xl"
                variant="gradient"
                gradient={{ from: 'blue', to: 'violet', deg: 135 }}
              >
                <IconBrandGithub size={36} />
              </ThemeIcon>

              <Stack align="center" gap="xs">
                <Title order={2} c="white">
                  {t('setup.welcomeBack')}
                </Title>
                <Text c="dimmed" size="md" ta="center">
                  {t('setup.welcomeBackSubtitle')}
                </Text>
              </Stack>

              <Button
                component="a"
                href="/api/auth/login"
                leftSection={<IconBrandGithub size={20} />}
                size="lg"
                radius="md"
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
                fullWidth
              >
                {t('setup.loginGithub')}
              </Button>
            </Stack>
          </Paper>
        </Center>
      </Box>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      }}
    >
      <Container size="xl" py="xl">
        {/* Header */}
        <Stack align="center" gap="xs" mb="xl">
          <Title order={1} c="white">
            {t('setup.title')}
          </Title>
          <Text c="dimmed" size="lg">
            {t('setup.subtitle')}
          </Text>
        </Stack>

        {/* Stepper */}
        <Paper
          shadow="xl"
          p="lg"
          radius="xl"
          mb="xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Stepper active={activeStep} onStepClick={setActiveStep} color="blue" size="lg">
            <Stepper.Step
              label={t('setup.stepCredentials')}
              description={t('setup.stepCredentialsDesc')}
              icon={<IconKey size={18} />}
              completedIcon={<IconCheck size={18} />}
            />
            <Stepper.Step
              label={t('setup.stepRepository')}
              description={t('setup.stepRepositoryDesc')}
              icon={<IconGitBranch size={18} />}
              completedIcon={<IconCheck size={18} />}
            />
            <Stepper.Step
              label={t('setup.stepReview')}
              description={t('setup.stepReviewDesc')}
              icon={<IconRocket size={18} />}
              completedIcon={<IconCheck size={18} />}
            />
          </Stepper>
        </Paper>

        {error && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            mb="lg"
            radius="md"
            styles={{
              root: {
                background: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
              },
            }}
          >
            {error}
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {/* Left panel - Description */}
          <Paper
            shadow="xl"
            p="xl"
            radius="xl"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Stack gap="lg">
              <Group gap="md">
                <ThemeIcon
                  size={48}
                  radius="md"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'violet', deg: 135 }}
                >
                  <IconSettings size={24} />
                </ThemeIcon>
                <Title order={3} c="white">
                  {t('setup.featureTitle')}
                </Title>
              </Group>

              <Divider color="rgba(255, 255, 255, 0.1)" />

              <Stack gap="md">
                {[
                  t('setup.feature1'),
                  t('setup.feature2'),
                  t('setup.feature3'),
                  t('setup.feature4'),
                  t('setup.feature5'),
                ].map((feature, index) => {
                  const FeatureIcon = featureIcons[index];
                  return (
                    <Group key={index} gap="md" wrap="nowrap">
                      <ThemeIcon
                        size={36}
                        radius="md"
                        variant="light"
                        color="blue"
                        style={{ flexShrink: 0 }}
                      >
                        <FeatureIcon size={18} />
                      </ThemeIcon>
                      <Text c="rgba(255, 255, 255, 0.8)" size="sm">
                        {feature}
                      </Text>
                    </Group>
                  );
                })}
              </Stack>
            </Stack>
          </Paper>

          {/* Right panel - Form */}
          <Paper
            shadow="xl"
            p="xl"
            radius="xl"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Step 0: Credentials */}
            {activeStep === 0 && (
              <Stack gap="lg">
                <Group gap="md">
                  <ThemeIcon
                    size={40}
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
                  >
                    <IconKey size={20} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Title order={4} c="white">
                      {t('setup.credentialsTitle')}
                    </Title>
                    <Text c="dimmed" size="sm">
                      {t('setup.credentialsDesc')}
                    </Text>
                  </Stack>
                </Group>

                <Divider color="rgba(255, 255, 255, 0.1)" />

                <Card
                  p="lg"
                  radius="md"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Stack gap="md">
                    <FileInput
                      label={t('setup.privateKey')}
                      placeholder={t('setup.privateKeyPlaceholder')}
                      accept=".pem"
                      value={privateKey}
                      onChange={setPrivateKey}
                      required
                      leftSection={<IconUpload size={16} />}
                      size="md"
                      styles={{
                        input: {
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px dashed rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          minHeight: 56,
                        },
                        label: { color: 'rgba(255, 255, 255, 0.8)' },
                        placeholder: { color: 'rgba(255, 255, 255, 0.4)' },
                      }}
                    />

                    <TextInput
                      label={t('setup.appId')}
                      placeholder={t('setup.appIdPlaceholder')}
                      value={appId}
                      onChange={(e) => setAppId(e.currentTarget.value)}
                      required
                      size="md"
                      styles={{
                        input: {
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: 'white',
                        },
                        label: { color: 'rgba(255, 255, 255, 0.8)' },
                      }}
                    />

                    <TextInput
                      label={t('setup.webhookSecret')}
                      placeholder={t('setup.webhookSecretPlaceholder')}
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.currentTarget.value)}
                      required
                      size="md"
                      styles={{
                        input: {
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: 'white',
                        },
                        label: { color: 'rgba(255, 255, 255, 0.8)' },
                      }}
                    />
                  </Stack>
                </Card>

                <Group justify="flex-end" mt="md">
                  <Button
                    onClick={handleNext}
                    rightSection={<IconArrowRight size={16} />}
                    size="md"
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
                  >
                    {t('setup.next')}
                  </Button>
                </Group>
              </Stack>
            )}

            {/* Step 1: Repository */}
            {activeStep === 1 && (
              <Stack gap="lg">
                <Group gap="md">
                  <ThemeIcon
                    size={40}
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'blue', deg: 135 }}
                  >
                    <IconServer size={20} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Title order={4} c="white">
                      {t('setup.repoConfigTitle')}
                    </Title>
                    <Text c="dimmed" size="sm">
                      {t('setup.repoConfigDesc')}
                    </Text>
                  </Stack>
                </Group>

                <Divider color="rgba(255, 255, 255, 0.1)" />

                <Card
                  p="lg"
                  radius="md"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Stack gap="md">
                    <TextInput
                      label={t('setup.repoOwner')}
                      placeholder={t('setup.repoOwnerPlaceholder')}
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.currentTarget.value)}
                      required
                      leftSection={<IconBrandGithub size={16} />}
                      size="md"
                      styles={{
                        input: {
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: 'white',
                        },
                        label: { color: 'rgba(255, 255, 255, 0.8)' },
                        section: { color: 'rgba(255, 255, 255, 0.5)' },
                      }}
                    />

                    <TextInput
                      label={t('setup.repoName')}
                      placeholder={t('setup.repoNamePlaceholder')}
                      value={repoName}
                      onChange={(e) => setRepoName(e.currentTarget.value)}
                      required
                      leftSection={<IconFileCode size={16} />}
                      size="md"
                      styles={{
                        input: {
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: 'white',
                        },
                        label: { color: 'rgba(255, 255, 255, 0.8)' },
                        section: { color: 'rgba(255, 255, 255, 0.5)' },
                      }}
                    />
                  </Stack>
                </Card>

                <Group justify="space-between" mt="md">
                  <Button
                    onClick={handlePrevious}
                    leftSection={<IconArrowLeft size={16} />}
                    size="md"
                    radius="md"
                    variant="subtle"
                    color="gray"
                  >
                    {t('setup.previous')}
                  </Button>
                  <Button
                    onClick={handleNext}
                    rightSection={<IconArrowRight size={16} />}
                    size="md"
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'blue', to: 'cyan', deg: 135 }}
                  >
                    {t('setup.next')}
                  </Button>
                </Group>
              </Stack>
            )}

            {/* Step 2: Review */}
            {activeStep === 2 && (
              <Stack gap="lg">
                <Group gap="md">
                  <ThemeIcon
                    size={40}
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'green', to: 'teal', deg: 135 }}
                  >
                    <IconRocket size={20} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Title order={4} c="white">
                      {t('setup.reviewTitle')}
                    </Title>
                    <Text c="dimmed" size="sm">
                      {t('setup.reviewDesc')}
                    </Text>
                  </Stack>
                </Group>

                <Divider color="rgba(255, 255, 255, 0.1)" />

                {/* App Info */}
                <Card
                  p="lg"
                  radius="md"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Stack gap="md">
                    <Group gap="sm">
                      <IconKey size={16} color="var(--mantine-color-blue-4)" />
                      <Text fw={600} c="white" size="sm">
                        {t('setup.appInfo')}
                      </Text>
                    </Group>

                    <SimpleGrid cols={1} spacing="sm">
                      <Group justify="space-between">
                        <Text c="dimmed" size="sm">
                          {t('setup.privateKey')}:
                        </Text>
                        <Badge color={privateKey ? 'green' : 'red'} variant="light" size="sm">
                          {privateKey ? privateKey.name : t('setup.fillAllFields')}
                        </Badge>
                      </Group>

                      <Group justify="space-between">
                        <Text c="dimmed" size="sm">
                          {t('setup.appId')}:
                        </Text>
                        <Badge color={appId ? 'green' : 'red'} variant="light" size="sm">
                          {appId || '-'}
                        </Badge>
                      </Group>

                      <Group justify="space-between">
                        <Text c="dimmed" size="sm">
                          {t('setup.webhookSecret')}:
                        </Text>
                        <Badge color={webhookSecret ? 'green' : 'red'} variant="light" size="sm">
                          {webhookSecret ? '***' : '-'}
                        </Badge>
                      </Group>
                    </SimpleGrid>
                  </Stack>
                </Card>

                {/* Repo Info */}
                <Card
                  p="lg"
                  radius="md"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Stack gap="md">
                    <Group gap="sm">
                      <IconServer size={16} color="var(--mantine-color-violet-4)" />
                      <Text fw={600} c="white" size="sm">
                        {t('setup.repoInfo')}
                      </Text>
                    </Group>

                    <SimpleGrid cols={1} spacing="sm">
                      <Group justify="space-between">
                        <Text c="dimmed" size="sm">
                          {t('setup.repoOwner')}:
                        </Text>
                        <Badge color={repoOwner ? 'green' : 'red'} variant="light" size="sm">
                          {repoOwner || '-'}
                        </Badge>
                      </Group>

                      <Group justify="space-between">
                        <Text c="dimmed" size="sm">
                          {t('setup.repoName')}:
                        </Text>
                        <Badge color={repoName ? 'green' : 'red'} variant="light" size="sm">
                          {repoName || '-'}
                        </Badge>
                      </Group>
                    </SimpleGrid>
                  </Stack>
                </Card>

                <Group justify="space-between" mt="md">
                  <Button
                    onClick={handlePrevious}
                    leftSection={<IconArrowLeft size={16} />}
                    size="md"
                    radius="md"
                    variant="subtle"
                    color="gray"
                  >
                    {t('setup.previous')}
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    loading={submitting}
                    leftSection={<IconUpload size={16} />}
                    size="md"
                    radius="md"
                    variant="gradient"
                    gradient={{ from: 'green', to: 'teal', deg: 135 }}
                  >
                    {t('setup.saveConfig')}
                  </Button>
                </Group>
              </Stack>
            )}
          </Paper>
        </SimpleGrid>

        {/* Footer - Skip Login */}
        <Group justify="center" mt="xl">
          <Button
            component="a"
            href="/api/auth/login"
            variant="subtle"
            color="gray"
            leftSection={<IconBrandGithub size={18} />}
            size="md"
          >
            {t('setup.skipLogin')}
          </Button>
        </Group>
      </Container>
    </Box>
  );
}
