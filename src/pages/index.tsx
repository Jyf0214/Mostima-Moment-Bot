import { Container, Paper, Stack, Text, Title } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import type { NextPage } from 'next';
import { useTranslation } from 'react-i18next';

const Home: NextPage = () => {
  const { t } = useTranslation();

  return (
    <Container size="md" py="xl">
      <Paper shadow="md" p="xl" radius="md">
        <Stack align="center" gap="md">
          <IconClock size={48} color="var(--mantine-color-blue-6)" />
          <Title order={1}>{t('app.title')}</Title>
          <Text c="dimmed" size="lg" ta="center">
            {t('home.subtitle')}
          </Text>
        </Stack>
      </Paper>
    </Container>
  );
};

export default Home;
