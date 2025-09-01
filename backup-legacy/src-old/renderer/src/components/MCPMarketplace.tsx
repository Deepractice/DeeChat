import React, { useState, useEffect } from 'react';
import {
  Input,
  Segmented,
  Avatar,
  Button,
  Tag,
  Card,
  Row,
  Col,
  message,
  Space,

  Tooltip,
  Empty,
  Modal,
  Form
} from 'antd';
import {
  PlusOutlined,
  LoadingOutlined,

  StarOutlined,
  CheckOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { MCPTemplates, MCPTemplate, MCPCategories, SetupPrompt } from '../../../shared/data/mcpTemplates';

const { Search } = Input;

interface MCPMarketplaceProps {
  className?: string;
  onServerInstalled?: () => void; // 服务器安装成功后的回调
}

const MCPMarketplace: React.FC<MCPMarketplaceProps> = ({ className, onServerInstalled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [installing, setInstalling] = useState<string[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // 配置对话框状态
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<MCPTemplate | null>(null);
  const [setupForm] = Form.useForm();

  // 组件挂载时加载已安装的服务器
  useEffect(() => {
    loadInstalledServers();
  }, []);

  const loadInstalledServers = async () => {
    setLoading(true);
    try {
      if (window.electronAPI?.mcp?.getAllServers) {
        const response = await window.electronAPI.mcp.getAllServers();
        if (response.success && Array.isArray(response.data)) {
          const installedIds = response.data.map((server: any) => server.id || server.name);
          setInstalled(installedIds);
        }
      }
    } catch (error) {
      console.error('加载已安装服务器失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 过滤模板（排除内置插件）
  const filteredTemplates = MCPTemplates.filter(template => {
    // 排除内置插件（PromptX）
    if (template.id === 'promptx' || template.tags.includes('内置')) {
      return false;
    }

    const matchesSearch = searchTerm === '' ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === '全部' || template.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // 获取分类选项
  const categoryOptions = ['全部', ...MCPCategories];

  // 处理安装MCP服务器
  const handleInstallMCP = async (template: MCPTemplate) => {
    if (installing.includes(template.id) || installed.includes(template.id)) {
      return;
    }

    // 如果需要额外设置，先弹出配置对话框
    if (template.autoConfig.requiresSetup && template.autoConfig.setupPrompts) {
      setCurrentTemplate(template);
      setSetupModalVisible(true);
      return;
    }

    // 直接安装（无需额外配置）
    await performInstall(template, {});
  };

  // 执行实际的安装操作
  const performInstall = async (template: MCPTemplate, setupValues: Record<string, any>) => {
    setInstalling(prev => [...prev, template.id]);

    try {
      // 处理设置值，应用到args和env中
      let processedArgs = [...template.autoConfig.args];
      let processedEnv = { ...template.autoConfig.env };

      if (template.autoConfig.setupPrompts) {
        template.autoConfig.setupPrompts.forEach((prompt: SetupPrompt) => {
          const value = setupValues[prompt.field];
          if (value) {
            if (prompt.field === 'rootPath') {
              // 特殊处理rootPath：替换args中的路径
              processedArgs = processedArgs.map(arg => arg === '/' ? value : arg);
            } else {
              // 其他字段作为环境变量
              processedEnv[prompt.field] = value;
            }
          }
        });
      }

      // 构建服务器配置
      const serverConfig = {
        id: template.id,
        name: template.name,
        description: template.description,
        command: template.autoConfig.command,
        args: processedArgs,
        transport: {
          type: template.autoConfig.transport
        },
        env: processedEnv,
        enabled: true,
        autoStart: true
      };

      // 调用后端添加服务器
      if (window.electronAPI?.mcp?.addServer) {
        const response = await window.electronAPI.mcp.addServer(serverConfig);
        
        if (response.success) {
          console.log(`✅ [市场] ${template.name} 安装成功，服务器ID:`, response.data?.id);
          setInstalled(prev => [...prev, template.id]);
          message.success(`${template.name} 安装成功！`);

          // 尝试连接和发现工具
          try {
            console.log(`🔌 [市场] 测试连接: ${template.id}`);
            await window.electronAPI.mcp.testServerConnection(template.id);
            console.log(`🔍 [市场] 发现工具: ${template.id}`);
            const toolsResponse = await window.electronAPI.mcp.discoverServerTools(template.id);
            console.log(`📦 [市场] 发现工具结果:`, toolsResponse);

            // 通知父组件刷新工具列表
            console.log('🔄 [市场] 通知父组件刷新');
            if (onServerInstalled) {
              onServerInstalled();
            }
          } catch (connectionError) {
            console.warn('⚠️ [市场] 连接或发现工具失败:', connectionError);
            // 即使连接失败也要刷新列表
            console.log('🔄 [市场] 连接失败但仍然刷新');
            if (onServerInstalled) {
              onServerInstalled();
            }
          }
        } else {
          throw new Error(response.error || '安装失败');
        }
      } else {
        throw new Error('MCP API不可用');
      }
    } catch (error) {
      console.error('安装MCP服务器失败:', error);
      message.error(`安装 ${template.name} 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setInstalling(prev => prev.filter(id => id !== template.id));
    }
  };

  // 处理配置对话框确认
  const handleSetupConfirm = async () => {
    if (!currentTemplate) return;

    try {
      const values = await setupForm.validateFields();
      setSetupModalVisible(false);
      setupForm.resetFields();

      // 执行安装
      await performInstall(currentTemplate, values);
    } catch (error) {
      console.error('配置验证失败:', error);
    }
  };

  // 处理配置对话框取消
  const handleSetupCancel = () => {
    setSetupModalVisible(false);
    setupForm.resetFields();
    setCurrentTemplate(null);

    // 移除安装状态
    if (currentTemplate) {
      setInstalling(prev => prev.filter(id => id !== currentTemplate.id));
    }
  };

  // 渲染配置表单字段
  const renderSetupField = (prompt: SetupPrompt) => {
    const commonProps = {
      name: prompt.field,
      label: prompt.label,
      rules: [
        { required: prompt.required, message: `请输入${prompt.label}` }
      ]
    };

    switch (prompt.type) {
      case 'path':
        return (
          <Form.Item {...commonProps}>
            <Input
              placeholder={prompt.placeholder || `请输入${prompt.label}`}
            />
          </Form.Item>
        );
      case 'password':
        return (
          <Form.Item {...commonProps}>
            <Input.Password
              placeholder={prompt.placeholder || `请输入${prompt.label}`}
            />
          </Form.Item>
        );
      case 'text':
      default:
        return (
          <Form.Item {...commonProps}>
            <Input
              placeholder={prompt.placeholder || `请输入${prompt.label}`}
            />
          </Form.Item>
        );
    }
  };

  // 获取服务器状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'local': return '#52c41a';
      case 'remote': return '#1890ff';
      default: return '#d9d9d9';
    }
  };

  // 获取头像背景色
  const getAvatarColor = (name: string) => {
    const colors = ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1', '#667eea', '#9f7aea'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className={`mcp-marketplace ${className || ''}`}>
      {/* 搜索和筛选区域 */}
      <div style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Search
            placeholder="搜索插件..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: 400 }}
            allowClear
          />
          
          <Segmented
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categoryOptions}
            style={{ backgroundColor: '#f5f5f5' }}
          />
        </Space>
      </div>

      {/* 服务器列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <LoadingOutlined style={{ fontSize: 24 }} />
          <div style={{ marginTop: 8 }}>加载中...</div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Empty
          description="没有找到匹配的插件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredTemplates.map(template => (
            <Col xs={24} sm={12} lg={8} xl={6} key={template.id}>
              <Card
                hoverable
                size="small"
                style={{ height: '100%' }}
                styles={{ body: { padding: 16 } }}
                actions={[
                  <Button
                    key="install"
                    type={installed.includes(template.id) ? "default" : "primary"}
                    icon={
                      installing.includes(template.id) ? <LoadingOutlined /> :
                      installed.includes(template.id) ? <CheckOutlined /> : <PlusOutlined />
                    }
                    loading={installing.includes(template.id)}
                    disabled={installing.includes(template.id) || installed.includes(template.id)}
                    onClick={() => handleInstallMCP(template)}
                    style={{ border: 'none' }}
                  >
                    {installed.includes(template.id) ? '已安装' : 
                     installing.includes(template.id) ? '安装中' : '添加'}
                  </Button>
                ]}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <Avatar
                    size={40}
                    style={{ 
                      backgroundColor: getAvatarColor(template.name),
                      flexShrink: 0,
                      fontWeight: 'bold'
                    }}
                  >
                    {template.icon}
                  </Avatar>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      marginBottom: 4 
                    }}>
                      <span style={{ 
                        fontWeight: 500, 
                        fontSize: 14,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {template.name}
                      </span>
                      
                      {template.popularity >= 8 && (
                        <Tooltip title="热门">
                          <StarOutlined style={{ color: '#faad14', fontSize: 12 }} />
                        </Tooltip>
                      )}
                    </div>
                    
                    <div style={{ marginBottom: 8 }}>
                      <Tag 
                        color={getStatusColor(template.status)}
                        style={{ fontSize: '12px' }}
                      >
                        {template.status === 'local' ? 'Local' : 'Remote'}
                      </Tag>
                    </div>
                    
                    <div style={{ 
                      fontSize: 12, 
                      color: '#666',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {template.description}
                    </div>
                    
                    <div style={{ marginTop: 8 }}>
                      {template.tags.slice(0, 2).map(tag => (
                        <Tag key={tag} style={{ fontSize: 10, margin: '2px 4px 2px 0' }}>
                          {tag}
                        </Tag>
                      ))}
                      {template.tags.length > 2 && (
                        <Tag style={{ fontSize: 10, margin: '2px 0' }}>
                          +{template.tags.length - 2}
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 统计信息 */}
      <div style={{
        marginTop: 24,
        textAlign: 'center',
        color: '#999',
        fontSize: 12
      }}>
        共 {filteredTemplates.length} 个服务器 · 已安装 {installed.length} 个
      </div>

      {/* 配置对话框 */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            配置 {currentTemplate?.name}
          </Space>
        }
        open={setupModalVisible}
        onOk={handleSetupConfirm}
        onCancel={handleSetupCancel}
        width={600}
        okText="确认安装"
        cancelText="取消"
      >
        {currentTemplate && (
          <div>
            <div style={{ marginBottom: 16, color: '#666' }}>
              {currentTemplate.description}
            </div>

            <Form
              form={setupForm}
              layout="vertical"
              initialValues={
                currentTemplate.autoConfig.setupPrompts?.reduce((acc, prompt) => {
                  if (prompt.defaultValue) {
                    acc[prompt.field] = prompt.defaultValue;
                  }
                  return acc;
                }, {} as Record<string, any>) || {}
              }
            >
              {currentTemplate.autoConfig.setupPrompts?.map((prompt, index) => (
                <div key={prompt.field}>
                  {renderSetupField(prompt)}
                </div>
              ))}
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MCPMarketplace;