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

interface EnvStatus {
  isConfigured: boolean;
  missing: string[];
  present: string[];
  message: string;
}

export default function EnvErrorPage() {
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
      console.error('检查环境变量失败:', err);
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
            ⚠️ 环境变量配置缺失
          </Title>

          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            应用无法正常运行，因为缺少必要的环境变量配置。
          </Alert>

          {envStatus && (
            <>
              <Text>{envStatus.message}</Text>

              {envStatus.missing.length > 0 && (
                <div>
                  <Text fw={500} mb="xs">
                    缺失的环境变量：
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
                    已配置的环境变量：
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
                  解决方法：
                </Text>
                <Text size="sm">
                  1. 在项目根目录创建 <Code>.env.local</Code> 文件
                </Text>
                <Text size="sm">2. 添加缺失的环境变量配置</Text>
                <Text size="sm">3. 重启应用</Text>
                <Text size="sm" mt="xs" c="dimmed">
                  参考 <Code>.env.example</Code> 文件了解完整的环境变量配置
                </Text>
              </Paper>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
