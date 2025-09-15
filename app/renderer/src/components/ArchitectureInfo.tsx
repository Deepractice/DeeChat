import React from 'react'
import { Button, Modal, Descriptions, Tag } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

const ArchitectureInfo: React.FC = () => {
  const [modalVisible, setModalVisible] = React.useState(false)

  return (
    <>
      <Button 
        type="text" 
        icon={<InfoCircleOutlined />}
        onClick={() => setModalVisible(true)}
      >
        架构信息
      </Button>

      <Modal
        title="🏗️ DeeChat 后端架构信息"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Descriptions column={1} bordered>
          <Descriptions.Item label="架构模式">
            <Tag color="blue">DDD 充血模型</Tag>
            <Tag color="green">依赖注入</Tag>
            <Tag color="purple">IPC 自动注册</Tag>
          </Descriptions.Item>
          
          <Descriptions.Item label="主进程架构">
            <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
              app/main/<br/>
              ├── index.ts (应用入口)<br/>
              ├── domains/ (充血业务模型)<br/>
              ├── infrastructure/ (基础设施)<br/>
              └── ipc/ (通信层)
            </div>
          </Descriptions.Item>

          <Descriptions.Item label="当前测试 Domain">
            <Tag color="orange">AIConfigurationDomain</Tag>
            <span style={{ marginLeft: 8, fontSize: '12px', color: '#666' }}>
              负责AI配置的业务逻辑
            </span>
          </Descriptions.Item>

          <Descriptions.Item label="IPC 接口">
            <div style={{ fontSize: '12px' }}>
              • ai-config:create - 创建配置<br/>
              • ai-config:getAll - 获取所有配置<br/>
              • ai-config:get - 获取单个配置<br/>
              • ai-config:delete - 删除配置<br/>
              • ai-config:getModels - 获取可用模型<br/>
              • ai-config:setModelPreference - 设置模型偏好
            </div>
          </Descriptions.Item>

          <Descriptions.Item label="核心特性">
            <Tag color="cyan">模块化</Tag>
            <Tag color="lime">自动注册</Tag>
            <Tag color="gold">类型安全</Tag>
            <Tag color="magenta">易扩展</Tag>
          </Descriptions.Item>

          <Descriptions.Item label="系统信息">
            平台: {window.electronAPI?.system?.platform || 'unknown'}<br/>
            Electron: {window.electronAPI?.system?.version || 'unknown'}
          </Descriptions.Item>
        </Descriptions>

        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: '#f6ffed', 
          border: '1px solid #b7eb8f',
          borderRadius: '6px' 
        }}>
          <div style={{ fontWeight: 600, color: '#389e0d' }}>✨ 架构优势</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            • 主进程永远不会变乱 - 模块化设计<br/>
            • IPC 自动注册 - Domain 暴露接口即可<br/>
            • 业务逻辑内聚 - 充血模型包含完整逻辑<br/>
            • 扩展性极强 - 新增功能只需新增 Domain
          </div>
        </div>
      </Modal>
    </>
  )
}

export default ArchitectureInfo