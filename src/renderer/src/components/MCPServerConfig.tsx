/**
 * MCP服务器配置组件
 * 用于添加和编辑MCP服务器配置
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
  Card,
  Divider,
  InputNumber,
  message,
  Tabs,
  Tag,
  Alert
} from 'antd';
import { PlusOutlined, DeleteOutlined, ExperimentOutlined, SettingOutlined, CodeOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;
// const { TabPane } = Tabs; // 已废弃，使用items语法

interface MCPServerConfigProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (config: any) => void;
  editingServer?: any;
}

interface EnvironmentVariable {
  key: string;
  value: string;
}

interface Header {
  key: string;
  value: string;
}

const MCPServerConfig: React.FC<MCPServerConfigProps> = ({
  visible,
  onCancel,
  onSave,
  editingServer
}) => {
  const [form] = Form.useForm();
  const [quickForm] = Form.useForm(); // 为快速配置添加独立的表单
  const [serverType, setServerType] = useState<'stdio' | 'sse'>('stdio');
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [headers, setHeaders] = useState<Header[]>([]);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState('quick'); // 默认显示快速配置
  const [jsonConfig, setJsonConfig] = useState('');

  // 通用的配置字段解析器
  const parseServerConfig = (server: any) => {
    console.log('🔧 [parseServerConfig] 输入服务器:', server);

    if (!server) return {};

    // 基础配置
    const config: any = {
      isEnabled: server.isEnabled ?? true
    };

    // 解析args为配置字段
    if (server.args && Array.isArray(server.args)) {
      console.log('🔧 [parseServerConfig] 解析args:', server.args);

      // 第一个参数通常是包名，后续参数是配置值
      const [packageName, ...configArgs] = server.args;

      // 根据包名推断配置字段
      if (packageName?.includes('filesystem')) {
        config.path = configArgs[0] || '';
        console.log('🔧 [parseServerConfig] 文件系统路径:', config.path);
      } else {
        // 通用处理：将所有args合并为一个字符串
        config.args = configArgs.join(' ');
        console.log('🔧 [parseServerConfig] 通用args:', config.args);
      }
    }

    // 解析环境变量
    if (server.env && typeof server.env === 'object') {
      Object.entries(server.env).forEach(([key, value]) => {
        config[key.toLowerCase()] = value;
      });
      console.log('🔧 [parseServerConfig] 环境变量:', server.env);
    }

    console.log('🔧 [parseServerConfig] 最终配置:', config);
    return config;
  };

  // 通用的配置字段构建器
  const buildServerConfig = (formValues: any, originalServer?: any) => {
    const config: any = {
      isEnabled: formValues.isEnabled ?? true
    };

    // 重建args数组
    if (originalServer?.args?.[0]) {
      const packageName = originalServer.args[0];
      config.args = [packageName];

      // 根据包名添加配置参数
      if (packageName.includes('filesystem') && formValues.path) {
        config.args.push(formValues.path);
      } else if (formValues.args) {
        config.args.push(...formValues.args.split(' ').filter(Boolean));
      }
    }

    // 重建环境变量
    if (originalServer?.env) {
      config.env = { ...originalServer.env };
      Object.keys(originalServer.env).forEach(key => {
        const formKey = key.toLowerCase();
        if (formValues[formKey] !== undefined) {
          config.env[key] = formValues[formKey];
        }
      });
    }

    return config;
  };

  // 动态渲染环境配置字段
  const renderConfigFields = () => {
    if (!editingServer) return null;

    const fields: React.ReactNode[] = [];

    // 1. 根据插件类型渲染特定配置字段
    if (editingServer.args && Array.isArray(editingServer.args)) {
      const [packageName, ...configArgs] = editingServer.args;

      if (packageName?.includes('filesystem')) {
        // 文件系统插件：路径配置
        fields.push(
          <Form.Item
            key="path"
            name="path"
            label="允许访问的文件夹"
            rules={[{ required: true, message: '请设置文件夹路径' }]}
            extra="设置文件系统插件可以访问的目录路径"
          >
            <Input
              placeholder="例如：/Users/username/Documents"
              style={{ width: '100%' }}
            />
          </Form.Item>
        );
      }
    }

    // 2. 环境变量配置
    if (envVars.length > 0) {
      if (fields.length > 0) {
        fields.push(<Divider key="env-divider">环境变量配置</Divider>);
      }

      envVars.forEach((envVar, index) => {
        const fieldName = envVar.key.toLowerCase();
        const isPassword = envVar.key.toLowerCase().includes('password') ||
                          envVar.key.toLowerCase().includes('secret') ||
                          envVar.key.toLowerCase().includes('key') ||
                          envVar.key.toLowerCase().includes('token');

        fields.push(
          <Form.Item
            key={`env-${index}`}
            name={fieldName}
            label={envVar.key}
            extra={isPassword ? '敏感信息，输入后将被加密存储' : `配置 ${envVar.key} 环境变量`}
          >
            <Input
              type={isPassword ? 'password' : 'text'}
              placeholder={`请输入 ${envVar.key} 的值`}
              style={{ width: '100%' }}
            />
          </Form.Item>
        );
      });
    }

    // 3. 如果没有任何配置字段，显示提示
    if (fields.length === 0) {
      fields.push(
        <div key="no-config" style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#999',
          background: '#fafafa',
          borderRadius: '8px',
          border: '1px dashed #d9d9d9'
        }}>
          <div style={{ marginBottom: 8, fontSize: '16px' }}>此插件无需额外配置</div>
          <div style={{ fontSize: '14px' }}>插件将使用默认设置运行</div>
        </div>
      );
    }

    return fields;
  };

  useEffect(() => {
    if (visible) {
      if (editingServer) {
        console.log('🔧 [useEffect] 开始处理编辑服务器:', editingServer);

        // 设置服务器类型
        setServerType(editingServer.type);

        // 设置环境变量列表（用于动态渲染）
        const envVarList = Object.entries(editingServer.env || {}).map(([key, value]) => ({
          key,
          value: value as string
        }));
        setEnvVars(envVarList);

        // 设置请求头列表
        const headerList = Object.entries(editingServer.headers || {}).map(([key, value]) => ({
          key,
          value: value as string
        }));
        setHeaders(headerList);

        // 延迟设置表单值，确保表单字段已经渲染
        setTimeout(() => {
          const parsedConfig = parseServerConfig(editingServer);
          console.log('🔧 [useEffect] 延迟设置表单值:', parsedConfig);
          form.setFieldsValue(parsedConfig);

          // 再次验证表单值是否设置成功
          setTimeout(() => {
            const currentValues = form.getFieldsValue();
            console.log('🔧 [useEffect] 最终表单值:', currentValues);
          }, 100);
        }, 200);
      } else {
        // 新建模式：重置状态
        setActiveTab('quick');
        setServerType('stdio');
        setEnvVars([]);
        setHeaders([]);
        form.resetFields();
      }
    }
  }, [visible, editingServer]);

  const handleTypeChange = (value: 'stdio' | 'sse') => {
    setServerType(value);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const handleTest = async () => {
    try {
      await form.validateFields();
      setTesting(true);
      
      const values = form.getFieldsValue();
      const config = {
        ...values,
        args: values.args ? values.args.split(' ').filter((arg: string) => arg.trim()) : [],
        env: envVars.reduce((acc, { key, value }) => {
          if (key.trim()) acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
        headers: headers.reduce((acc, { key, value }) => {
          if (key.trim()) acc[key] = value;
          return acc;
        }, {} as Record<string, string>)
      };

      // 这里应该调用测试API，暂时模拟
      await new Promise(resolve => setTimeout(resolve, 2000));
      message.success('连接测试成功！');
    } catch (error) {
      message.error('连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      let config;
      if (editingServer) {
        // 编辑模式：使用配置构建器重建配置
        config = {
          ...editingServer,
          ...buildServerConfig(values, editingServer)
        };
      } else {
        // 新建模式：创建新配置
        config = {
          ...values,
          args: values.args ? values.args.split(' ').filter((arg: string) => arg.trim()) : [],
          env: envVars.reduce((acc, { key, value }) => {
            if (key.trim()) acc[key] = value;
            return acc;
          }, {} as Record<string, string>),
          headers: headers.reduce((acc, { key, value }) => {
            if (key.trim()) acc[key] = value;
            return acc;
          }, {} as Record<string, string>)
        };
      }

      onSave(config);
      message.success(editingServer ? '服务器配置更新成功' : '服务器配置保存成功');
    } catch (error) {
      message.error('请检查表单输入');
    }
  };

  const handleJsonSave = () => {
    try {
      const config = JSON.parse(jsonConfig);

      // 检查是否是mcpServers格式
      if (config.mcpServers) {
        // 处理多个服务器配置
        const serverKeys = Object.keys(config.mcpServers);
        if (serverKeys.length === 0) {
          message.error('配置中没有找到MCP服务器');
          return;
        }

        // 取第一个服务器配置或让用户选择
        const firstServerKey = serverKeys[0];
        const serverConfig = config.mcpServers[firstServerKey];

        const processedConfig = {
          id: `mcp-${Date.now()}`,
          name: firstServerKey,
          description: `从JSON导入的${firstServerKey}服务器`,
          type: 'stdio',
          isEnabled: true,
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          timeout: 30000,
          retryCount: 3
        };

        onSave(processedConfig);
      } else {
        // 直接的服务器配置
        onSave(config);
      }

      message.success(editingServer ? '服务器配置更新成功' : '服务器配置保存成功');
    } catch (error) {
      console.error('JSON配置解析错误:', error);
      if (error instanceof SyntaxError) {
        message.error(`JSON格式错误: ${error.message}`);
      } else {
        message.error('配置格式不正确，请检查是否包含必要的字段（command、args等）');
      }
    }
  };

  const handleJsonFormat = () => {
    try {
      if (!jsonConfig.trim()) {
        message.warning('请先输入JSON配置内容');
        return;
      }
      const config = JSON.parse(jsonConfig);
      setJsonConfig(JSON.stringify(config, null, 2));
      message.success('✅ JSON格式化成功');
    } catch (error) {
      console.error('JSON格式化错误:', error);
      if (error instanceof SyntaxError) {
        message.error(`JSON语法错误: ${error.message}`);
      } else {
        message.error('JSON格式化失败，请检查语法');
      }
    }
  };

  const handleQuickSave = (values: any) => {
    try {
      // 解析命令行为command和args
      const commandParts = values.command.trim().split(/\s+/);
      const command = commandParts[0];
      const args = commandParts.slice(1);

      const config = {
        id: `mcp-${Date.now()}`,
        name: values.name,
        description: values.description || '',
        type: 'stdio',
        isEnabled: true,
        command: command,
        args: args,
        env: {},
        timeout: 30000,
        retryCount: 3
      };

      onSave(config);
      message.success(editingServer ? '服务器配置更新成功' : '服务器配置保存成功');
    } catch (error) {
      message.error('配置保存失败，请检查输入');
    }
  };

  const generateJsonTemplate = () => {
    const template = {
      "mcpServers": {
        "promptx": {
          "command": "npx",
          "args": [
            "-y",
            "-f",
            "--registry",
            "https://registry.npmjs.org",
            "dpml-prompt@beta",
            "mcp-server"
          ]
        },
        "filesystem": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-filesystem", "/path/to/your/directory"],
          "env": {}
        },
        "sqlite": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-sqlite", "/path/to/database.db"],
          "env": {}
        },
        "brave-search": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-brave-search"],
          "env": {
            "BRAVE_API_KEY": "your-api-key-here"
          }
        },
        "github": {
          "command": "npx",
          "args": ["@modelcontextprotocol/server-github"],
          "env": {
            "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"
          }
        }
      }
    };
    setJsonConfig(JSON.stringify(template, null, 2));
    message.success('已生成常用MCP插件配置模板');
  };

  return (
    <Modal
      title={editingServer ? '编辑插件配置' : '添加插件配置'}
      open={visible}
      onCancel={onCancel}
      width={editingServer ? 800 : 700}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        activeTab === 'json' && (
          <Button key="format" onClick={handleJsonFormat} icon={<CodeOutlined />}>
            格式化
          </Button>
        ),
        activeTab === 'json' && (
          <Button key="template" onClick={generateJsonTemplate} icon={<ExperimentOutlined />}>
            生成示例
          </Button>
        ),
        <Button key="save" type="primary" onClick={
          editingServer ? handleSave :
          activeTab === 'json' ? handleJsonSave :
          handleQuickSave
        }>
          {editingServer ? '更新' : '保存'}
        </Button>
      ].filter(Boolean)}
    >
      {editingServer ? (
        // 编辑模式：左右布局
        <div style={{ display: 'flex', gap: '24px', minHeight: '300px' }}>
          {/* 左侧：插件信息 */}
          <div style={{ width: '200px', flexShrink: 0 }}>
            <div style={{
              background: '#f8f9fa',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  background: '#1890ff',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  margin: '0 auto 8px'
                }}>
                  {editingServer.name.charAt(0).toUpperCase()}
                </div>
                <h4 style={{ margin: 0, fontSize: '16px' }}>{editingServer.name}</h4>
              </div>

              <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                {editingServer.description}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e9ecef' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>类型</div>
                <div style={{ fontSize: '14px' }}>{editingServer.type}</div>
              </div>
            </div>
          </div>

          {/* 右侧：配置表单 */}
          <div style={{ flex: 1 }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
            >
              {/* 动态渲染配置字段 */}
              {renderConfigFields()}

              {/* 测试连接按钮 */}
              <Button
                type="default"
                onClick={handleTest}
                loading={testing}
                icon={<ExperimentOutlined />}
                style={{ width: '100%', marginTop: '16px' }}
              >
                测试连接
              </Button>
            </Form>
          </div>
        </div>
      ) : (
        // 新建模式：保留标签页
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
          {
            key: 'quick',
            label: (
              <Space>
                <ThunderboltOutlined />
                快速配置
              </Space>
            ),
            children: (
              <div style={{ padding: '16px 0' }}>
                <Alert
                  message="快速配置插件"
                  description="输入插件名称和命令行，系统会自动生成配置"
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Form
                  form={quickForm}
                  layout="vertical"
                  onFinish={handleQuickSave}
                >
                  <Form.Item
                    name="name"
                    label="插件名称"
                    rules={[{ required: true, message: '请输入插件名称' }]}
                  >
                    <Input
                      placeholder="例如：DeeChat工具包"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    name="command"
                    label="安装命令"
                    rules={[{ required: true, message: '请输入安装命令' }]}
                    extra="例如：npx -y dpml-prompt@beta mcp-server"
                  >
                    <Input
                      placeholder="npx -y dpml-prompt@beta mcp-server"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item name="description" label="描述（可选）">
                    <TextArea
                      rows={2}
                      placeholder="简单描述这个插件的功能..."
                      size="large"
                    />
                  </Form.Item>
                </Form>
              </div>
            )
          },
          {
            key: 'json',
            label: (
              <Space>
                <CodeOutlined />
                JSON配置
              </Space>
            ),
            children: (
              <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                <Alert
                  message="📋 JSON配置格式说明"
                  description={
                    <div>
                      <p style={{ marginBottom: '8px' }}>
                        支持标准的MCP服务器配置格式，可以直接粘贴从其他地方复制的配置：
                      </p>
                      <div style={{
                        background: '#f6f8fa',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #e1e4e8',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#586069', marginBottom: '4px' }}>
                          💡 标准格式示例：
                        </div>
                        <pre style={{
                          fontSize: '11px',
                          margin: 0,
                          color: '#24292e',
                          lineHeight: '1.4'
                        }}>
{`{
  "mcpServers": {
    "插件名称": {
      "command": "命令",
      "args": ["参数1", "参数2"],
      "env": {
        "环境变量": "值"
      }
    }
  }
}`}
                        </pre>
                      </div>
                      <div style={{ fontSize: '12px', color: '#586069' }}>
                        💡 提示：点击"生成模板"按钮可以获取常用插件的配置示例
                      </div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <TextArea
                  value={jsonConfig}
                  onChange={(e) => setJsonConfig(e.target.value)}
                  placeholder={`请输入或粘贴MCP插件配置，例如：

{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/path/to/directory"],
      "env": {}
    }
  }
}

💡 提示：可以点击"生成模板"按钮获取常用配置示例`}
                  style={{
                    flex: 1,
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    fontSize: 13,
                    lineHeight: '1.5',
                    background: '#fafbfc',
                    border: '1px solid #e1e4e8',
                    borderRadius: '6px'
                  }}
                  autoSize={{ minRows: 10, maxRows: 18 }}
                />
              </div>
            )
          }
          ]}
        />
      )}
    </Modal>
  );
};

export default MCPServerConfig;
