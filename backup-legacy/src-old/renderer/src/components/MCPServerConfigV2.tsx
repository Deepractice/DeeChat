/**
 * MCP服务器配置组件 V2
 * 支持新架构的完整配置选项
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
  App,
  Tabs,
  Tag,
  Alert,
  Radio,
  Row,
  Col,
  Tooltip,
  AutoComplete
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  SettingOutlined, 
  CodeOutlined,
  CloudOutlined,
  LockOutlined,
  FolderOutlined,
  ApiOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { 
  MCPTransportType, 
  MCPServerCollection,
  MCPExecutionMode,
  getProtocolDisplayName,
  getExecutionModeDisplayName,
  getCollectionDisplayName,
  isNetworkProtocol,
  supportsAuth,
  isDeprecatedProtocol,
  PROTOCOL_FEATURES
} from '../../../shared/types/mcp-protocol';

const { Option } = Select;
const { TextArea } = Input;

interface MCPServerConfigV2Props {
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

const MCPServerConfigV2: React.FC<MCPServerConfigV2Props> = ({
  visible,
  onCancel,
  onSave,
  editingServer
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [transportType, setTransportType] = useState<MCPTransportType>('stdio');
  const [collection, setCollection] = useState<MCPServerCollection>('user');
  const [executionMode, setExecutionMode] = useState<MCPExecutionMode | undefined>();
  const [authType, setAuthType] = useState<string>('none');
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [headers, setHeaders] = useState<Header[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editingServer) {
        // 编辑模式
        form.setFieldsValue({
          name: editingServer.name,
          description: editingServer.description,
          type: editingServer.type || 'stdio',
          collection: editingServer.collection || 'user',
          execution: editingServer.execution,
          command: editingServer.command,
          args: editingServer.args?.join(' ') || '',
          url: editingServer.url,
          workingDirectory: editingServer.workingDirectory,
          timeout: editingServer.timeout || 30000,
          isEnabled: editingServer.isEnabled !== false,
          autoStart: editingServer.autoStart,
          autoReconnect: editingServer.autoReconnect !== false,
          authType: editingServer.auth?.type || 'none',
          authToken: editingServer.auth?.token,
          tags: editingServer.tags?.join(', ') || ''
        });
        
        setTransportType(editingServer.type || 'stdio');
        setCollection(editingServer.collection || 'user');
        setExecutionMode(editingServer.execution);
        setAuthType(editingServer.auth?.type || 'none');
        
        // 环境变量
        if (editingServer.env) {
          setEnvVars(Object.entries(editingServer.env).map(([key, value]) => ({
            key,
            value: value as string
          })));
        }
        
        // 请求头
        if (editingServer.headers) {
          setHeaders(Object.entries(editingServer.headers).map(([key, value]) => ({
            key,
            value: value as string
          })));
        }
        
        // 标签
        if (editingServer.tags) {
          setTags(editingServer.tags);
        }
      } else {
        // 新建模式
        form.resetFields();
        form.setFieldsValue({
          type: 'stdio',
          collection: editingServer?.collection || 'user',
          isEnabled: true,
          autoReconnect: true,
          timeout: 30000,
          authType: 'none'
        });
        setTransportType('stdio');
        setCollection(editingServer?.collection || 'user');
        setExecutionMode(undefined);
        setAuthType('none');
        setEnvVars([]);
        setHeaders([]);
        setTags([]);
      }
    }
  }, [visible, editingServer, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // 构建配置对象
      const config: any = {
        name: values.name,
        description: values.description,
        type: values.type,
        collection: values.collection,
        execution: values.execution,
        isEnabled: values.isEnabled,
        autoStart: values.autoStart,
        autoReconnect: values.autoReconnect,
        timeout: values.timeout
      };

      // 协议特定配置
      if (values.type === 'stdio') {
        config.command = values.command;
        config.args = values.args ? values.args.split(/\s+/).filter(Boolean) : [];
        if (values.workingDirectory) {
          config.workingDirectory = values.workingDirectory;
        }
      } else if (isNetworkProtocol(values.type)) {
        config.url = values.url;
      }

      // 认证配置
      if (supportsAuth(values.type) && values.authType !== 'none') {
        config.auth = {
          type: values.authType
        };
        
        if (values.authType === 'bearer') {
          config.auth.token = values.authToken;
        } else if (values.authType === 'oauth2') {
          // TODO: 实现OAuth2配置
        }
      }

      // 环境变量
      if (envVars.length > 0) {
        config.env = {};
        envVars.forEach(({ key, value }) => {
          if (key) config.env[key] = value;
        });
      }

      // 请求头
      if (headers.length > 0 && isNetworkProtocol(values.type)) {
        config.headers = {};
        headers.forEach(({ key, value }) => {
          if (key) config.headers[key] = value;
        });
      }

      // 标签
      if (values.tags) {
        config.tags = values.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
      }

      await onSave(config);
      setSaving(false);
    } catch (error) {
      console.error('表单验证失败:', error);
      setSaving(false);
    }
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

  const handleTransportChange = (type: MCPTransportType) => {
    setTransportType(type);
    
    // 清除不相关的字段
    if (isNetworkProtocol(type)) {
      form.setFieldsValue({
        command: undefined,
        args: undefined,
        workingDirectory: undefined
      });
    } else {
      form.setFieldsValue({
        url: undefined
      });
      setHeaders([]);
    }
    
    // 重置认证
    if (!supportsAuth(type)) {
      setAuthType('none');
      form.setFieldsValue({
        authType: 'none',
        authToken: undefined
      });
    }
  };

  const getProtocolAlert = () => {
    if (transportType === 'sse') {
      return (
        <Alert
          message="SSE协议已弃用"
          description="SSE (Server-Sent Events) 在新版MCP中已被弃用，建议使用 Streamable HTTP 协议替代。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }
    
    const features = PROTOCOL_FEATURES[transportType];
    if (features) {
      const supportedFeatures = Object.entries(features)
        .filter(([_, supported]) => supported)
        .map(([feature]) => feature);
      
      if (supportedFeatures.length > 0) {
        return (
          <Alert
            message={`${getProtocolDisplayName(transportType)} 支持的特性`}
            description={
              <Space wrap>
                {supportedFeatures.includes('streaming') && <Tag color="blue">流式传输</Tag>}
                {supportedFeatures.includes('notifications') && <Tag color="green">服务器通知</Tag>}
                {supportedFeatures.includes('sessions') && <Tag color="orange">会话管理</Tag>}
                {supportedFeatures.includes('reconnect') && <Tag color="purple">自动重连</Tag>}
                {supportedFeatures.includes('auth') && <Tag color="red">认证支持</Tag>}
              </Space>
            }
            type="info"
            style={{ marginBottom: 16 }}
          />
        );
      }
    }
    
    return null;
  };

  return (
    <Modal
      title={editingServer?.id ? '编辑MCP插件' : '添加MCP插件'}
      open={visible}
      onCancel={onCancel}
      onOk={handleSave}
      confirmLoading={saving}
      width={800}
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
      >
        <Tabs defaultActiveKey="basic">
          <Tabs.TabPane tab="基础配置" key="basic">
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="name"
                  label="插件名称"
                  rules={[{ required: true, message: '请输入插件名称' }]}
                >
                  <Input placeholder="例如: My MCP Server" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="collection"
                  label="插件分组"
                  rules={[{ required: true }]}
                >
                  <Select onChange={setCollection}>
                    <Option value="system">
                      <Space>
                        <Tag color="red">系统</Tag>
                        {getCollectionDisplayName('system')}
                      </Space>
                    </Option>
                    <Option value="project">
                      <Space>
                        <Tag color="blue">项目</Tag>
                        {getCollectionDisplayName('project')}
                      </Space>
                    </Option>
                    <Option value="user">
                      <Space>
                        <Tag color="green">用户</Tag>
                        {getCollectionDisplayName('user')}
                      </Space>
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="插件描述"
            >
              <TextArea 
                rows={2} 
                placeholder="简要描述插件的功能和用途" 
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="传输协议"
                  rules={[{ required: true }]}
                >
                  <Select onChange={handleTransportChange}>
                    <Option value="stdio">
                      <Space>
                        <CodeOutlined />
                        {getProtocolDisplayName('stdio')}
                      </Space>
                    </Option>
                    <Option value="streamable-http">
                      <Space>
                        <ApiOutlined />
                        {getProtocolDisplayName('streamable-http')}
                      </Space>
                    </Option>
                    <Option value="websocket">
                      <Space>
                        <CloudOutlined />
                        {getProtocolDisplayName('websocket')}
                      </Space>
                    </Option>
                    <Option value="sse" disabled>
                      <Space>
                        <Tag color="orange">已弃用</Tag>
                        {getProtocolDisplayName('sse')}
                      </Space>
                    </Option>
                    <Option value="inmemory">
                      <Space>
                        <Tag color="purple">测试</Tag>
                        {getProtocolDisplayName('inmemory')}
                      </Space>
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="execution"
                  label={
                    <Space>
                      执行模式
                      <Tooltip title="留空将自动推断最佳模式">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                >
                  <Select 
                    placeholder="自动推断"
                    allowClear
                    onChange={setExecutionMode}
                  >
                    <Option value="inprocess">
                      <Space>
                        <Tag color="green">快速</Tag>
                        {getExecutionModeDisplayName('inprocess')}
                      </Space>
                    </Option>
                    <Option value="sandbox">
                      <Space>
                        <Tag color="blue">安全</Tag>
                        {getExecutionModeDisplayName('sandbox')}
                      </Space>
                    </Option>
                    <Option value="standard">
                      <Space>
                        <Tag>默认</Tag>
                        {getExecutionModeDisplayName('standard')}
                      </Space>
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {getProtocolAlert()}

            {/* Stdio配置 */}
            {transportType === 'stdio' && (
              <>
                <Form.Item
                  name="command"
                  label="启动命令"
                  rules={[{ required: true, message: '请输入启动命令' }]}
                >
                  <Input placeholder="例如: node, python, /usr/local/bin/mcp-server" />
                </Form.Item>
                
                <Form.Item
                  name="args"
                  label="命令参数"
                  tooltip="多个参数用空格分隔"
                >
                  <Input placeholder="例如: server.js --port 3000" />
                </Form.Item>
                
                <Form.Item
                  name="workingDirectory"
                  label="工作目录"
                  tooltip="留空使用当前目录"
                >
                  <Input 
                    placeholder="例如: /Users/username/mcp-server" 
                    suffix={
                      <Button 
                        type="text" 
                        icon={<FolderOutlined />}
                        onClick={() => {
                          // TODO: 实现目录选择
                        }}
                      />
                    }
                  />
                </Form.Item>
              </>
            )}

            {/* 网络协议配置 */}
            {isNetworkProtocol(transportType) && (
              <Form.Item
                name="url"
                label="服务器URL"
                rules={[
                  { required: true, message: '请输入服务器URL' },
                  { type: 'url', message: '请输入有效的URL' }
                ]}
              >
                <Input 
                  placeholder={
                    transportType === 'websocket' 
                      ? "ws://localhost:8080/mcp" 
                      : "https://api.example.com/mcp"
                  } 
                />
              </Form.Item>
            )}

            <Form.Item
              name="tags"
              label="标签"
              tooltip="用逗号分隔多个标签"
            >
              <Input placeholder="例如: ai, productivity, dev-tools" />
            </Form.Item>
          </Tabs.TabPane>

          <Tabs.TabPane tab="高级配置" key="advanced">
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="isEnabled"
                  label="默认启用"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="autoStart"
                  label="自动启动"
                  valuePropName="checked"
                  tooltip="应用启动时自动连接"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="autoReconnect"
                  label="自动重连"
                  valuePropName="checked"
                  tooltip="连接断开时自动重试"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="timeout"
              label="超时时间（毫秒）"
              rules={[{ type: 'number', min: 1000, message: '超时时间至少1秒' }]}
            >
              <InputNumber 
                style={{ width: '100%' }} 
                min={1000} 
                step={1000}
                placeholder="30000"
              />
            </Form.Item>

            {/* 认证配置 */}
            {supportsAuth(transportType) && (
              <>
                <Divider>认证配置</Divider>
                <Form.Item
                  name="authType"
                  label="认证类型"
                >
                  <Radio.Group onChange={e => setAuthType(e.target.value)}>
                    <Radio value="none">无认证</Radio>
                    <Radio value="bearer">Bearer Token</Radio>
                    <Radio value="oauth2" disabled>OAuth 2.0（即将支持）</Radio>
                    <Radio value="custom">自定义</Radio>
                  </Radio.Group>
                </Form.Item>

                {authType === 'bearer' && (
                  <Form.Item
                    name="authToken"
                    label="Bearer Token"
                    rules={[{ required: true, message: '请输入Token' }]}
                  >
                    <Input.Password placeholder="输入认证Token" />
                  </Form.Item>
                )}
              </>
            )}

            {/* 环境变量 */}
            <Divider>环境变量</Divider>
            <Space direction="vertical" style={{ width: '100%' }}>
              {envVars.map((envVar, index) => (
                <Space key={index} style={{ width: '100%' }}>
                  <Input
                    placeholder="变量名"
                    value={envVar.key}
                    onChange={e => updateEnvVar(index, 'key', e.target.value)}
                    style={{ width: 200 }}
                  />
                  <Input
                    placeholder="变量值"
                    value={envVar.value}
                    onChange={e => updateEnvVar(index, 'value', e.target.value)}
                    style={{ width: 300 }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeEnvVar(index)}
                  />
                </Space>
              ))}
              <Button type="dashed" onClick={addEnvVar} icon={<PlusOutlined />}>
                添加环境变量
              </Button>
            </Space>

            {/* 请求头（仅网络协议） */}
            {isNetworkProtocol(transportType) && (
              <>
                <Divider>自定义请求头</Divider>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {headers.map((header, index) => (
                    <Space key={index} style={{ width: '100%' }}>
                      <Input
                        placeholder="Header名称"
                        value={header.key}
                        onChange={e => updateHeader(index, 'key', e.target.value)}
                        style={{ width: 200 }}
                      />
                      <Input
                        placeholder="Header值"
                        value={header.value}
                        onChange={e => updateHeader(index, 'value', e.target.value)}
                        style={{ width: 300 }}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeHeader(index)}
                      />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={addHeader} icon={<PlusOutlined />}>
                    添加请求头
                  </Button>
                </Space>
              </>
            )}
          </Tabs.TabPane>
        </Tabs>
      </Form>
    </Modal>
  );
};

export default MCPServerConfigV2;