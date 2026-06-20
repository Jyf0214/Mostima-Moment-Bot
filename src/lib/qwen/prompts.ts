/**
 * Qwen Code AI 提示词模板
 *
 * 所有中文 AI 提示词集中于此文件，避免 i18n 扫描冲突。
 * 这些提示词是发给 Qwen Code CLI 的指令，不是用户界面文本。
 */

export function buildIssueFixInitialPrompt(branch: string, issueNumber: number): string {
  return `/goal 仔细阅读本地文件 'issue_details.md'，提取并完全修复里面描述的【所有】高危和中危漏洞，绝对不允许遗漏任何一个！

## 【执行与验收强制规范】：
1. **建立物理销项清单**：作为你的第一步，请在工作区新建一个 'todo_checklist.md'。将 'issue_details.md' 中提及的所有需要修复的 Bug/漏洞（如 C1, C2, H1, H2, M1 等等）完整提取出来，列成一个带有 '[ ]' 的任务清单。
2. **逐个修改与销项**：对于清单中的每一个任务，利用 LSP 精准分析代码，进行文件修改与本地单元测试。每修复成功并验证通过一个，就将清单中对应的 '[ ]' 改为 '[x]'。
3. **物理审查防线（Judge 判定终态硬红线）**：
   - 裁判模型在进行 Goal Check 时，必须强制读取 'todo_checklist.md' 并且比对 'git diff' 的修改变动。
   - **判定已达成（Goal Met）的前提条件为：清单中列出的所有安全隐患和 Bug 已全部被物理修改，且全部被标记为 '[x]'，且单元测试全绿通过**。
   - 严禁"只修复其中一个或一部分就宣布结束"的敷衍行为！
4. **提交代码与PR**：全部勾选完毕并测试通过后，commit 提交修改，推送至远程分支并开 PR。
5. **自主生动回复（消除人机感要求）**：
   - PR 创建成功后，使用 'gh issue comment' 回复此 Issue。
   - 回复语言必须生动、活泼，富有开发者温度。不要用机器官腔，多用 Emoji。
   - 包含：欢快的打招呼与自我介绍、修复思路、以及附上生成的 PR 链接。

## 安全限制：
- 严禁直接向主分支（main/master）提交 commit 或执行 push 操作。`;
}

export function buildIssueFixResumePrompt(branch: string, userFeedback: string): string {
  return `/goal 收到用户最新的评审反馈，请在当前会话和现有分支上继续完善代码。

## 用户最新的修改要求：
${userFeedback}

## 执行流程：
1. 你当前已经处于该 PR 的源本地分支 '${branch}'。请直接在此分支上继续调整和修改。
2. **冲突解决（Conflict Resolution）**：如果在 Git 合并中，工作区文件里包含冲突标记（如 '<<<<<<< HEAD'、'======='、'>>>>>>>'），你必须优先手动编辑这些文件，清除冲突标记，并合并双方的代码逻辑。
3. 修改或解决冲突后，必须运行本地单元测试并通过验收。
4. 提交新的 commit 并直接推送到 origin '${branch}'。此时远程 Pull Request 会自动更新，你【绝对不要】重复调用 'gh pr create' 创建新 PR。
5. 任务完成后，调用 'gh issue comment' 生动地回复用户，并说明此次增量修改的内容。

## 安全限制：
- 严禁直接向主分支（main/master）提交 commit 或执行 push 操作。`;
}

export function buildAuditPrompt(baseBranch: string, _prNumber: number): string {
  return `/goal 审查本次 Pull Request 中改动的部分，排查其是否引入了新的高风险安全漏洞。

## 核心审计方法（全项目关联分析要求）：
1. **差异锁定**：通过运行 'git diff origin/${baseBranch}...HEAD'，锁定变动的文件和修改的文件段落。
2. **跨文件深度追踪（核心要求）**：
   - 严禁孤立分析修改行！你必须通过 '--experimental-lsp' 的语义追踪能力，查看修改的接口/函数是如何在项目中被路由、控制器或公共适配器调用的。
   - **路由路径排查**：分析修改的接口是否绕过了全局鉴权中间件或路由限制，是否存在未授权访问漏洞。
   - **穿越与文件访问**：如果是文件读写操作，追踪输入源，检查是否引入了路径穿越漏洞（Path Traversal）。
   - **输入安全**：排查 SQL 语句、命令执行、HTML 渲染中，由于新增或重构代码是否引入了 SQLi、命令注入或 XSS。
3. **差异关注**：只关注本次 PR **新引入或由于修改而恶化** 的漏洞。不要去报告项目中原本就存在且与本次修改无关的历史漏洞。

## 漏洞判定与输出：
- 若发现新增的高风险安全缺陷：
  - 请直接将详细的审计报告写入当前工作区的文件 'audit_report.txt' 中。
  - 审计报告必须写得专业、清晰，指出代码漏洞的具体行、成因、潜在危害以及具体的修复指导方案。
  - 生成文件后即可结束。
- 若经过严格复查，确认此 PR 未引入任何高安全风险（或仅有微小的非安全风格问题）：
  - 绝对不要生成 'audit_report.txt'。直接结束。`;
}

