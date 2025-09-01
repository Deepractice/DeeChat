import React, { useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  message,
  Typography
} from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { updateLLMConfig, saveConfig } from '../store/slices/configSlice'
// import { getSupportedProviders, getProviderTemplate } from '../../../shared/constants/providerTemplates'

// 临时的提供商配置
const tempProviders = [
  { key: 'openai', name: 'OpenAI' },
  { key: 'claude', name: 'Claude' },
  { key: 'gemini', name: 'Gemini' }
];

const tempGetProviderTemplate = (provider: string) => ({
  supportedModels: provider === 'openai' ? ['gpt-4', 'gpt-3.5-turbo'] :
                   provider === 'claude' ? ['claude-3-sonnet', 'claude-3-haiku'] :
                   provider === 'gemini' ? ['gemini-2.0-flash', 'gemini-1.5-pro'] :
                   ['default-model']
});

const { Option } = Select
const { Text } = Typography

interface ConfigModalProps {
  visible: boolean
  onClose: () => void
}

const ConfigModal: React.FC<ConfigModalProps> = ({ visible, onClose }) => {
  const dispatch = useDispatch<AppDispatch>()
  const { config, isLoading } = useSelector((state: RootState) => state.config)
  const [form] = Form.useForm()

  useEffect(() => {
    if (visible) {
      form.setFieldsValue(config)
    }
  }, [visible, config, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      
      // 更新LLM配置
      dispatch(updateLLMConfig(values.llm))
      
      // 保存到本地
      await dispatch(saveConfig({
        llm: values.llm,
        ui: config.ui,
        chat: config.chat
      })).unwrap()
      
      message.success('配置保存成功')
      onClose()
    } catch (error) {
      console.error('保存配置失败:', error)
      message.error('保存配置失败')
    }
  }

  return (
    <Modal
      title="设置"
      open={visible}
      onCancel={onClose}
      width={500}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={isLoading} onClick={handleSave}>
          保存
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={config}
      >
        <Text strong>AI模型配置</Text>
        
        <Form.Item
          name={['llm', 'provider']}
          label="AI提供商"
          rules={[{ required: true, message: '请选择AI提供商' }]}
        >
          <Select placeholder="选择AI提供商">
            {tempProviders.map(provider => (
              <Option key={provider.key} value={provider.key}>
                {provider.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name={['llm', 'apiKey']}
          label="API密钥"
          rules={[{ required: true, message: '请输入API密钥' }]}
        >
          <Input.Password placeholder="输入API密钥" />
        </Form.Item>

        <Form.Item
          name={['llm', 'baseURL']}
          label="API地址"
          rules={[{ required: true, message: '请输入API地址' }]}
        >
          <Input placeholder="API基础地址" />
        </Form.Item>

        <Form.Item
          name={['llm', 'model']}
          label="模型"
          rules={[{ required: true, message: '请选择模型' }]}
        >
          <Select placeholder="选择模型">
            {(() => {
              const provider = form.getFieldValue(['llm', 'provider']) || 'openai'
              const template = tempGetProviderTemplate(provider)
              return template.supportedModels.map(model => (
                <Option key={model} value={model}>
                  {model}
                </Option>
              ))
            })()}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ConfigModal
