/**
 * MCP管理页面 V2
 * 支持Collection分组和新架构
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  App,
  Tabs,
  Badge,
  Tooltip,
  Typography,
  Collapse,
  Empty,
  Spin,
  Row,
  Col,
  Dropdown,
  Menu,
  Input,
  Select
} from 'antd';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const { Search } = Input;

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  ToolOutlined,
  CloudServerOutlined,
  ShopOutlined,
  FolderOutlined,
  UserOutlined,
  AppstoreOutlined,
  ProjectOutlined,
  FilterOutlined,
  SearchOutlined,
  MoreOutlined,
  ExportOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  WarningOutlined
} from '@ant-design/icons';

import MCPServerConfig from '../components/MCPServerConfig';
import MCPMarketplace from '../components/MCPMarketplace';
import { 
  MCPServerCollection, 
  MCPServerStatus,
  getCollectionDisplayName,
  getProtocolDisplayName 
} from '../../../shared/types/mcp-protocol';

interface MCPServerV2 {
  id: string;
  name: string;
  description?: string;
  type: string;
  collection: MCPServerCollection;
  isEnabled: boolean;
  status?: MCPServerStatus;
  toolCount?: number;
  lastConnected?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  icon?: string;
  version?: string;
  runtime?: {
    status: MCPServerStatus;
    pid?: number;
    startTime?: Date;
    toolCount?: number;
    errorCount?: number;
    lastError?: {
      message: string;
      timestamp: Date;
    };
  };
}

interface CollectionGroup {
  collection: MCPServerCollection;
  servers: MCPServerV2[];
  totalTools: number;
  activeCount: number;
}

const MCPManagementV2: React.FC = () => {
  const { message } = App.useApp();
  const [servers, setServers] = useState<MCPServerV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<Set<string>>(new Set());
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerV2 | undefined>();
  const [activeTab, setActiveTab] = useState('installed');
  const [searchText, setSearchText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedCollections, setExpandedCollections] = useState<string[]>(['user']);

  useEffect(() => {
    loadServers();
    // 设置定时刷新状态
    const interval = setInterval(() => {
      refreshServerStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadServers = async () => {
    setLoading(true);
    try {
      const response = await window.electronAPI.mcp.getAllServers();
      if (response.success) {
        console.log('🔍 [MCPManagementV2] 加载服务器:', response.data);
        setServers(response.data);
      } else {
        message.error(`获取服务器列表失败: ${response.error}`);
      }
    } catch (error) {
      message.error('获取服务器列表失败');
    } finally {
      setLoading(false);
    }
  };

  const refreshServerStatus = async () => {
    try {
      const response = await window.electronAPI.mcp.getServersStatus();
      if (response.success) {
        setServers(prev => prev.map(server => ({
          ...server,
          runtime: response.data[server.id] || server.runtime
        })));
      }
    } catch (error) {
      console.error('刷新服务器状态失败:', error);
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    if (toggleLoading.has(serverId)) return;

    try {
      setToggleLoading(prev => new Set(prev).add(serverId));
      
      const response = await window.electronAPI.mcp.updateServerConfig(serverId, { isEnabled: enabled });
      if (response.success) {
        message.success(`插件已${enabled ? '启用' : '禁用'}`);
        loadServers();
      } else {
        message.error(`操作失败: ${response.error}`);
      }
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setToggleLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      const response = await window.electronAPI.mcp.removeServer(serverId);
      if (response.success) {
        message.success('插件删除成功');
        loadServers();
      } else {
        message.error(`删除失败: ${response.error}`);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleAddServer = (collection?: MCPServerCollection) => {
    setEditingServer(collection ? { collection } as any : undefined);
    setConfigModalVisible(true);
  };

  const handleEditServer = (server: MCPServerV2) => {
    setEditingServer(server);
    setConfigModalVisible(true);
  };

  const handleSaveServer = async (config: any) => {
    try {
      let response;
      if (editingServer?.id) {
        response = await window.electronAPI.mcp.updateServerConfig(editingServer.id, config);
      } else {
        response = await window.electronAPI.mcp.addServer(config);
      }

      if (response.success) {
        message.success(editingServer?.id ? '配置更新成功' : '插件添加成功');
        setConfigModalVisible(false);
        loadServers();
      } else {
        message.error(`操作失败: ${response.error}`);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleExportConfigs = async () => {
    try {
      const response = await window.electronAPI.mcp.exportConfigs();
      if (response.success) {
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcp-configs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        message.success('配置导出成功');
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleImportConfigs = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const configData = e.target?.result as string;
        const response = await window.electronAPI.mcp.importConfigs(configData);
        if (response.success) {
          message.success(`导入成功，已添加 ${response.data.importedCount} 个插件`);
          loadServers();
        } else {
          message.error(`导入失败: ${response.error}`);
        }
      } catch (error) {
        message.error('导入失败');
      }
    };
    reader.readAsText(file);
    return false;
  };

  // 获取所有标签
  const getAllTags = (): string[] => {
    const tagsSet = new Set<string>();
    servers.forEach(server => {
      server.tags?.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet);
  };

  // 过滤服务器
  const filterServers = (servers: MCPServerV2[]): MCPServerV2[] => {
    return servers.filter(server => {
      // 搜索过滤
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchName = server.name.toLowerCase().includes(searchLower);
        const matchDesc = server.description?.toLowerCase().includes(searchLower);
        const matchTags = server.tags?.some(tag => tag.toLowerCase().includes(searchLower));
        if (!matchName && !matchDesc && !matchTags) return false;
      }
      
      // 标签过滤
      if (selectedTags.length > 0) {
        if (!server.tags?.some(tag => selectedTags.includes(tag))) return false;
      }
      
      return true;
    });
  };

  // 按Collection分组
  const groupByCollection = (servers: MCPServerV2[]): CollectionGroup[] => {
    const groups: Record<MCPServerCollection, CollectionGroup> = {
      system: { collection: 'system', servers: [], totalTools: 0, activeCount: 0 },
      project: { collection: 'project', servers: [], totalTools: 0, activeCount: 0 },
      user: { collection: 'user', servers: [], totalTools: 0, activeCount: 0 }
    };

    servers.forEach(server => {
      const collection = server.collection || 'user';
      groups[collection].servers.push(server);
      groups[collection].totalTools += server.toolCount || 0;
      if (server.isEnabled && server.runtime?.status === MCPServerStatus.RUNNING) {
        groups[collection].activeCount++;
      }
    });

    return Object.values(groups).filter(group => group.servers.length > 0);
  };

  const getCollectionIcon = (collection: MCPServerCollection) => {
    switch (collection) {
      case 'system':
        return <AppstoreOutlined />;
      case 'project':
        return <ProjectOutlined />;
      case 'user':
        return <UserOutlined />;
    }
  };

  const getStatusIcon = (status?: MCPServerStatus) => {
    switch (status) {
      case MCPServerStatus.RUNNING:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case MCPServerStatus.STARTING:
      case MCPServerStatus.STOPPING:
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case MCPServerStatus.ERROR:
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <CloseCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  const renderServerCard = (server: MCPServerV2) => {
    const isLoading = toggleLoading.has(server.id);
    const status = server.runtime?.status || MCPServerStatus.STOPPED;
    
    return (
      <Card
        key={server.id}
        size="small"
        style={{ marginBottom: 12 }}
        extra={
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item 
                  key="edit" 
                  icon={<EditOutlined />}
                  onClick={() => handleEditServer(server)}
                >
                  编辑配置
                </Menu.Item>
                <Menu.Item 
                  key="discover" 
                  icon={<ToolOutlined />}
                  onClick={() => window.electronAPI.mcp.discoverServerTools(server.id)}
                >
                  发现工具
                </Menu.Item>
                <Menu.Item 
                  key="export" 
                  icon={<ExportOutlined />}
                >
                  导出配置
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item 
                  key="delete" 
                  icon={<DeleteOutlined />} 
                  danger
                  onClick={() => handleDeleteServer(server.id)}
                >
                  删除插件
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space align="start">
            {getStatusIcon(status)}
            <div style={{ flex: 1 }}>
              <Space>
                <Text strong>{server.name}</Text>
                <Tag color="blue">{getProtocolDisplayName(server.type as any)}</Tag>
                {server.version && <Tag>{server.version}</Tag>}
              </Space>
              {server.description && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {server.description}
                  </Text>
                </div>
              )}
            </div>
            <Button
              type={server.isEnabled ? "default" : "primary"}
              size="small"
              loading={isLoading}
              onClick={() => handleToggleServer(server.id, !server.isEnabled)}
            >
              {server.isEnabled ? '禁用' : '启用'}
            </Button>
          </Space>
          
          <Row gutter={16}>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>工具数量</Text>
              <div>
                <Badge
                  count={server.toolCount || 0}
                  showZero
                  style={{ backgroundColor: server.toolCount ? '#52c41a' : '#d9d9d9' }}
                />
              </div>
            </Col>
            {server.runtime?.startTime && (
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>运行时长</Text>
                <div>
                  <Text style={{ fontSize: 12 }}>
                    {formatDuration(new Date().getTime() - new Date(server.runtime.startTime).getTime())}
                  </Text>
                </div>
              </Col>
            )}
            {server.runtime?.errorCount !== undefined && server.runtime.errorCount > 0 && (
              <Col span={8}>
                <Tooltip title={server.runtime.lastError?.message}>
                  <Text type="danger" style={{ fontSize: 12 }}>
                    <WarningOutlined /> {server.runtime.errorCount} 个错误
                  </Text>
                </Tooltip>
              </Col>
            )}
          </Row>
          
          {server.tags && server.tags.length > 0 && (
            <Space size={4} wrap>
              {server.tags.map(tag => (
                <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>
              ))}
            </Space>
          )}
        </Space>
      </Card>
    );
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return `${seconds}秒`;
    }
  };

  const filteredServers = filterServers(servers);
  const collectionGroups = groupByCollection(filteredServers);

  return (
    <div style={{ padding: '24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Space>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item key="system" onClick={() => handleAddServer('system')}>
                    <AppstoreOutlined /> 添加系统插件
                  </Menu.Item>
                  <Menu.Item key="project" onClick={() => handleAddServer('project')}>
                    <ProjectOutlined /> 添加项目插件
                  </Menu.Item>
                  <Menu.Item key="user" onClick={() => handleAddServer('user')}>
                    <UserOutlined /> 添加用户插件
                  </Menu.Item>
                </Menu>
              }
            >
              <Button icon={<PlusOutlined />} type="primary">
                添加插件 <DownOutlined />
              </Button>
            </Dropdown>
            <Button icon={<ImportOutlined />} onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleImportConfigs(file);
              };
              input.click();
            }}>
              导入
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExportConfigs}>
              导出
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadServers}>
              刷新
            </Button>
          </Space>
        }
        items={[
          {
            key: 'installed',
            label: (
              <Space>
                <CloudServerOutlined />
                已安装插件
                <Badge count={servers.length} />
              </Space>
            ),
            children: (
              <Spin spinning={loading}>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {/* 搜索和过滤栏 */}
                  <Card size="small">
                    <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                      <Search
                        placeholder="搜索插件名称、描述或标签"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                        prefix={<SearchOutlined />}
                        allowClear
                      />
                      <Select
                        mode="multiple"
                        placeholder="按标签过滤"
                        value={selectedTags}
                        onChange={setSelectedTags}
                        style={{ minWidth: 200 }}
                        options={getAllTags().map(tag => ({ label: tag, value: tag }))}
                        allowClear
                      />
                    </Space>
                  </Card>

                  {/* 按Collection分组显示 */}
                  {collectionGroups.length > 0 ? (
                    <Collapse
                      activeKey={expandedCollections}
                      onChange={keys => setExpandedCollections(keys as string[])}
                    >
                      {collectionGroups.map(group => (
                        <Panel
                          key={group.collection}
                          header={
                            <Space>
                              {getCollectionIcon(group.collection)}
                              <Text strong>
                                {getCollectionDisplayName(group.collection)}
                              </Text>
                              <Badge count={group.servers.length} />
                              {group.activeCount > 0 && (
                                <Tag color="success">{group.activeCount} 运行中</Tag>
                              )}
                              {group.totalTools > 0 && (
                                <Tag color="blue">{group.totalTools} 个工具</Tag>
                              )}
                            </Space>
                          }
                        >
                          {group.servers.map(server => renderServerCard(server))}
                        </Panel>
                      ))}
                    </Collapse>
                  ) : (
                    <Empty
                      description={searchText || selectedTags.length ? '没有匹配的插件' : '还没有安装任何插件'}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      {!searchText && !selectedTags.length && (
                        <Button type="primary" onClick={() => handleAddServer()}>
                          添加第一个插件
                        </Button>
                      )}
                    </Empty>
                  )}
                </Space>
              </Spin>
            )
          },
          {
            key: 'marketplace',
            label: (
              <Space>
                <ShopOutlined />
                插件市场
              </Space>
            ),
            children: (
              <MCPMarketplace 
                onServerInstalled={() => {
                  loadServers();
                  setActiveTab('installed');
                }} 
              />
            )
          }
        ]}
      />

      <MCPServerConfig
        visible={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onSave={handleSaveServer}
        editingServer={editingServer}
      />
    </div>
  );
};

export default MCPManagementV2;