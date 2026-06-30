import { describe, it, expect } from 'vitest';
import { LogCollector } from '@/lib/ci/log-collector';

describe('LogCollector', () => {
  it('应该创建空日志', () => {
    const collector = new LogCollector();
    const json = JSON.parse(collector.toJSON());
    expect(json.version).toBe(1);
    expect(json.steps).toEqual([]);
  });

  it('应该记录单个步骤', () => {
    const collector = new LogCollector();
    collector.startStep('npm ci', 'npm ci');
    collector.finishStep('npm ci', { conclusion: 'success', output: 'added 1000 packages' });

    const json = JSON.parse(collector.toJSON());
    expect(json.steps).toHaveLength(1);
    expect(json.steps[0].name).toBe('npm ci');
    expect(json.steps[0].command).toBe('npm ci');
    expect(json.steps[0].status).toBe('completed');
    expect(json.steps[0].conclusion).toBe('success');
    expect(json.steps[0].output).toBe('added 1000 packages');
    expect(json.steps[0].startedAt).toBeDefined();
    expect(json.steps[0].completedAt).toBeDefined();
    expect(json.steps[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('应该记录失败步骤', () => {
    const collector = new LogCollector();
    collector.startStep('Lint', 'npm run lint');
    collector.finishStep('Lint', { conclusion: 'failure', output: 'error: unused variable' });

    const json = JSON.parse(collector.toJSON());
    expect(json.steps[0].conclusion).toBe('failure');
    expect(json.steps[0].output).toContain('unused variable');
  });

  it('应该记录多个步骤', () => {
    const collector = new LogCollector();
    collector.startStep('Step 1');
    collector.finishStep('Step 1', { conclusion: 'success' });
    collector.startStep('Step 2');
    collector.finishStep('Step 2', { conclusion: 'success' });
    collector.startStep('Step 3');
    collector.finishStep('Step 3', { conclusion: 'failure' });

    const json = JSON.parse(collector.toJSON());
    expect(json.steps).toHaveLength(3);
    expect(json.steps[2].conclusion).toBe('failure');
  });

  it('应该记录子步骤', () => {
    const collector = new LogCollector();
    collector.startStep('Parent');
    collector.startStep('Child 1');
    collector.finishStep('Child 1', { conclusion: 'success' });
    collector.startStep('Child 2');
    collector.finishStep('Child 2', { conclusion: 'failure' });
    collector.finishStep('Parent', { conclusion: 'failure' });

    const json = JSON.parse(collector.toJSON());
    expect(json.steps).toHaveLength(1);
    expect(json.steps[0].subSteps).toHaveLength(2);
    expect(json.steps[0].subSteps![0].name).toBe('Child 1');
    expect(json.steps[0].subSteps![1].name).toBe('Child 2');
  });

  it('应该追加输出', () => {
    const collector = new LogCollector();
    collector.startStep('Test');
    collector.appendOutput('line 1\n');
    collector.appendOutput('line 2\n');
    collector.finishStep('Test');

    const json = JSON.parse(collector.toJSON());
    expect(json.steps[0].output).toBe('line 1\nline 2\n');
  });

  it('应该截断过长输出', () => {
    const collector = new LogCollector();
    collector.startStep('Test');
    collector.appendOutput('x'.repeat(50000));
    collector.finishStep('Test');

    const json = JSON.parse(collector.toJSON());
    expect(json.steps[0].output!.length).toBeLessThanOrEqual(30000);
  });

  it('应该添加纯文本消息', () => {
    const collector = new LogCollector();
    collector.addMessage('Starting process...');
    collector.startStep('Step 1');
    collector.finishStep('Step 1');

    const json = JSON.parse(collector.toJSON());
    expect(json.steps).toHaveLength(2);
    expect(json.steps[0].name).toBe('Starting process...');
    expect(json.steps[0].status).toBe('completed');
  });

  it('runStep 应该捕获成功结果', () => {
    const collector = new LogCollector();
    const result = collector.runStep('Test', 'echo hello', () => ({
      stdout: 'hello',
      exitCode: 0,
    }));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');

    const json = JSON.parse(collector.toJSON());
    expect(json.steps[0].conclusion).toBe('success');
    expect(json.steps[0].output).toBe('hello');
  });

  it('runStep 应该捕获失败结果', () => {
    const collector = new LogCollector();
    const result = collector.runStep('Test', 'fail cmd', () => ({
      stderr: 'error occurred',
      exitCode: 1,
    }));

    expect(result.exitCode).toBe(1);

    const json = JSON.parse(collector.toJSON());
    expect(json.steps[0].conclusion).toBe('failure');
    expect(json.steps[0].output).toBe('error occurred');
  });

  it('runStep 应该捕获异常', () => {
    const collector = new LogCollector();
    const result = collector.runStep('Test', 'crash', () => {
      throw new Error('boom');
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('boom');

    const json = JSON.parse(collector.toJSON());
    expect(json.steps[0].conclusion).toBe('failure');
    expect(json.steps[0].output).toBe('boom');
  });

  it('应该截断总日志大小', () => {
    const collector = new LogCollector();
    for (let i = 0; i < 100; i++) {
      collector.startStep(`Step ${i}`);
      collector.appendOutput('x'.repeat(1000));
      collector.finishStep(`Step ${i}`);
    }

    const json = collector.toJSON();
    expect(json.length).toBeLessThanOrEqual(50000);
  });

  it('应该返回步骤列表', () => {
    const collector = new LogCollector();
    collector.startStep('A');
    collector.finishStep('A');
    collector.startStep('B');
    collector.finishStep('B');

    const steps = collector.getSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0].name).toBe('A');
    expect(steps[1].name).toBe('B');
  });
});
