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
  Badge,
  ThemeIcon,
  SimpleGrid,
  Box,
  ActionIcon,
  Divider,
  Card,
} from '@mantine/core';
import {
  IconBrandGithub,
  IconLogout,
  IconSettings,
  IconTerminal2,
  IconFileReport,
  IconLock,
  IconRocket,
  IconArrowRight,
} from '@tabler/icons-react';
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
      const statusRes = await fetch('/api/auth/status');
      const statusData = await statusRes.json();
      setIsNew(statusData.isNew);

      if (statusData.isNew) {
        window.location.href = '/setup';
        return;
      }

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
    <Box>
      {/* Hero Section */}
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #1e3a5f 70%, #1e40af 100%)',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative background elements */}
        <Box
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '-15%',
            left: '-5%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Container size="lg" style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <Stack align="center" gap={40} py={80}>
            {/* Tagline badge */}
            <Badge
              variant="light"
              color="blue"
              size="lg"
              radius="xl"
              tt="uppercase"
              fw={600}
              styles={{
                root: {
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  color: '#93c5fd',
                  padding: '8px 20px',
                },
              }}
            >
              <Group gap={6}>
                <IconRocket size={14} />
                {t('home.heroTagline')}
              </Group>
            </Badge>

            {/* Main title */}
            <Title
              order={1}
              ta="center"
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #60a5fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('app.title')}
            </Title>

            {/* Subtitle */}
            <Text
              ta="center"
              size="xl"
              maw={600}
              style={{
                color: '#94a3b8',
                lineHeight: 1.7,
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              }}
            >
              {t('home.heroDescription')}
            </Text>

            {/* CTA Buttons */}
            <Group gap="md" mt="md">
              {user ? (
                <>
                  <Button
                    component="a"
                    href="/dashboard"
                    size="lg"
                    radius="md"
                    leftSection={<IconSettings size={20} />}
                    rightSection={<IconArrowRight size={18} />}
                    styles={{
                      root: {
                        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                        border: 'none',
                        boxShadow: '0 4px 24px rgba(37,99,235,0.4)',
                        fontWeight: 600,
                        padding: '0 32px',
                        height: 48,
                      },
                    }}
                  >
                    {t('home.dashboard')}
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={48}
                    radius="md"
                    onClick={handleLogout}
                    title={t('home.logout')}
                    styles={{
                      root: {
                        color: '#94a3b8',
                        border: '1px solid rgba(148,163,184,0.2)',
                      },
                    }}
                  >
                    <IconLogout size={20} />
                  </ActionIcon>
                </>
              ) : (
                <Button
                  component="a"
                  href="/api/auth/login"
                  size="lg"
                  radius="md"
                  leftSection={<IconBrandGithub size={22} />}
                  rightSection={<IconArrowRight size={18} />}
                  styles={{
                    root: {
                      background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                      border: 'none',
                      boxShadow: '0 4px 24px rgba(37,99,235,0.4)',
                      fontWeight: 600,
                      padding: '0 32px',
                      height: 48,
                    },
                  }}
                >
                  {t('home.loginGithub')}
                </Button>
              )}
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Features Section */}
      <Box
        style={{
          background: '#f8fafc',
          padding: '80px 0',
        }}
      >
        <Container size="lg">
          <Stack align="center" gap={12} mb={60}>
            <Title
              order={2}
              ta="center"
              style={{
                fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              {t('home.featuresTitle')}
            </Title>
            <Text ta="center" size="lg" c="dimmed" maw={500}>
              {t('home.featuresSubtitle')}
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xl">
            <FeatureCard
              icon={<IconTerminal2 size={24} />}
              title={t('home.featureCicdTitle')}
              description={t('home.featureCicdDesc')}
              color="blue"
            />
            <FeatureCard
              icon={<IconFileReport size={24} />}
              title={t('home.featurePrTitle')}
              description={t('home.featurePrDesc')}
              color="violet"
            />
            <FeatureCard
              icon={<IconLock size={24} />}
              title={t('home.featureWebhookTitle')}
              description={t('home.featureWebhookDesc')}
              color="teal"
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* User Section (logged in) */}
      {user && (
        <Box style={{ background: '#ffffff', padding: '60px 0' }}>
          <Container size="md">
            <Card
              radius="lg"
              padding="xl"
              withBorder
              style={{
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
              }}
            >
              <Group justify="space-between" wrap="wrap" gap="md">
                <Group gap="md">
                  <Avatar src={user.avatarUrl} size={56} radius="xl" />
                  <Stack gap={4}>
                    <Group gap="sm">
                      <Text fw={600} size="lg">
                        {user.githubLogin}
                      </Text>
                      <Badge
                        variant="light"
                        color={user.isAdmin ? 'blue' : 'gray'}
                        radius="sm"
                        size="sm"
                      >
                        {user.isAdmin ? t('home.roleAdmin') : t('home.roleUser')}
                      </Badge>
                    </Group>
                    <Text c="dimmed" size="sm">
                      {t('home.welcomeBack')}
                    </Text>
                  </Stack>
                </Group>

                <Group gap="sm">
                  <Button
                    component="a"
                    href="/dashboard"
                    leftSection={<IconSettings size={18} />}
                    variant="filled"
                    radius="md"
                    styles={{
                      root: {
                        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                        border: 'none',
                        boxShadow: '0 2px 12px rgba(37,99,235,0.3)',
                        fontWeight: 500,
                      },
                    }}
                  >
                    {t('home.dashboard')}
                  </Button>
                  <Button
                    onClick={handleLogout}
                    leftSection={<IconLogout size={18} />}
                    variant="light"
                    color="red"
                    radius="md"
                  >
                    {t('home.logout')}
                  </Button>
                </Group>
              </Group>
            </Card>
          </Container>
        </Box>
      )}

      {/* Footer */}
      <Box
        style={{
          background: '#0f172a',
          padding: '40px 0',
        }}
      >
        <Container size="lg">
          <Divider mb="md" style={{ borderColor: 'rgba(148,163,184,0.15)' }} />
          <Group justify="space-between" wrap="wrap" gap="md">
            <Text size="sm" style={{ color: '#64748b' }}>
              {t('app.title')}
            </Text>
            <Text size="sm" style={{ color: '#64748b' }}>
              {t('app.description')}
            </Text>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  FeatureCard — self-contained card component for the features grid  */
/* ------------------------------------------------------------------ */

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'violet' | 'teal';
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  return (
    <Paper
      radius="lg"
      p="xl"
      withBorder
      style={{
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        cursor: 'default',
        background: '#ffffff',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <Stack gap="md">
        <ThemeIcon size={56} radius="lg" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Title order={4} fw={600} style={{ color: '#0f172a' }}>
          {title}
        </Title>
        <Text size="sm" c="dimmed" style={{ lineHeight: 1.7 }}>
          {description}
        </Text>
      </Stack>
    </Paper>
  );
}
