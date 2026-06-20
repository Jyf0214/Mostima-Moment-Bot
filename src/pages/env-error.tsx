'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Badge,
  Loader,
  Center,
  Group,
  ThemeIcon,
  Button,
} from '@mantine/core';
import { IconAlertTriangle, IconX, IconCheck, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface EnvStatus {
  isConfigured: boolean;
  missing: string[];
  present: string[];
  message: string;
}

const STEPS_KEYS = ['envError.step1', 'envError.step2', 'envError.step3'] as const;

export default function EnvErrorPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);

  useEffect(() => {
    checkEnvStatus();
  }, []);

  const checkEnvStatus = async () => {
    try {
      const response = await fetch('/api/env-check');
      const data = await response.json();
      setEnvStatus(data);
    } catch (err) {
      console.error('Failed to check environment variables:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="xl" color="red" />
          <Text c="dimmed" size="sm">
            Loading...
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ff4b2b 0%, #ff416c 40%, #2d1b69 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <Container size="sm" w="100%">
        <Paper
          shadow="xl"
          p="xl"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Stack gap="lg" align="center">
            {/* Warning Icon */}
            <ThemeIcon size={72} radius="xl" variant="light" color="red">
              <IconAlertTriangle size={36} />
            </ThemeIcon>

            {/* Title */}
            <Title order={2} ta="center" c="dark">
              {t('envError.title')}
            </Title>

            {/* Description */}
            <Text c="dimmed" ta="center" size="sm" maw={400}>
              {t('envError.description')}
            </Text>

            {envStatus && (
              <Stack gap="md" w="100%">
                {/* Missing Variables */}
                {envStatus.missing.length > 0 && (
                  <Paper p="md" radius="md" bg="red.0" withBorder>
                    <Group gap="xs" mb="sm">
                      <ThemeIcon size={20} radius="xl" variant="light" color="red">
                        <IconX size={12} />
                      </ThemeIcon>
                      <Text fw={600} size="sm" c="red.7">
                        {t('envError.missingVars')}
                      </Text>
                      <Badge color="red" variant="filled" size="sm" circle>
                        {envStatus.missing.length}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      {envStatus.missing.map((envVar) => (
                        <Badge
                          key={envVar}
                          color="red"
                          variant="light"
                          leftSection={<IconX size={10} />}
                        >
                          {envVar}
                        </Badge>
                      ))}
                    </Group>
                  </Paper>
                )}

                {/* Present Variables */}
                {envStatus.present.length > 0 && (
                  <Paper p="md" radius="md" bg="green.0" withBorder>
                    <Group gap="xs" mb="sm">
                      <ThemeIcon size={20} radius="xl" variant="light" color="green">
                        <IconCheck size={12} />
                      </ThemeIcon>
                      <Text fw={600} size="sm" c="green.7">
                        {t('envError.presentVars')}
                      </Text>
                      <Badge color="green" variant="filled" size="sm" circle>
                        {envStatus.present.length}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      {envStatus.present.map((envVar) => (
                        <Badge
                          key={envVar}
                          color="green"
                          variant="light"
                          leftSection={<IconCheck size={10} />}
                        >
                          {envVar}
                        </Badge>
                      ))}
                    </Group>
                  </Paper>
                )}

                {/* Solution Steps */}
                <Paper p="md" radius="md" bg="blue.0" withBorder>
                  <Group gap="xs" mb="sm">
                    <ThemeIcon size={20} radius="xl" variant="light" color="blue">
                      <Text size="xs" fw={700}>
                        ?
                      </Text>
                    </ThemeIcon>
                    <Text fw={600} size="sm" c="blue.7">
                      {t('envError.solution')}
                    </Text>
                  </Group>
                  <Stack gap="sm">
                    {STEPS_KEYS.map((key, index) => (
                      <Group key={key} gap="sm" align="flex-start">
                        <ThemeIcon
                          size={24}
                          radius="xl"
                          variant="filled"
                          color="blue"
                          flex="0 0 auto"
                        >
                          <Text size="xs" fw={700}>
                            {index + 1}
                          </Text>
                        </ThemeIcon>
                        <Text size="sm">{t(key)}</Text>
                      </Group>
                    ))}
                    <Text size="xs" c="dimmed" ml="xl">
                      {t('envError.step4')}
                    </Text>
                  </Stack>
                </Paper>

                {/* Retry Button */}
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconRefresh size={16} />}
                  onClick={checkEnvStatus}
                  fullWidth
                  size="md"
                >
                  {t('envError.retry')}
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
