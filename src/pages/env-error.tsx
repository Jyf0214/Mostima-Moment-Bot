'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Alert,
  Loader,
  Center,
  Code,
  List,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertCircle, IconX, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface EnvStatus {
  isConfigured: boolean;
  missing: string[];
  present: string[];
  message: string;
}

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
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <Container size="md" py="xl">
      <Paper shadow="md" p="xl" radius="md">
        <Stack gap="md">
          <Title order={2} c="red">
            ⚠️ {t('envError.title')}
          </Title>

          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {t('envError.description')}
          </Alert>

          {envStatus && (
            <>
              <Text>{envStatus.message}</Text>

              {envStatus.missing.length > 0 && (
                <div>
                  <Text fw={500} mb="xs">
                    {t('envError.missingVars')}
                  </Text>
                  <List
                    size="sm"
                    center
                    icon={
                      <ThemeIcon color="red" size={16} radius="xl">
                        <IconX size={10} />
                      </ThemeIcon>
                    }
                  >
                    {envStatus.missing.map((envVar) => (
                      <List.Item key={envVar}>
                        <Code>{envVar}</Code>
                      </List.Item>
                    ))}
                  </List>
                </div>
              )}

              {envStatus.present.length > 0 && (
                <div>
                  <Text fw={500} mb="xs">
                    {t('envError.presentVars')}
                  </Text>
                  <List
                    size="sm"
                    center
                    icon={
                      <ThemeIcon color="green" size={16} radius="xl">
                        <IconCheck size={10} />
                      </ThemeIcon>
                    }
                  >
                    {envStatus.present.map((envVar) => (
                      <List.Item key={envVar}>
                        <Code>{envVar}</Code>
                      </List.Item>
                    ))}
                  </List>
                </div>
              )}

              <Paper bg="gray.1" p="md" radius="md">
                <Text fw={500} mb="xs">
                  {t('envError.solution')}
                </Text>
                <Text size="sm">{t('envError.step1')}</Text>
                <Text size="sm">{t('envError.step2')}</Text>
                <Text size="sm">{t('envError.step3')}</Text>
                <Text size="sm" mt="xs" c="dimmed">
                  {t('envError.step4')}
                </Text>
              </Paper>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
