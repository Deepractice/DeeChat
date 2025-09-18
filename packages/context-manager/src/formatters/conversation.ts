/**
 * 对话层格式化器
 */

export function formatConversation(conversation: string | string[]): string {
  let content: string;

  if (typeof conversation === 'string') {
    content = conversation.trim();
  } else {
    content = conversation
      .filter(msg => msg.trim().length > 0)
      .map(msg => msg.trim())
      .join('\n');
  }

  return `<conversation>\n${content}\n</conversation>`;
}