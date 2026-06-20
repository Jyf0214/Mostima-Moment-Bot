'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Stack,
  Text,
  Title,
  Button,
  Loader,
  Center,
  Avatar,
  Group,
} from '@mantine/core';
import { IconClock, IconBrandGithub, IconLogout, IconSettings } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface User {
  githubId: number;
  githubLogin: string;
  avatarUrl: string;
  isAdmin: boolean;
}

export default function Home() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      // 检查应用状态
      const statusRes = await fetch('/api/auth/status');
      const statusData = await statusRes.json();
      setIsNew(statusData.isNew);

      if (statusData.isNew) {
        // 全新应用，跳转到设置页面
        window.location.href = '/setup';
        return;
      }

      // 检查用户登录状态
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
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
        <Stack align="center" gap="md">
          <IconClock size={48} color="var(--mantine-color-blue-6)" />
          <Title order={1}>{t('app.title')}</Title>
          <Text c="dimmed" size="lg" ta="center">
            {t('home.subtitle')}
          </Text>

          {user ? (
            <>
              <Group>
                <Avatar src={user.avatarUrl} size="lg" radius="xl" />
                <Stack gap={0}>
                  <Text fw={500}>{user.githubLogin}</Text>
                  <Text c="dimmed" size="sm">
                    {user.isAdmin ? t('home.admin') : t('home.user')}
                  </Text>
                </Stack>
              </Group>

              <Group>
                <Button
                  component="a"
                  href="/dashboard"
                  leftSection={<IconSettings size={20} />}
                  variant="light"
                >
                  {t('home.dashboard')}
                </Button>
                <Button
                  onClick={handleLogout}
                  leftSection={<IconLogout size={20} />}
                  variant="subtle"
                  color="red"
                >
                  {t('home.logout')}
                </Button>
              </Group>
            </>
          ) : (
            <Button
              component="a"
              href="/api/auth/login"
              leftSection={<IconBrandGithub size={20} />}
              size="lg"
            >
              {t('home.loginGithub')}
            </Button>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
