/**
 * MCP服务面板组件
 * 显示和管理MCP服务（而不是具体工具）
 * 优化版本：启用开关在卡片上，简化操作
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
  message,
  Spin,
  Empty,
  Badge,
  Descriptions,
  Typography,
  Avatar,
  Divider,
  Switch
} from 'antd';
import {
  SearchOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const { Search } = Input;
const { Text, Paragraph } = Typography;

interface MCPServer {
  id: string;
  name: string;
  description: string;
  type: string;
  isEnabled: boolean;
  command: string;
  args: string[];
  env: Record<string, string>;
  createdAt: string;
  tools?: any[]; // 添加工具列表属性
  updatedAt: string;
  // 运行时状态
  status?: 'connected' | 'disconnected' | 'error';
  toolCount?: number;
  lastUsed?: string;
  toggleLoading?: boolean; // 添加切换loading状态
}

interface MCPServerPanelProps {
  servers: MCPServer[];
  loading?: boolean;
  onRefresh: () => void;
  onRemoveServer: (serverId: string) => Promise<void>;
  onAddServer?: () => void;
  onEditServer?: (server: MCPServer) => void;
  onToggleServer?: (serverId: string, enabled: boolean) => Promise<void>;
}

const MCPServerPanel: React.FC<MCPServerPanelProps> = ({
  servers,
  loading = false,
  onRefresh,
  onRemoveServer,
  onAddServer,
  onEditServer,
  onToggleServer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [serverInfoModal, setServerInfoModal] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const filteredServers = servers.filter(server => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      server.name.toLowerCase().includes(term) ||
      server.description?.toLowerCase().includes(term) ||
      server.type?.toLowerCase().includes(term)
    );
  });

  const handleServerInfo = (server: MCPServer) => {
    setSelectedServer(server);
    setServerInfoModal(true);
  };

  const handleRemoveServer = async (serverId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个插件吗？此操作不可撤销。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setRemoving(serverId);
          await onRemoveServer(serverId);
          message.success('插件删除成功');
        } catch (error) {
          message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          setRemoving(null);
        }
      }
    });
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    if (!onToggleServer) return;

    try {
      await onToggleServer(serverId, enabled);
      // 不在这里显示成功消息，由父组件处理
    } catch (error) {
      message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'success';
      case 'disconnected': return 'default';
      case 'error': return 'error';
      default: return 'processing';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'connected': return '已连接';
      case 'disconnected': return '未连接';
      case 'error': return '连接错误';
      default: return '未知';
    }
  };

  const getServerIcon = (name: string) => {
    const colors = ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1', '#667eea', '#9f7aea'];
    if (!name || typeof name !== 'string' || name.length === 0) {
      return colors[0]; // 返回默认颜色
    }
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // 检查是否为内置插件
  const isBuiltinPlugin = (serverId: string) => {
    return serverId === 'promptx-builtin';
  };

  return (
    <div>
      {/* 工具栏 */}
      <div style={{ 
        marginBottom: 16, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <Search
          placeholder="搜索插件..."
          allowClear
          style={{ width: 300 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          prefix={<SearchOutlined />}
        />
        
        <div style={{ width: 1 }} />
      </div>

      {/* 统计信息 */}
      <div style={{ marginBottom: 16, color: '#666', fontSize: '14px' }}>
        共 {filteredServers.length} 个插件
        {servers.length !== filteredServers.length && ` · 筛选自 ${servers.length} 个`}
      </div>

      {/* 服务列表 */}
      <Spin spinning={loading}>
        {filteredServers.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div style={{ marginBottom: 8 }}>
                  {searchTerm ? '没有找到匹配的插件' : '还没有安装任何插件'}
                </div>
                {!searchTerm && onAddServer && (
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={onAddServer}
                    style={{
                      border: '2px dashed #d9d9d9',
                      height: 'auto',
                      padding: '8px 16px'
                    }}
                  >
                    添加第一个插件
                  </Button>
                )}
              </div>
            }
          />
        ) : (
          <List
            grid={{ 
              gutter: 16, 
              xs: 1, 
              sm: 1, 
              md: 2, 
              lg: 2, 
              xl: 3, 
              xxl: 4 
            }}
            dataSource={filteredServers}
            renderItem={(server) => (
              <List.Item>
                <Card
                  hoverable
                  size="small"
                  style={{ height: '100%' }}
                  styles={{ body: { padding: 16 } }}
                  actions={[
                    <Tooltip title="查看详情" key="info">
                      <Button
                        type="text"
                        icon={<InfoCircleOutlined />}
                        onClick={() => handleServerInfo(server)}
                      />
                    </Tooltip>,
                    <Tooltip
                      title={isBuiltinPlugin(server.id) ? "内置插件不可编辑" : "编辑配置"}
                      key="edit"
                    >
                      <Button
                        type="text"
                        icon={<SettingOutlined />}
                        onClick={() => onEditServer?.(server)}
                        disabled={!onEditServer || isBuiltinPlugin(server.id)}
                      />
                    </Tooltip>,
                    <Tooltip
                      title={isBuiltinPlugin(server.id) ? "内置插件不可删除" : "删除插件"}
                      key="delete"
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={removing === server.id}
                        disabled={isBuiltinPlugin(server.id)}
                        onClick={() => handleRemoveServer(server.id)}
                      />
                    </Tooltip>
                  ]}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Avatar
                      size={40}
                      style={{ 
                        backgroundColor: getServerIcon(server.name),
                        flexShrink: 0,
                        fontWeight: 'bold'
                      }}
                    >
                      {server.name ? server.name.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong style={{ fontSize: '16px' }}>
                            {server.name}
                          </Text>
                          {isBuiltinPlugin(server.id) && (
                            <Tag color="blue" size="small">内置</Tag>
                          )}
                          <Badge
                            status={getStatusColor(server.status)}
                            text={getStatusText(server.status)}
                          />
                        </div>
                        <Tooltip title={
                          isBuiltinPlugin(server.id)
                            ? '内置插件不可禁用'
                            : server.toggleLoading
                            ? '正在切换状态...'
                            : (server.isEnabled ? '点击禁用插件' : '点击启用插件')
                        }>
                          <Switch
                            size="small"
                            checked={server.isEnabled}
                            loading={server.toggleLoading}
                            onChange={(checked) => handleToggleServer(server.id, checked)}
                            disabled={!onToggleServer || server.toggleLoading || isBuiltinPlugin(server.id)}
                            style={isBuiltinPlugin(server.id) ? { opacity: 0.6 } : {}}
                          />
                        </Tooltip>
                      </div>
                      
                      <Paragraph 
                        style={{ 
                          margin: 0, 
                          color: '#666', 
                          fontSize: '14px',
                          marginBottom: 8
                        }}
                        ellipsis={{ rows: 2 }}
                      >
                        {server.description || '暂无描述'}
                      </Paragraph>
                      
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Tag color="blue">{server.type}</Tag>
                        {server.toolCount !== undefined && (
                          <Tag color="green">{server.toolCount} 个工具</Tag>
                        )}
                      </div>

                      {/* 显示工具列表 */}
                      {server.tools && server.tools.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>
                            可用工具：
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {server.tools.slice(0, 3).map((tool: any) => (
                              <Tag
                                key={tool.name}
                                size="small"
                                color="cyan"
                                style={{ fontSize: '11px' }}
                              >
                                {tool.name}
                              </Tag>
                            ))}
                            {server.tools.length > 3 && (
                              <Tag
                                size="small"
                                color="default"
                                style={{ fontSize: '11px' }}
                              >
                                +{server.tools.length - 3} 更多
                              </Tag>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Spin>

      {/* 服务详情对话框 */}
      <Modal
        title={
          <Space>
            <InfoCircleOutlined />
            插件详情
          </Space>
        }
        open={serverInfoModal}
        onCancel={() => setServerInfoModal(false)}
        footer={[
          <Button key="close" onClick={() => setServerInfoModal(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {selectedServer && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="插件名称">
              {selectedServer.name}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {selectedServer.description || '暂无描述'}
            </Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color="blue">{selectedServer.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Badge 
                status={getStatusColor(selectedServer.status)} 
                text={getStatusText(selectedServer.status)}
              />
              {selectedServer.isEnabled ? (
                <Tag color="green" style={{ marginLeft: 8 }}>已启用</Tag>
              ) : (
                <Tag color="red" style={{ marginLeft: 8 }}>已禁用</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="工具数量">
              {selectedServer.toolCount || 0} 个
            </Descriptions.Item>
            {selectedServer.tools && selectedServer.tools.length > 0 && (
              <Descriptions.Item label="可用工具">
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {selectedServer.tools.map((tool: any) => (
                      <Tag
                        key={tool.name}
                        color="cyan"
                        style={{
                          marginBottom: 4,
                          cursor: 'pointer'
                        }}
                        title={tool.description || tool.name}
                      >
                        {tool.name}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="命令">
              <Text code>{selectedServer.command}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="参数">
              <Text code>{selectedServer.args?.join(' ') || '无'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(selectedServer.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="最后更新">
              {new Date(selectedServer.updatedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default MCPServerPanel;
