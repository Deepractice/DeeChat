/**
 * MCP工具选择器组件
 * 在对话界面中选择和使用MCP工具
 */

import React, { useState, useEffect } from 'react';
import {
  Button,
  Dropdown,
  Menu,
  Badge,
  Tooltip,
  Modal,
  Form,
  Input,
  Space,
  Tag,
  Typography,
  Divider,
  message
} from 'antd';
import {
  ToolOutlined,
  DownOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface MCPTool {
  name: string;
  description?: string;
  serverId: string;
  serverName: string;
  category?: string;
  tags?: string[];
  inputSchema?: any;
  isAvailable: boolean;
  usageCount: number;
}

interface MCPToolSelectorProps {
  onToolCall?: (toolName: string, args: any, result: any) => void;
  disabled?: boolean;
  size?: 'small' | 'middle' | 'large';
}

const MCPToolSelector: React.FC<MCPToolSelectorProps> = ({
  onToolCall,
  disabled = false,
  size = 'middle'
}) => {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolCallModal, setToolCallModal] = useState(false);
  const [calling, setCalling] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTools();

    // 延迟重新加载工具，等待PromptX初始化完成
    const retryLoadTools = () => {
      setTimeout(() => {
        console.log('🔄 [MCPToolSelector] 延迟重新加载工具列表（等待PromptX初始化）');
        loadTools();
      }, 3000); // 3秒后重试

      // 再次重试，确保获取到工具
      setTimeout(() => {
        console.log('🔄 [MCPToolSelector] 第二次延迟重新加载工具列表');
        loadTools();
      }, 6000); // 6秒后再次重试
    };

    retryLoadTools();
  }, []);

  const loadTools = async () => {
    console.log('🔧 [MCPToolSelector] 开始加载工具列表...');
    setLoading(true);
    try {
      // 详细检查MCP API可用性
      console.log('🔧 [MCPToolSelector] 检查window.electronAPI:', !!window.electronAPI);
      console.log('🔧 [MCPToolSelector] 检查window.electronAPI.mcp:', !!window.electronAPI?.mcp);
      console.log('🔧 [MCPToolSelector] 检查getAllTools方法:', !!window.electronAPI?.mcp?.getAllTools);

      if (!window.electronAPI?.mcp?.getAllTools) {
        console.warn('❌ [MCPToolSelector] MCP API未初始化，跳过工具加载');
        console.log('🔧 [MCPToolSelector] 可用的API:', Object.keys(window.electronAPI || {}));
        if (window.electronAPI?.mcp) {
          console.log('🔧 [MCPToolSelector] MCP API方法:', Object.keys(window.electronAPI.mcp));
        }
        return;
      }

      console.log('✅ [MCPToolSelector] MCP API可用，开始调用getAllTools...');
      const response = await window.electronAPI.mcp.getAllTools();
      console.log('📝 [MCPToolSelector] getAllTools响应:', response);
      
      if (response?.success) {
        const availableTools = response.data?.filter((tool: MCPTool) => tool.isAvailable) || [];
        console.log(`✅ [MCPToolSelector] 成功获取到 ${availableTools.length} 个可用工具`);
        setTools(availableTools);
      } else {
        console.error('❌ [MCPToolSelector] 获取工具失败:', response?.error);
      }
    } catch (error) {
      console.error('❌ [MCPToolSelector] 异常:', error);
    } finally {
      setLoading(false);
      console.log('🏁 [MCPToolSelector] 工具加载完成');
    }
  };

  const handleToolSelect = (tool: MCPTool) => {
    setSelectedTool(tool);
    setToolCallModal(true);
    form.resetFields();
  };

  const handleToolCall = async () => {
    if (!selectedTool) return;

    try {
      const values = await form.validateFields();
      setCalling(true);

      // 构建参数对象
      const args: any = {};
      if (selectedTool.inputSchema?.properties) {
        Object.keys(selectedTool.inputSchema.properties).forEach(key => {
          if (values[key] !== undefined && values[key] !== '') {
            args[key] = values[key];
          }
        });
      }

      // 调用工具
      const response = await window.electronAPI.mcp.callTool({
        serverId: selectedTool.serverId,
        toolName: selectedTool.name,
        arguments: args,
        callId: Date.now().toString()
      });

      if (response.success) {
        message.success('工具调用成功');
        
        // 通知父组件
        if (onToolCall) {
          onToolCall(selectedTool.name, args, response.data.result);
        }
        
        setToolCallModal(false);
      } else {
        message.error(`工具调用失败: ${response.error}`);
      }
    } catch (error) {
      message.error('请检查参数输入');
    } finally {
      setCalling(false);
    }
  };

  const renderParameterForm = () => {
    if (!selectedTool?.inputSchema?.properties) {
      return <Text type="secondary">此工具无需参数</Text>;
    }

    const { properties, required = [] } = selectedTool.inputSchema;

    return (
      <Form form={form} layout="vertical">
        {Object.entries(properties).map(([key, schema]: [string, any]) => {
          const isRequired = required.includes(key);
          const rules = isRequired ? [{ required: true, message: `请输入${key}` }] : [];

          return (
            <Form.Item
              key={key}
              name={key}
              label={
                <Space>
                  {key}
                  {isRequired && <Text type="danger">*</Text>}
                  {schema.description && (
                    <Tooltip title={schema.description}>
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  )}
                </Space>
              }
              rules={rules}
            >
              {schema.type === 'boolean' ? (
                <Input placeholder="true 或 false" />
              ) : schema.type === 'number' ? (
                <Input type="number" placeholder="请输入数字" />
              ) : (
                <Input placeholder={schema.description || `请输入${key}`} />
              )}
            </Form.Item>
          );
        })}
      </Form>
    );
  };

  const groupedTools = tools.reduce((groups, tool) => {
    const category = tool.category || 'general';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(tool);
    return groups;
  }, {} as Record<string, MCPTool[]>);

  const menuItems = Object.entries(groupedTools).map(([category, categoryTools]) => ({
    key: category,
    label: (
      <div>
        <Text strong style={{ textTransform: 'capitalize' }}>
          {category}
        </Text>
        <Badge count={categoryTools.length} size="small" style={{ marginLeft: 8 }} />
      </div>
    ),
    children: categoryTools.map(tool => ({
      key: `${tool.serverId}:${tool.name}`,
      label: (
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>{tool.name}</Text>
            <Space size="small">
              {tool.usageCount > 0 && (
                <Badge count={tool.usageCount} size="small" />
              )}
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToolSelect(tool);
                }}
              />
            </Space>
          </div>
          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{ margin: '4px 0', fontSize: '12px', color: '#666' }}
          >
            {tool.description || '暂无描述'}
          </Paragraph>
          <div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              来源: {tool.serverName}
            </Text>
            {tool.tags?.slice(0, 2).map(tag => (
              <Tag key={tag} size="small" style={{ marginLeft: 4 }}>
                {tag}
              </Tag>
            ))}
          </div>
        </div>
      ),
      onClick: () => handleToolSelect(tool)
    }))
  }));

  return (
    <>
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        disabled={disabled || tools.length === 0}
        placement="topLeft"
      >
        <Button
          icon={<ToolOutlined />}
          size={size}
          disabled={disabled}
          loading={loading}
        >
          <Space>
            MCP工具
            <Badge count={tools.length} size="small" />
            <DownOutlined />
          </Space>
        </Button>
      </Dropdown>

      <Tooltip title="刷新工具列表">
        <Button
          type="text"
          icon={<ReloadOutlined />}
          size={size}
          onClick={loadTools}
          loading={loading}
          disabled={disabled}
        />
      </Tooltip>

      {/* 工具调用模态框 */}
      <Modal
        title={`调用工具: ${selectedTool?.name}`}
        open={toolCallModal}
        onCancel={() => setToolCallModal(false)}
        onOk={handleToolCall}
        confirmLoading={calling}
        width={600}
      >
        {selectedTool && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Tag color="blue">{selectedTool.category}</Tag>
                <Text type="secondary">来源: {selectedTool.serverName}</Text>
              </Space>
            </div>
            
            {selectedTool.description && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>描述：</Text>
                <Paragraph>{selectedTool.description}</Paragraph>
              </div>
            )}

            <Divider orientation="left">参数设置</Divider>
            {renderParameterForm()}
          </div>
        )}
      </Modal>
    </>
  );
};

export default MCPToolSelector;
