/**
 * MCP管理页面
 * 管理MCP服务器和工具
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Space,
  Tag,
  Popconfirm,
  App,
  Tabs,
  Badge,
  Tooltip,
  Upload,
  Modal,
  Typography
} from 'antd';

const { Text } = Typography;
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  SettingOutlined,
  ToolOutlined,
  CloudServerOutlined,
  ShopOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import MCPServerConfig from '../components/MCPServerConfig';
import MCPToolPanel from '../components/MCPToolPanel';
import MCPServerPanel from '../components/MCPServerPanel';
import MCPMarketplace from '../components/MCPMarketplace';

// const { TabPane } = Tabs; // 已废弃，使用items语法

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  type: 'stdio' | 'sse';
  isEnabled: boolean;
  status?: 'connected' | 'disconnected' | 'error';
  toolCount?: number;
  lastConnected?: string;
  createdAt: string;
  updatedAt: string;

  // Stdio配置
  command?: string;
  args?: string[];
  env?: Record<string, string>;

  // SSE配置
  url?: string;
  headers?: Record<string, string>;

  // 通用配置
  timeout?: number;
  retryCount?: number;
}

interface MCPTool {
  name: string;
  description?: string;
  serverId: string;
  serverName: string;
  category?: string;
  tags?: string[];
  isAvailable: boolean;
  usageCount: number;
}

const MCPManagement: React.FC = () => {
  const { message } = App.useApp();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<Set<string>>(new Set());
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | undefined>();
  const [activeTab, setActiveTab] = useState('servers');
  const [removingServers, setRemovingServers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadServers();
    loadTools();

    // 延迟重新加载工具，等待PromptX初始化完成
    const retryLoadTools = () => {
      setTimeout(() => {
        console.log('🔄 [前端] 延迟重新加载工具列表（等待PromptX初始化）');
        loadTools();
      }, 3000); // 3秒后重试

      // 再次重试，确保获取到工具
      setTimeout(() => {
        console.log('🔄 [前端] 第二次延迟重新加载工具列表');
        loadTools();
      }, 6000); // 6秒后再次重试
    };

    retryLoadTools();
  }, []);

  const loadServers = async () => {
    setLoading(true);
    try {
      const response = await window.electronAPI.mcp.getAllServers();
      if (response.success) {
        console.log('🔍 [前端Debug] 接收到的服务器数据:', JSON.stringify(response.data, null, 2));
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

  const loadTools = async () => {
    console.log('🔄 [前端] 开始加载工具列表');
    setToolsLoading(true);
    try {
      const response = await window.electronAPI.mcp.getAllTools();
      console.log('📡 [前端] 工具列表响应:', response);
      if (response.success) {
        console.log(`✅ [前端] 成功获取 ${response.data.length} 个工具`);
        setTools(response.data);
      } else {
        console.error('❌ [前端] 获取工具列表失败:', response.error);
        message.error(`获取工具列表失败: ${response.error}`);
      }
    } catch (error) {
      console.error('❌ [前端] 获取工具列表异常:', error);
      message.error('获取工具列表失败');
    } finally {
      setToolsLoading(false);
    }
  };

  const handleAddServer = () => {
    setEditingServer(undefined);
    setConfigModalVisible(true);
  };

  const handleEditServer = (server: MCPServer) => {
    console.log('🔧 [前端] 编辑服务器配置:', server);
    setEditingServer(server);
    setConfigModalVisible(true);
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    // 防止重复点击
    if (toggleLoading.has(serverId)) {
      console.log('🔄 [前端] 服务器正在切换状态中，忽略重复请求:', serverId);
      return;
    }

    try {
      // 添加到loading状态
      setToggleLoading(prev => new Set(prev).add(serverId));
      console.log(`🔄 [前端] 开始${enabled ? '启用' : '禁用'}服务器:`, serverId);

      const response = await window.electronAPI.mcp.updateServerConfig(serverId, { isEnabled: enabled });
      if (response.success) {
        message.success(`插件已${enabled ? '启用' : '禁用'}`);
        console.log(`✅ [前端] 服务器${enabled ? '启用' : '禁用'}成功:`, serverId);
        loadServers(); // 重新加载服务器列表
        loadTools(); // 重新加载工具列表
      } else {
        message.error(`操作失败: ${response.error}`);
        console.error('❌ [前端] 服务器状态切换失败:', response.error);
      }
    } catch (error) {
      console.error('切换插件状态失败:', error);
      message.error('操作失败，请重试');
    } finally {
      // 移除loading状态
      setToggleLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
      console.log(`🏁 [前端] 服务器状态切换完成:`, serverId);
    }
  };


  const handleSaveServer = async (config: any) => {
    console.log('🔧 [前端Debug] 开始保存服务器配置:', config);
    console.log('🔧 [前端Debug] 编辑模式:', !!editingServer);
    
    try {
      let response;
      if (editingServer) {
        console.log('🔧 [前端Debug] 更新现有服务器:', editingServer.id);
        response = await window.electronAPI.mcp.updateServerConfig(editingServer.id, config);
      } else {
        console.log('🔧 [前端Debug] 添加新服务器');
        response = await window.electronAPI.mcp.addServer(config);
      }

      console.log('🔧 [前端Debug] 服务器响应:', response);

      if (response && response.success) {
        console.log('✅ [前端Debug] 保存成功，关闭模态框');
        message.success(editingServer ? '服务器配置更新成功' : '服务器配置保存成功');
        setConfigModalVisible(false);
        console.log('🔄 [前端Debug] 重新加载服务器列表');
        loadServers();
        loadTools(); // 重新加载工具列表
      } else {
        console.error('❌ [前端Debug] 保存失败:', response?.error);
        message.error(`保存服务器失败: ${response?.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('❌ [前端Debug] 保存异常:', error);
      message.error(`保存服务器失败: ${error instanceof Error ? error.message : '未知异常'}`);
    }
  };

  const handleTestConnection = async (serverId: string) => {
    try {
      const response = await window.electronAPI.mcp.testServerConnection(serverId);
      if (response.success) {
        if (response.data.isConnected) {
          message.success('连接测试成功');
        } else {
          message.error('连接测试失败');
        }
      } else {
        message.error(`连接测试失败: ${response.error}`);
      }
    } catch (error) {
      message.error('连接测试失败');
    }
  };

  const handleDiscoverTools = async (serverId: string) => {
    try {
      const response = await window.electronAPI.mcp.discoverServerTools(serverId);
      if (response.success) {
        message.success(`发现 ${response.data.length} 个工具`);
        loadTools(); // 重新加载工具列表
      } else {
        message.error(`工具发现失败: ${response.error}`);
      }
    } catch (error) {
      message.error('工具发现失败');
    }
  };

  const handleCallTool = async (serverId: string, toolName: string, args: any) => {
    try {
      const response = await window.electronAPI.mcp.callTool({
        serverId,
        toolName,
        arguments: args,
        callId: Date.now().toString()
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const handleRemoveServer = async (serverId: string) => {
    console.log('🗑️ [MCPManagement] handleRemoveServer 被调用:', serverId);
    
    // 防止重复调用
    if (removingServers.has(serverId)) {
      console.log('⚠️ [MCPManagement] 服务器正在删除中，忽略重复调用');
      return;
    }
    
    try {
      // 添加到删除中状态
      setRemovingServers(prev => new Set(prev).add(serverId));
      
      const response = await window.electronAPI.mcp.removeServer(serverId);
      if (response.success) {
        console.log('✅ [MCPManagement] 删除成功，显示成功消息');
        message.success('插件删除成功');
        loadServers();
        loadTools();
      } else {
        throw new Error(response.error || '删除失败');
      }
    } catch (error) {
      throw error;
    } finally {
      // 移除删除中状态
      setRemovingServers(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  };

  const handleExportConfig = async () => {
    try {
      const response = await window.electronAPI.mcp.exportConfigs();
      if (response.success) {
        // 创建下载链接
        const blob = new Blob([response.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mcp-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        message.success('配置导出成功');
      } else {
        message.error(`配置导出失败: ${response.error}`);
      }
    } catch (error) {
      message.error('配置导出失败');
    }
  };

  const handleImportConfig = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const configData = e.target?.result as string;
        const response = await window.electronAPI.mcp.importConfigs(configData);
        if (response.success) {
          message.success(`配置导入成功，导入 ${response.data.importedCount} 个服务器`);
          loadServers();
          loadTools();
        } else {
          message.error(`配置导入失败: ${response.error}`);
        }
      } catch (error) {
        message.error('配置导入失败');
      }
    };
    reader.readAsText(file);
    return false; // 阻止默认上传行为
  };

  const serverColumns: ColumnsType<MCPServer> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <CloudServerOutlined />
          <span>{text}</span>
          {record.type === 'stdio' ? (
            <Tag color="blue">Stdio</Tag>
          ) : (
            <Tag color="green">SSE</Tag>
          )}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        <Space>
          <Badge
            status={record.isEnabled ? 'success' : 'default'}
            text={record.isEnabled ? '启用' : '禁用'}
          />
          {record.toolCount !== undefined && (
            <Tag color="cyan">{record.toolCount} 个工具</Tag>
          )}
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleTestConnection(record.id)}
            />
          </Tooltip>
          <Tooltip title="发现工具">
            <Button
              type="text"
              icon={<ToolOutlined />}
              onClick={() => handleDiscoverTools(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditServer(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个服务器吗？"
            onConfirm={() => handleRemoveServer(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={handleAddServer}
              type="primary"
              size="small"
            >
              添加插件
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadServers();
                loadTools();
              }}
              size="small"
            >
              刷新
            </Button>
          </Space>
        }
        items={[
          {
            key: 'servers',
            label: (
              <Space>
                <CloudServerOutlined />
                已安装插件
              </Space>
            ),
            children: (
              <MCPServerPanel
                servers={servers.map(server => {
                  const serverTools = tools.filter(tool => tool.serverId === server.id);
                  return {
                    ...server,
                    command: server.command || '',
                    args: server.args || [],
                    env: server.env || {},
                    toolCount: serverTools.length,
                    tools: serverTools, // 添加工具列表
                    status: serverTools.length > 0 ? 'connected' : 'disconnected',
                    toggleLoading: toggleLoading.has(server.id) // 添加loading状态
                  };
                })}
                loading={loading}
                onRefresh={loadServers}
                onRemoveServer={handleRemoveServer}
                onAddServer={handleAddServer}
                onEditServer={handleEditServer}
                onToggleServer={handleToggleServer}
              />
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
            children: <MCPMarketplace onServerInstalled={() => {
              loadServers();
              loadTools();
            }} />
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

export default MCPManagement;
