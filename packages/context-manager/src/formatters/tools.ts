/**
 * 工具层格式化器
 */

export function formatTools(tools: string[]): string {
  const toolList = tools
    .filter(tool => tool.trim().length > 0)
    .map(tool => tool.trim())
    .join('\n');

  return `<tools>\n${toolList}\n</tools>`;
}