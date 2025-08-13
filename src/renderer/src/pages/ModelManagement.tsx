import React, { useState, useEffect } from 'react';
import {
  Layout,
  List,
  Card,
  Button,
  Form,
  Input,
  Select,
  Switch,
  message,
  Modal,
  Space,
  Tag,
  Tooltip,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  RobotOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';

// 导入ProjectS的服务和类型
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import { ProviderConfigEntity } from '../../../shared/entities/ProviderConfigEntity'
import ModelListModal from '../components/ModelListModal';
import { LLMRequest } from '../../../shared/interfaces/IModelProvider';

const { Sider, Content } = Layout;
const { Option, OptGroup } = Select;

// 组件Props接口
interface ModelManagementProps {
  visible?: boolean;
  onClose?: () => void;
}

// 提供商配置（不再是具体模型配置）
interface ProviderConfigWithStatus {
  id: string;
  name: string;           // 用户自定义名称，如"我的OpenAI账户"
  provider: string;       // 提供商类型：openai/claude/gemini
  apiKey: string;         // API密钥
  baseURL: string;        // API地址
  isEnabled: boolean;     // 是否启用
  priority: number;       // 优先级
  status?: 'testing' | 'success' | 'error';
  responseTime?: number;
  error?: string;
  availableModels?: string[]; // 该提供商下的可用模型列表
  enabledModels?: string[];   // 启用的模型列表
}

// IPC通信接口已在 global.d.ts 中定义，无需重复声明

// 提供商配置模板
const PROVIDERS = [
  // 主流提供商
  {
    value: 'openai',
    label: 'OpenAI',
    defaultURL: 'https://api.openai.com/v1',
    description: 'GPT-4, GPT-3.5等模型',
    icon: '🤖',
    category: '主流'
  },
  {
    value: 'claude',
    label: 'Anthropic Claude',
    defaultURL: 'https://api.anthropic.com',
    description: 'Claude-3.5等模型',
    icon: '🧠',
    category: '主流'
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    defaultURL: 'https://generativelanguage.googleapis.com',
    description: 'Gemini Pro等模型',
    icon: '💎',
    category: '主流'
  },

  // 国内热门提供商
  {
    value: 'moonshot',
    label: 'Moonshot AI (Kimi)',
    defaultURL: 'https://api.moonshot.cn/v1',
    description: 'Kimi系列模型，支持长文本',
    icon: '🌙',
    category: '国内热门'
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    defaultURL: 'https://api.deepseek.com/v1',
    description: 'DeepSeek Chat/Coder模型',
    icon: '🔍',
    category: '国内热门'
  },
  {
    value: 'qwen',
    label: '通义千问',
    defaultURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: 'Qwen系列模型',
    icon: '🔥',
    category: '国内热门'
  },
  {
    value: 'zhipu',
    label: '智谱AI (ChatGLM)',
    defaultURL: 'https://open.bigmodel.cn/api/paas/v4',
    description: 'ChatGLM系列模型',
    icon: '⚡',
    category: '国内热门'
  },
  {
    value: 'baichuan',
    label: '百川智能',
    defaultURL: 'https://api.baichuan-ai.com/v1',
    description: 'Baichuan系列模型',
    icon: '🏔️',
    category: '国内热门'
  },

  // 开源/自部署
  {
    value: 'ollama',
    label: 'Ollama (本地)',
    defaultURL: 'http://localhost:11434/v1',
    description: '本地部署的开源模型',
    icon: '🏠',
    category: '开源/自部署'
  },
  {
    value: 'vllm',
    label: 'vLLM',
    defaultURL: 'http://localhost:8000/v1',
    description: 'vLLM推理服务器',
    icon: '⚡',
    category: '开源/自部署'
  },
  {
    value: 'text-generation-webui',
    label: 'Text Generation WebUI',
    defaultURL: 'http://localhost:5000/v1',
    description: 'oobabooga WebUI API',
    icon: '🌐',
    category: '开源/自部署'
  },

  // 自定义
  {
    value: 'custom',
    label: '自定义提供商',
    defaultURL: '',
    description: '配置任何OpenAI兼容的API',
    icon: '⚙️',
    category: '自定义'
  }
];

const ModelManagement: React.FC<ModelManagementProps> = ({ visible, onClose }) => {
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigWithStatus[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ProviderConfigWithStatus | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelListModalVisible, setModelListModalVisible] = useState(false);
  const [currentProviderForModels, setCurrentProviderForModels] = useState<ProviderConfigWithStatus | null>(null);

  // 加载配置数据
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      // 调用主进程的LangChain集成服务
      const configEntities = await window.electronAPI.langchain.getAllConfigs();

      // 转换为UI状态格式
      const configsWithStatus: ProviderConfigWithStatus[] = configEntities.map(entity => ({
        ...entity,
        status: undefined,
        responseTime: undefined,
        error: undefined
      }));

      setProviderConfigs(configsWithStatus);
      if (configsWithStatus.length > 0) {
        setSelectedConfig(configsWithStatus[0]);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      message.error('加载配置失败');

      // 不再自动初始化默认配置，保持空白状态
      setProviderConfigs([]);
      setSelectedConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultConfigs = async () => {
    try {
      // 创建默认配置
      const defaultConfigs = [
        {
          name: 'OpenAI账户',
          provider: 'openai',
          apiKey: '',
          baseURL: 'https://api.openai.com/v1',
          isEnabled: false,
          priority: 8
        },
        {
          name: 'Gemini账户',
          provider: 'gemini',
          apiKey: '',
          baseURL: 'https://generativelanguage.googleapis.com',
          isEnabled: false,
          priority: 10
        },
        {
          name: 'Claude账户',
          provider: 'claude',
          apiKey: '',
          baseURL: 'https://api.anthropic.com',
          isEnabled: false,
          priority: 7
        }
      ];

      const createdConfigs: ProviderConfigWithStatus[] = [];
      for (const configData of defaultConfigs) {
        try {
          const entity = ProviderConfigEntity.create(configData);
          await window.electronAPI.langchain.saveConfig(entity);
          createdConfigs.push({ ...entity, status: undefined });
        } catch (error) {
          console.warn('创建默认配置失败:', configData.name, error);
        }
      }

      setProviderConfigs(createdConfigs);
      if (createdConfigs.length > 0) {
        setSelectedConfig(createdConfigs[0]);
      }

      message.success('已初始化默认配置');
    } catch (error) {
      console.error('初始化默认配置失败:', error);
      message.error('初始化默认配置失败');
    }
  };

  // 获取模型列表并打开管理模态框
  const handleGetModels = async (config: ProviderConfigWithStatus) => {
    // 立即打开对话框并设置当前配置
    setCurrentProviderForModels(config);
    setModelListModalVisible(true);
    await refreshModels(config);
  };

  // 刷新模型列表
  const refreshModels = async (config?: ProviderConfigWithStatus) => {
    const targetConfig = config || currentProviderForModels;
    if (!targetConfig) return;

    setLoadingModels(true);
    try {
      console.log(`🔄 刷新 ${targetConfig.name} 的模型列表...`);
      const models = await window.electronAPI.langchain.getAvailableModels(targetConfig);
      setAvailableModels(models);
      message.success(`✅ 获取到 ${models.length} 个可用模型`);

      // 显示一些重要的新模型
      const newModels = models.filter(m => m.includes('2.5') || m.includes('2.0'));
      if (newModels.length > 0) {
        console.log('🆕 发现新版本模型:', newModels.slice(0, 3));
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`获取模型列表失败: ${errorMessage}`);

      // 显示错误详情，不自动降级
      console.error('详细错误信息:', error);
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  // 发送测试消息
  const handleSendTestMessage = async (config: ProviderConfigWithStatus) => {
    try {
      const testRequest = {
        message: '你好！请回复"测试成功"来确认连接正常。',
        maxTokens: 50
      };

      const response = await window.electronAPI.langchain.sendMessageWithConfig(testRequest, config);
      message.success(`测试消息发送成功！AI回复: ${response.content}`);
    } catch (error) {
      console.error('发送测试消息失败:', error);
      message.error('发送测试消息失败，请检查配置');
    }
  };

  // 批量测试所有配置
  const handleTestAllConfigs = async () => {
    try {
      setLoading(true);
      message.info('开始批量测试所有配置...');

      // 将所有配置状态设为测试中
      setProviderConfigs(configs => configs.map(c => ({ ...c, status: 'testing' })));

      // 逐个测试配置
      for (const config of providerConfigs) {
        try {
          console.log(`🔄 测试配置: ${config.name}`);
          const testResult = await window.electronAPI.langchain.testConfig(config);

          // 更新单个配置的测试结果
          setProviderConfigs(configs => configs.map(c =>
            c.id === config.id ? {
              ...c,
              status: testResult.success ? 'success' as const : 'error' as const,
              responseTime: testResult.responseTime,
              error: testResult.error
            } : c
          ));

          console.log(`${testResult.success ? '✅' : '❌'} ${config.name}: ${testResult.success ? `${testResult.responseTime}ms` : testResult.error}`);
        } catch (error) {
          console.error(`❌ 测试 ${config.name} 失败:`, error);
          setProviderConfigs(configs => configs.map(c =>
            c.id === config.id ? {
              ...c,
              status: 'error' as const,
              error: '测试异常'
            } : c
          ));
        }
      }

      message.success('批量测试完成！');
    } catch (error) {
      console.error('批量测试失败:', error);
      message.error('批量测试失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存模型配置
  const handleSaveModels = async (models: any[]) => {
    if (!currentProviderForModels) return;

    try {
      const enabledModels = models.filter(m => m.enabled);

      // 直接更新现有配置的模型字段
      const updatedConfig = {
        ...currentProviderForModels,
        availableModels: models.map(m => m.name),
        enabledModels: enabledModels.map(m => m.name),
        updatedAt: new Date()
      };

      // 保存到后端
      await window.electronAPI.langchain.saveConfig(updatedConfig);

      // 更新本地状态
      setProviderConfigs(prev => prev.map(config =>
        config.id === currentProviderForModels.id
          ? updatedConfig
          : config
      ));

      // 更新当前选中的配置
      if (selectedConfig?.id === currentProviderForModels.id) {
        setSelectedConfig(updatedConfig);
      }

      // 更新当前模型管理的配置
      setCurrentProviderForModels(updatedConfig);

      message.success(`已为 ${currentProviderForModels.name} 配置 ${enabledModels.length} 个启用模型`);
    } catch (error) {
      console.error('保存模型配置失败:', error);
      message.error('保存模型配置失败');
    }
  };

  const handleAddConfig = () => {
    form.resetFields();
    setSelectedConfig(null);
    setAvailableModels([]);
    setIsModalVisible(true);
  };

  // 获取指定提供商的可用模型
  const fetchAvailableModels = async (provider: string, apiKey: string, baseURL: string) => {
    if (!provider || !apiKey || !baseURL) {
      setAvailableModels([]);
      return;
    }

    setLoadingModels(true);
    try {
      // 创建临时配置用于获取模型列表
      const tempConfig = {
        name: 'temp-for-models',
        provider,
        model: 'temp',
        apiKey,
        baseURL,
        isEnabled: true,
        priority: 1
      };

      const models = await window.electronAPI.langchain.getAvailableModels(tempConfig);
      setAvailableModels(models);
      message.success(`获取到 ${models.length} 个可用模型`);
    } catch (error) {
      console.error('获取模型列表失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      message.error(`获取模型列表失败: ${errorMessage}`);

      // 显示错误详情，不自动降级
      console.error('详细错误信息:', error);
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  // 获取提供商的API密钥获取链接
  const getProviderApiKeyLink = (provider: string): { url: string; text: string } | null => {
    const links = {
      'openai': { url: 'https://platform.openai.com/api-keys', text: '获取OpenAI API Key' },
      'claude': { url: 'https://console.anthropic.com/', text: '获取Claude API Key' },
      'gemini': { url: 'https://makersuite.google.com/app/apikey', text: '获取Gemini API Key' },
      'moonshot': { url: 'https://platform.moonshot.cn/console/api-keys', text: '获取Moonshot API Key' },
      'deepseek': { url: 'https://platform.deepseek.com/api_keys', text: '获取DeepSeek API Key' },
      'qwen': { url: 'https://dashscope.console.aliyun.com/apiKey', text: '获取通义千问API Key' },
      'zhipu': { url: 'https://open.bigmodel.cn/usercenter/apikeys', text: '获取智谱AI API Key' },
      'baichuan': { url: 'https://platform.baichuan-ai.com/console/apikey', text: '获取百川智能API Key' }
    };
    return links[provider] || null;
  };

  // 获取提供商的默认模型列表
  const getDefaultModelsForProvider = (provider: string): string[] => {
    switch (provider) {
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      case 'claude':
        return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-sonnet-20240229'];
      case 'gemini':
        return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
      case 'moonshot':
        return ['kimi-k2-0711-preview', 'kimi-latest', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'];
      case 'deepseek':
        return ['deepseek-chat', 'deepseek-coder'];
      case 'qwen':
        return ['qwen-turbo', 'qwen-plus', 'qwen-max'];
      case 'zhipu':
        return ['chatglm-6b', 'chatglm2-6b', 'chatglm3-6b'];
      case 'baichuan':
        return ['baichuan2-7b-chat', 'baichuan2-13b-chat'];
      case 'ollama':
        return ['llama2', 'llama2:13b', 'codellama', 'mistral', 'neural-chat'];
      case 'vllm':
      case 'text-generation-webui':
        return ['自动检测'];
      default:
        return [];
    }
  };

  const handleEditConfig = (config: ModelConfig) => {
    setSelectedConfig(config);
    form.setFieldsValue(config);
    setIsModalVisible(true);
  };

  const handleDeleteConfig = (config: ProviderConfigWithStatus) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模型配置 "${config.name}" 吗？`,
      onOk: async () => {
        try {
          // 调用主进程删除配置
          await window.electronAPI.langchain.deleteConfig(config.id);

          // 更新UI状态
          const newConfigs = providerConfigs.filter(c => c.id !== config.id);
          setProviderConfigs(newConfigs);

          if (selectedConfig?.id === config.id) {
            setSelectedConfig(newConfigs[0] || null);
          }

          message.success('删除成功');
        } catch (error) {
          console.error('删除配置失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const handleTestConfig = async (config: ProviderConfigWithStatus) => {
    try {
      // 更新状态为测试中
      setProviderConfigs(providerConfigs.map(c =>
        c.id === config.id ? { ...c, status: 'testing' } : c
      ));

      // 调用主进程测试配置
      const testResult = await window.electronAPI.langchain.testConfig(config);

      // 更新测试结果
      const updatedConfig = {
        ...config,
        status: testResult.success ? 'success' as const : 'error' as const,
        responseTime: testResult.responseTime,
        error: testResult.error
      };

      setProviderConfigs(providerConfigs.map(c =>
        c.id === config.id ? updatedConfig : c
      ));

      // 如果当前选中的是测试的配置，也要更新
      if (selectedConfig?.id === config.id) {
        setSelectedConfig(updatedConfig);
      }

      message[testResult.success ? 'success' : 'error'](
        testResult.success
          ? `测试成功 (${testResult.responseTime}ms)`
          : `测试失败: ${testResult.error}`
      );
    } catch (error) {
      console.error('测试配置失败:', error);

      const errorConfig = {
        ...config,
        status: 'error' as const,
        error: '测试异常'
      };

      setProviderConfigs(providerConfigs.map(c =>
        c.id === config.id ? errorConfig : c
      ));

      if (selectedConfig?.id === config.id) {
        setSelectedConfig(errorConfig);
      }

      message.error('测试失败');
    }
  };

  const handleSaveConfig = async (values: any) => {
    try {
      let configEntity: ModelConfigEntity;

      if (selectedConfig) {
        // 更新现有配置
        configEntity = new ProviderConfigEntity({
          ...selectedConfig,
          ...values,
          updatedAt: new Date()
        });
      } else {
        // 创建新配置
        configEntity = ProviderConfigEntity.create(values);
      }

      // 调用主进程保存配置
      await window.electronAPI.langchain.saveConfig(configEntity);

      // 更新UI状态
      const configWithStatus: ProviderConfigWithStatus = {
        ...configEntity,
        status: undefined,
        responseTime: undefined,
        error: undefined
      };

      if (selectedConfig) {
        // 更新现有配置
        setProviderConfigs(providerConfigs.map(c =>
          c.id === selectedConfig.id ? configWithStatus : c
        ));
        message.success('配置更新成功');
      } else {
        // 添加新配置
        setProviderConfigs([...providerConfigs, configWithStatus]);
        message.success('配置创建成功');
      }

      setIsModalVisible(false);
      setSelectedConfig(configWithStatus);
    } catch (error) {
      console.error('保存配置失败:', error);
      message.error('保存失败');
    }
  };

  const getStatusIcon = (config: ModelConfig) => {
    switch (config.status) {
      case 'testing':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'success':
        return (
          <Tooltip title={config.responseTime ? `响应时间: ${config.responseTime}ms` : '连接成功'}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          </Tooltip>
        );
      case 'error':
        return (
          <Tooltip title={config.error || '连接失败'}>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          </Tooltip>
        );
      default:
        return <QuestionCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const getStatusText = (config: ModelConfig) => {
    switch (config.status) {
      case 'testing':
        return '测试中...';
      case 'success':
        return `连接正常 (${config.responseTime}ms)`;
      case 'error':
        return `连接失败: ${config.error}`;
      default:
        return '未测试';
    }
  };

  const maskApiKey = (apiKey: string) => {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length);
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  };

  const layoutContent = (
    <Layout style={{ height: visible ? '80vh' : '100%', background: '#f5f5f5' }}>
      {/* 左侧提供商列表 */}
      <Sider width={300} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={handleAddConfig}
            >
              添加
            </Button>
          </div>
        </div>
        
        <List
          loading={loading}
          dataSource={providerConfigs}
          renderItem={(config) => (
            <List.Item
              key={config.id}
              style={{ 
                padding: '12px 16px',
                cursor: 'pointer',
                background: selectedConfig?.id === config.id ? '#e6f7ff' : 'transparent'
              }}
              onClick={() => setSelectedConfig(config)}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{config.name}</span>
                    <div>
                      {getStatusIcon(config)}
                      <Switch 
                        size="small" 
                        checked={config.isEnabled} 
                        style={{ marginLeft: 8 }}
                        onClick={async (checked, e) => {
                          e.stopPropagation();
                          try {
                            // 更新本地状态
                            setProviderConfigs(providerConfigs.map(c =>
                              c.id === config.id ? { ...c, isEnabled: checked } : c
                            ));

                            // 保存到数据库
                            const updatedConfig = { ...config, isEnabled: checked };
                            await window.electronAPI.langchain.saveConfig(updatedConfig);

                            message.success(checked ? '配置已启用' : '配置已禁用');
                          } catch (error) {
                            console.error('更新配置状态失败:', error);
                            message.error('更新配置状态失败');
                            // 回滚本地状态
                            setProviderConfigs(providerConfigs.map(c =>
                              c.id === config.id ? { ...c, isEnabled: !checked } : c
                            ));
                          }
                        }}
                      />
                    </div>
                  </div>
                }
                description={
                  <div>
                    <Tag style={{ fontSize: '12px' }}>{PROVIDERS.find(p => p.value === config.provider)?.label}</Tag>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                      {config.model}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Sider>

      {/* 右侧配置详情 */}
      <Content style={{ padding: '24px', background: '#fff', overflow: 'auto' }}>
        {selectedConfig ? (
          <div style={{ maxWidth: '100%', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, flex: 1, minWidth: 0 }}>{selectedConfig.name}</h2>
              <Space>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => handleEditConfig(selectedConfig)}
                >
                  编辑
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteConfig(selectedConfig)}
                >
                  删除
                </Button>
              </Space>
            </div>

            <Card title="基本信息" style={{ marginBottom: 16 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
                width: '100%'
              }}>
                <div style={{ minWidth: 0 }}>
                  <strong>提供商:</strong>
                  <div style={{ marginTop: 4, wordBreak: 'break-word' }}>
                    {PROVIDERS.find(p => p.value === selectedConfig.provider)?.label}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>API Key:</strong>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                    <span style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {showApiKey ? selectedConfig.apiKey : maskApiKey(selectedConfig.apiKey)}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      icon={showApiKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{ marginLeft: 8, flexShrink: 0 }}
                    />
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>Base URL:</strong>
                  <div style={{ marginTop: 4, wordBreak: 'break-all' }}>
                    {selectedConfig.baseURL}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>优先级:</strong>
                  <div style={{ marginTop: 4 }}>
                    {selectedConfig.priority}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>状态:</strong>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                    {getStatusIcon(selectedConfig)}
                    <span style={{ marginLeft: 4 }}>{getStatusText(selectedConfig)}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 已启用模型卡片 */}
            <Card
              title={
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  minWidth: 0
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>已启用模型</span>
                  <Space size="small" style={{ flexShrink: 0 }}>
                    <Button
                      size="small"
                      type="primary"
                      loading={selectedConfig.status === 'testing'}
                      onClick={() => handleTestConfig(selectedConfig)}
                    >
                      测试连接
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      onClick={() => handleGetModels(selectedConfig)}
                      loading={loadingModels}
                      disabled={!selectedConfig.isEnabled}
                    >
                      管理模型
                    </Button>
                  </Space>
                </div>
              }
              style={{ marginBottom: 16, width: '100%' }}
            >
              {!selectedConfig.isEnabled ? (
                // 配置已禁用状态
                <div style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: '#999',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 8,
                  border: '1px solid #d9d9d9',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <RobotOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
                  </div>
                  <div style={{ marginBottom: 8, fontSize: '14px', fontWeight: 500 }}>配置已关闭</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>请先启用配置以管理模型</div>
                </div>
              ) : selectedConfig.enabledModels && selectedConfig.enabledModels.length > 0 ? (
                // 有启用模型且配置已启用
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Tag color="blue" style={{ fontSize: '13px' }}>
                      共 {selectedConfig.enabledModels.length} 个启用模型
                    </Tag>
                  </div>
                  <div style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    backgroundColor: '#fafafa',
                    maxHeight: 200,
                    overflowY: 'auto',
                    width: '100%'
                  }}>
                    {selectedConfig.enabledModels.map((model: string, index: number) => (
                      <div key={`${selectedConfig.id}-${model}-${index}`} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: index < selectedConfig.enabledModels!.length - 1 ? '1px solid #f0f0f0' : 'none',
                        transition: 'background-color 0.2s',
                        cursor: 'default',
                        minWidth: 0,
                        width: '100%'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flex: 1,
                          minWidth: 0
                        }}>
                          <span style={{
                            fontSize: '12px',
                            color: '#999',
                            minWidth: '20px',
                            textAlign: 'center',
                            flexShrink: 0
                          }}>
                            {index + 1}
                          </span>
                          <span style={{
                            fontSize: '14px',
                            color: '#333',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0
                          }}>
                            {model}
                          </span>
                        </div>
                        <Tag color="green" style={{ flexShrink: 0, fontSize: '12px' }}>启用</Tag>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // 无启用模型但配置已启用
                <div style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: '#999',
                  backgroundColor: '#fafafa',
                  borderRadius: 8,
                  border: '1px dashed #d9d9d9',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <RobotOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
                  </div>
                  <div style={{ marginBottom: 12 }}>暂无启用的模型</div>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => handleGetModels(selectedConfig)}
                    loading={loadingModels}
                  >
                    配置模型
                  </Button>
                </div>
              )}
            </Card>


          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 100 }}>
            <h3>请选择一个模型配置</h3>
            <p>从左侧列表中选择要查看或编辑的模型配置</p>
          </div>
        )}
      </Content>

      {/* 配置编辑模态框 */}
      <Modal
        title={selectedConfig ? '编辑模型配置' : '添加模型配置'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
        style={{ top: 20 }}
        styles={{ 
          body: {
            maxHeight: '70vh', 
            overflowY: 'auto',
            padding: '16px 24px'
          }
        }}
      >
        <div style={{ marginBottom: '16px', width: '100%' }}>
          <Card 
            size="small" 
            style={{ 
              backgroundColor: '#f6ffed', 
              border: '1px solid #b7eb8f',
              width: '100%'
            }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
                💡 配置提示
              </div>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                • 选择提供商后会自动填入默认API地址<br/>
                • API Key通常从提供商官网的控制台获取<br/>
                • 配置完成后建议先测试连接再保存<br/>
                • 支持所有OpenAI兼容的API接口
              </div>
            </Space>
          </Card>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveConfig}
          key={selectedConfig?.id || 'new'}
          style={{ width: '100%' }}
          scrollToFirstError={true}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如: OpenAI GPT-4" />
          </Form.Item>

          <Form.Item
            name="provider"
            label="提供商"
            rules={[{ required: true, message: '请选择提供商' }]}
          >
            <Select
              placeholder={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#bfbfbf' }}>
                  <span>🔍</span>
                  <span>选择AI提供商</span>
                </div>
              }
              showSearch
              optionFilterProp="label"
              size="large"
              style={{ width: '100%' }}
              styles={{
                popup: {
                  root: {
                    maxHeight: 400, 
                    overflow: 'auto',
                    zIndex: 9999 
                  }
                }
              }}
              optionLabelProp="label"
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
              onChange={(value) => {
                const provider = PROVIDERS.find(p => p.value === value);
                if (provider?.defaultURL) {
                  form.setFieldsValue({ baseURL: provider.defaultURL });
                }
              }}
            >
              {/* 按分类分组显示 */}
              {['主流', '国内热门', '开源/自部署', '自定义'].map(category => (
                <OptGroup
                  key={category}
                  label={
                    <div style={{
                      padding: '4px 0',
                      fontWeight: 600,
                      color: '#1890ff',
                      borderBottom: '1px solid #f0f0f0',
                      marginBottom: '4px'
                    }}>
                      {category}
                    </div>
                  }
                >
                  {PROVIDERS
                    .filter(provider => provider.category === category)
                    .map(provider => (
                      <Option
                        key={provider.value}
                        value={provider.value}
                        label={provider.label}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '2px 0'
                        }}>
                          <span style={{
                            fontSize: '14px',
                            minWidth: '18px',
                            textAlign: 'center'
                          }}>
                            {provider.icon}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 500,
                              color: '#262626',
                              fontSize: '14px',
                              lineHeight: '1.4'
                            }}>
                              {provider.label}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#999',
                              lineHeight: '1.2',
                              marginTop: '1px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {provider.description}
                            </div>
                          </div>
                        </div>
                      </Option>
                    ))
                  }
                </OptGroup>
              ))}
            </Select>
          </Form.Item>



          <Form.Item
            name="apiKey"
            label={
              <Space>
                API Key
                <Tooltip title="从提供商官网获取的API密钥，用于身份验证">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请输入API Key' }]}
          >
            <Input.Password
              placeholder="输入API密钥，如：sk-xxx 或 Bearer xxx"
              style={{ fontFamily: 'monospace' }}
            />
            {(() => {
              const currentProvider = form.getFieldValue('provider');
              const apiKeyLink = getProviderApiKeyLink(currentProvider);
              return apiKeyLink ? (
                <div style={{ marginTop: '4px' }}>
                  <a
                    href={apiKeyLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#1890ff' }}
                  >
                    🔗 {apiKeyLink.text}
                  </a>
                </div>
              ) : null;
            })()}
          </Form.Item>

          <Form.Item
            name="baseURL"
            label={
              <Space>
                Base URL
                <Tooltip title="API服务器的基础地址，通常以/v1结尾">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请输入Base URL' }]}
          >
            <Input
              placeholder="API服务器地址，如：https://api.example.com/v1"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            initialValue={5}
          >
            <Select
              style={{ width: '100%' }}
              getPopupContainer={(triggerNode) => triggerNode.parentElement}
            >
              {[1,2,3,4,5,6,7,8,9,10].map(num => (
                <Option key={num} value={num}>{num}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="isEnabled"
            label="启用配置"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );

  return (
    <>
      {visible === true ? (
        <Modal
          title="模型管理"
          open={visible}
          onCancel={onClose}
          footer={null}
          width={1200}
          style={{ top: 20 }}
          destroyOnHidden
        >
          {layoutContent}
        </Modal>
      ) : visible === false ? (
        null
      ) : (
        layoutContent
      )}

    {/* 模型列表管理模态框 */}
    <ModelListModal
      visible={modelListModalVisible}
      onClose={() => {
        setModelListModalVisible(false);
        setCurrentProviderForModels(null);
        setAvailableModels([]); // 清空模型列表
      }}
      providerName={currentProviderForModels?.name || ''}
      providerType={currentProviderForModels?.provider || ''}
      availableModels={availableModels}
      enabledModels={currentProviderForModels?.enabledModels || []}
      loading={loadingModels}
      onSaveModels={handleSaveModels}
      onRefreshModels={() => refreshModels()}
    />
    </>
  );
};

export default ModelManagement;
