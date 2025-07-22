/**
 * MCP工具面板组件
 * 显示和管理MCP工具
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  List,
  Button,
  Input,
  Tag,
  Space,
  Tooltip,
  Modal,
  Form,
  message,
  Spin,
  Empty,
  Badge,
  Descriptions,
  Typography,
  Collapse
} from 'antd';
import {
  SearchOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ToolOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';

const { Search } = Input;
const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface MCPTool {
  name: string;
  description?: string;
  serverId: string;
  serverName: string;
  category?: string;
  tags?: string[];
  inputSchema?: any;
  isAvailable: boolean;
  lastUsed?: string;
  usageCount: number;
}

interface MCPToolPanelProps {
  tools: MCPTool[];
  loading?: boolean;
  onRefresh: () => void;
  onCallTool: (serverId: string, toolName: string, args: any) => Promise<any>;
  onAddServer?: () => void;  // 新增：添加服务器的回调函数
}

const MCPToolPanel: React.FC<MCPToolPanelProps> = ({
  tools,
  loading = false,
  onRefresh,
  onCallTool,
  onAddServer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolCallModal, setToolCallModal] = useState(false);
  const [toolInfoModal, setToolInfoModal] = useState(false);
  const [calling, setCalling] = useState(false);
  const [form] = Form.useForm();

  const filteredTools = tools.filter(tool => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tool.name.toLowerCase().includes(term) ||
      tool.description?.toLowerCase().includes(term) ||
      tool.serverName.toLowerCase().includes(term) ||
      tool.category?.toLowerCase().includes(term) ||
      tool.tags?.some(tag => tag.toLowerCase().includes(term))
    );
  });

  const handleToolCall = (tool: MCPTool) => {
    setSelectedTool(tool);
    setToolCallModal(true);
    form.resetFields();
  };

  const handleToolInfo = (tool: MCPTool) => {
    setSelectedTool(tool);
    setToolInfoModal(true);
  };

  const executeToolCall = async () => {
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

      const result = await onCallTool(selectedTool.serverId, selectedTool.name, args);
      
      if (result.success) {
        message.success('工具调用成功');
        Modal.info({
          title: '工具执行结果',
          content: (
            <div>
              <Paragraph>
                <Text strong>工具：</Text> {selectedTool.name}
              </Paragraph>
              <Paragraph>
                <Text strong>执行时间：</Text> {result.duration}ms
              </Paragraph>
              <Paragraph>
                <Text strong>结果：</Text>
              </Paragraph>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '4px',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </div>
          ),
          width: 600
        });
        setToolCallModal(false);
      } else {
        message.error(`工具调用失败: ${result.error}`);
      }
    } catch (error) {
      message.error('请检查参数输入');
    } finally {
      setCalling(false);
    }
  };

  const renderToolItem = (tool: MCPTool) => {
    const statusIcon = tool.isAvailable ? (
      <CheckCircleOutlined style={{ color: '#52c41a' }} />
    ) : (
      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
    );

    return (
      <List.Item
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f0f0f0',
          transition: 'background-color 0.2s',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#fafafa';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        actions={[
          <Tooltip title="查看详情" key="info">
            <Button
              type="text"
              icon={<InfoCircleOutlined />}
              onClick={() => handleToolInfo(tool)}
              size="small"
            />
          </Tooltip>,
          <Tooltip title="调用工具" key="call">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled={!tool.isAvailable}
              onClick={() => handleToolCall(tool)}
              size="small"
            />
          </Tooltip>
        ]}
      >
        <List.Item.Meta
          avatar={
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: tool.isAvailable ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${tool.isAvailable ? '#b7eb8f' : '#ffccc7'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ToolOutlined style={{
                fontSize: 18,
                color: tool.isAvailable ? '#52c41a' : '#ff4d4f'
              }} />
            </div>
          }
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text strong style={{ fontSize: 16 }}>{tool.name}</Text>
              {statusIcon}
              {tool.category && (
                <Tag color="blue" size="small">{tool.category}</Tag>
              )}
            </div>
          }
          description={
            <div>
              <div style={{
                color: '#666',
                fontSize: 14,
                lineHeight: 1.4,
                marginBottom: 8,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {tool.description || '暂无描述'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  来源: {tool.serverName}
                </Text>
                {tool.usageCount > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    使用 {tool.usageCount} 次
                  </Text>
                )}
                {tool.tags?.slice(0, 3).map(tag => (
                  <Tag key={tag} size="small" style={{ fontSize: 11, margin: 0 }}>
                    {tag}
                  </Tag>
                ))}
                {tool.tags && tool.tags.length > 3 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    +{tool.tags.length - 3}
                  </Text>
                )}
              </div>
            </div>
          }
        />
      </List.Item>
    );
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

  return (
    <div>
      {/* 搜索栏 */}
      <div style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索插件..."
          allowClear
          style={{ width: 300 }}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* 工具列表 */}
      <Spin spinning={loading}>
        {filteredTools.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#fafafa',
            borderRadius: 8,
            border: '1px dashed #d9d9d9'
          }}>
            <ToolOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <div style={{ fontSize: 16, color: '#999', marginBottom: 8 }}>
              {searchTerm ? '未找到匹配的插件' : '暂无已安装的插件'}
            </div>
            <div style={{ fontSize: 14, color: '#bbb' }}>
              {searchTerm ? '请尝试其他关键词搜索' : '请前往"插件市场"安装插件，或点击"添加插件"手动添加配置'}
            </div>
          </div>
        ) : (
          <List
            dataSource={filteredTools}
            renderItem={renderToolItem}
            style={{
              background: '#fff',
              borderRadius: 8,
              border: '1px solid #f0f0f0'
            }}
            pagination={{
              pageSize: 8,
              showSizeChanger: false,
              showQuickJumper: false,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 项，共 ${total} 个工具`,
              style: { textAlign: 'center', marginTop: 16 }
            }}
          />
        )}
      </Spin>

      {/* 工具调用模态框 */}
      <Modal
        title={`调用工具: ${selectedTool?.name}`}
        open={toolCallModal}
        onCancel={() => setToolCallModal(false)}
        onOk={executeToolCall}
        confirmLoading={calling}
        width={600}
      >
        {selectedTool && (
          <div>
            <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="工具名称">{selectedTool.name}</Descriptions.Item>
              <Descriptions.Item label="来源服务器">{selectedTool.serverName}</Descriptions.Item>
              {selectedTool.description && (
                <Descriptions.Item label="描述">{selectedTool.description}</Descriptions.Item>
              )}
            </Descriptions>
            {renderParameterForm()}
          </div>
        )}
      </Modal>

      {/* 工具信息模态框 */}
      <Modal
        title={`工具详情: ${selectedTool?.name}`}
        open={toolInfoModal}
        onCancel={() => setToolInfoModal(false)}
        footer={[
          <Button key="close" onClick={() => setToolInfoModal(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {selectedTool && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="工具名称" span={2}>{selectedTool.name}</Descriptions.Item>
              <Descriptions.Item label="来源服务器" span={2}>{selectedTool.serverName}</Descriptions.Item>
              <Descriptions.Item label="分类">{selectedTool.category || '未分类'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {selectedTool.isAvailable ? (
                  <Badge status="success" text="可用" />
                ) : (
                  <Badge status="error" text="不可用" />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="使用次数">{selectedTool.usageCount}</Descriptions.Item>
              <Descriptions.Item label="最后使用">
                {selectedTool.lastUsed ? new Date(selectedTool.lastUsed).toLocaleString() : '从未使用'}
              </Descriptions.Item>
              {selectedTool.description && (
                <Descriptions.Item label="描述" span={2}>
                  {selectedTool.description}
                </Descriptions.Item>
              )}
              {selectedTool.tags && selectedTool.tags.length > 0 && (
                <Descriptions.Item label="标签" span={2}>
                  {selectedTool.tags.map(tag => (
                    <Tag key={tag} color="blue">{tag}</Tag>
                  ))}
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedTool.inputSchema?.properties && (
              <div style={{ marginTop: 16 }}>
                <Text strong>参数说明：</Text>
                <Collapse size="small" style={{ marginTop: 8 }}>
                  <Panel header="查看参数详情" key="1">
                    <pre style={{ 
                      background: '#f5f5f5', 
                      padding: '12px', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {JSON.stringify(selectedTool.inputSchema, null, 2)}
                    </pre>
                  </Panel>
                </Collapse>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MCPToolPanel;
