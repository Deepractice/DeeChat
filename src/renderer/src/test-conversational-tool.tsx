import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ConversationalToolCall from './components/ConversationalToolCall'
import { ToolExecution } from '../../shared/types'

// 测试数据
const mockToolExecutions: ToolExecution[] = [
  {
    id: '1',
    toolName: 'context7_resolve-library-id',
    params: { libraryName: 'react' },
    result: {
      libraries: [
        {
          name: 'React',
          title: 'React',
          description: 'A JavaScript library for building user interfaces',
          trustScore: 10,
          codeSnippets: 2512
        },
        {
          name: 'React Hooks',
          title: 'React Hooks',
          description: 'React Hooks documentation and examples',
          trustScore: 9.4,
          codeSnippets: 301
        }
      ]
    },
    success: true,
    duration: 1250,
    timestamp: Date.now(),
    serverName: 'Context7'
  },
  {
    id: '2',
    toolName: 'promptx_welcome',
    params: {},
    result: {
      roles: [
        {
          name: 'deechat-architect',
          description: 'DeeChat架构专家，精通Electron+React+TypeScript技术栈',
          source: 'system'
        },
        {
          name: 'frontend-developer',
          description: '前端开发专家，专注现代Web技术',
          source: 'project'
        }
      ]
    },
    success: true,
    duration: 800,
    timestamp: Date.now(),
    serverName: 'PromptX'
  }
]

const TestApp: React.FC = () => {
  return (
    <ConfigProvider>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>ConversationalToolCall 组件测试</h1>
        
        <h2>正常执行结果</h2>
        <ConversationalToolCall 
          toolExecutions={mockToolExecutions}
          isExecuting={false}
        />
        
        <h2>执行中状态</h2>
        <ConversationalToolCall 
          toolExecutions={[mockToolExecutions[0]]}
          isExecuting={true}
        />
        
        <h2>错误状态</h2>
        <ConversationalToolCall 
          toolExecutions={[{
            ...mockToolExecutions[0],
            error: '连接超时，请稍后重试',
            success: false
          }]}
          isExecuting={false}
        />
      </div>
    </ConfigProvider>
  )
}

// 如果在浏览器环境中，挂载测试组件
if (typeof window !== 'undefined') {
  const container = document.getElementById('root')
  if (container) {
    const root = createRoot(container)
    root.render(<TestApp />)
  }
}

export default TestApp