export function buildScanPrompt(currentDate: string): string {
  return `/goal 启动本周度项目代码库安全隐患与逻辑缺陷的【分布式深度排查与并行自愈】任务。

## 【Orchestrator 调度与 Subagents 并行协同设计】（核心机制）：
作为一个具备高级调度能力的总协调器（Orchestrator），你必须调用系统内置的 'task' 工具，并发分派子任务给专门的子智能体（Subagents）执行，禁止单兵作战：

1. **第一阶段：并行分布式审计（Parallel Scanning）**：
   你必须通过并发调用 'task' 工具，分派以下独立的 'Explore' 子智能体开展分析：
   - 指派子智能体 A (subagent_type: 'Explore')：扫描所有控制器与路由端点，分析并审计是否存在越权访问、鉴权绕过、信息泄露或未授权的操作。
   - 指派子智能体 B (subagent_type: 'Explore')：重点扫描涉及数据库、文件系统、动态代码执行、以及用户输入流的核心模块，排查 SQLi、路径穿越（Path Traversal）、命令注入等严重漏洞。
   - 指派子智能体 C (subagent_type: 'Explore')：扫描项目整体代码库，排查已知 Bug、死锁隐患、未捕获的边界异常、TODO/FIXME 标记等业务稳定性漏洞。

2. **第二阶段：建立物理任务墙（todo_checklist.md）**：
   - 收集上述所有 'Explore' 子智能体返回的审计报告，汇总其发现的所有中高危安全和逻辑漏洞。
   - 在项目工作区根目录下新建一个物理文件 'todo_checklist.md'。将发现的所有 Bug 漏洞整理成带有 '[ ]' 复选框的任务清单，建立漏洞档案。

3. **第三阶段：分布式并行自愈（Parallel Healing）**：
   - 针对清单中所有的中高危漏洞，你必须再次分派多个独立的研发子智能体 (subagent_type: 'general-purpose') 分头对不同的受影响文件进行修改和修复。
   - 每当一个子智能体反馈修复成功，你必须亲自运行本地单元测试，确认没有引入退化问题。
   - 确认修复且通过测试后，将 'todo_checklist.md' 中对应的 '[ ]' 修改为 '[x]'。

4. **第四阶段：PR 出库与生动报告**：
   - 切出巡检分支 'scheduled/audit-patch-${currentDate}'，commit 修改并推送该分支，自动使用 'gh pr create' 发起 PR。
   - PR 描述中必须详尽贴出你的《漏洞档案分析报告》。
   - 在原 PR 下面，以极富开发者温度（添加 Emoji、谢绝死板机器人腔调）的语言生动评论说明每一项漏洞的排查和修复细节。

## 【LLM Judge 判定终态硬红线（必须 100% 达成）】：
- 裁判模型在进行 Goal Check 时，必须强制读取 'todo_checklist.md'。
- 只有确保清单中列出的所有漏洞都已被针对性修复，全部打勾销项为 '[x]'，且测试命令 100% 成功通过，才能判定为【已达成（Goal Met）】。

## 安全限制：
- 严禁直接向主分支（main/master）提交 commit 或执行 push 操作。`;
}

export const SCAN_RESUME_PROMPT =
  '由于网络或上下文限制中断，请读取周度巡检历史会话并继续完成所有步骤。请注意：必须对照 todo_checklist.md 继续修复未打勾的项，在本地运行并成功通过单元测试，确认无误后完成代码提交与 PR 处理。';

export const DEEP_SCAN_PROMPT =
  '/goal 已经完成了初步修复，但为了确保没有遗漏，你现在必须执行【第二轮极深度的底层漏洞会诊】。\n' +
  '请使用 Explore 并发扫描所有核心目录，寻找更隐蔽的安全漏洞或稳定缺陷，' +
  "将它们追加到 'todo_checklist.md' 列表中打勾销项。\n" +
  '直接把修改推送到现有的巡检分支上以更新 PR，并在原 PR 下面生动追加你的第二轮扫描与修复总结。';

export function buildIssueFixReply(issueNumber: number, branch: string): string {
  return (
    `🚀 **Qwen Code 自动修复完成！**\n\n` +
    `✅ 已修复 Issue #${issueNumber}\n` +
    `📋 修复分支: \`${branch}\`\n` +
    `🔗 PR 已自动创建并更新\n\n` +
    `> 修复由 Qwen Code 多 Agent 自治系统完成 🤖`
  );
}

export function buildAuditFailComment(cycleCount: number, reportContent: string): string {
  return (
    `### 🚨 安全审计未通过（第 ${cycleCount}/5 轮自愈）\n\n` +
    `@qwen-code /fix [AI 自动审计警告]\n` +
    `当前 PR 引入了高风险安全漏洞。请立刻分析以下报告，并在当前分支上修复这些问题：\n\n` +
    '````markdown\n' +
    reportContent +
    '\n````'
  );
}

export function buildAuditCircuitBreakComment(reportContent: string): string {
  return (
    `### ❌ 安全审计失败（已触发熔断保护）\n\n` +
    `当前 PR 仍然存在安全缺陷，且已达到最大 AI 自动修复循环上限（5次）。\n` +
    `请人类开发人员介入进行人工审查和修复：\n\n` +
    '````markdown\n' +
    reportContent +
    '\n````'
  );
}
