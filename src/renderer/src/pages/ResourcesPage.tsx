import React, { useState, useEffect } from 'react'
import { 
  Layout, 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Tabs, 
  Table, 
  Tag, 
  Space,
  Button,
  Input,
  Empty,
  Spin,
  Typography,
  App,
  Tree
} from 'antd'
import { 
  FileOutlined, 
  FolderOutlined, 
  DatabaseOutlined,
  CloudDownloadOutlined,
  SearchOutlined,
  RobotOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  DownOutlined,
  TeamOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Content } = Layout
const { Title, Text } = Typography
const { Search } = Input

// 文件类型定义
interface BaseFileMetadata {
  id: string
  name: string
  path: string
  size: number
  type: string
  category: 'chat' | 'promptx' | 'knowledge'
  createdAt: string
  updatedAt: string
  tags?: string[]
  description?: string
}

interface PromptXResource extends BaseFileMetadata {
  category: 'promptx'
  protocol: 'role' | 'thought' | 'execution' | 'tool'
  source: 'system' | 'project' | 'user'
  reference: string
  folderPath: string[] // 文件夹路径数组
  parentFolder?: string // 直接父文件夹
  depth: number // 层级深度
  isLeaf: boolean // 是否是叶子节点
}

interface TreeNode {
  key: string
  title: string
  isLeaf: boolean
  children?: TreeNode[]
  type: 'folder' | 'file'
  protocol?: string
  size?: number
  createdAt?: string
  description?: string
  fileData?: PromptXResource
}

interface FileStats {
  totalFiles: number
  totalSize: number
  byCategory: Record<string, number>
  byType: Record<string, number>
}

interface RoleCard {
  id: string
  name: string
  description?: string
  thoughtCount: number
  executionCount: number
  totalFiles: number
  path: string
}

interface ToolCard {
  id: string
  name: string
  description?: string
  hasManual: boolean
  hasTool: boolean
  totalFiles: number
  path: string
}

const ResourcesPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<BaseFileMetadata[]>([])
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [roleCards, setRoleCards] = useState<RoleCard[]>([])
  const [toolCards, setToolCards] = useState<ToolCard[]>([])
  const [stats, setStats] = useState<FileStats | null>(null)
  const [activeTab, setActiveTab] = useState('roles')
  const [searchText, setSearchText] = useState('')
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [loadingContent, setLoadingContent] = useState(false)
  const [currentRole, setCurrentRole] = useState<string | null>(null) // 当前查看的角色
  const [roleTreeData, setRoleTreeData] = useState<TreeNode[]>([]) // 单角色的树形数据
  const { message } = App.useApp()

  // 加载文件列表
  const loadFiles = async () => {
    setLoading(true)
    try {
      // 检查 API 是否可用
      if (!window.electronAPI?.file?.list) {
        console.error('File API not available')
        message.error('文件管理服务未就绪，请重启应用')
        return
      }
      // 只加载promptx资源
      const fileList = await window.electronAPI.file.list({ category: 'promptx' })
      setFiles(fileList)
    } catch (error) {
      message.error('加载文件失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 加载树形数据
  const loadTreeData = async () => {
    try {
      // 检查 API 是否可用
      if (!window.electronAPI?.file?.tree) {
        console.error('File tree API not available')
        return
      }
      const treeNodes = await window.electronAPI.file.tree('promptx')
      setTreeData(treeNodes)
    } catch (error) {
      console.error('加载树形数据失败:', error)
    }
  }

  // 构建角色卡片数据
  const buildRoleCards = (fileList: BaseFileMetadata[]) => {
    const promptxFiles = fileList.filter(f => f.category === 'promptx') as PromptXResource[]
    const roleMap = new Map<string, RoleCard>()

    // 扫描role文件夹下的所有文件，按直接子目录分组
    promptxFiles.forEach(file => {
      if (file.folderPath.length >= 2 && file.folderPath[0] === 'role') {
        const roleId = file.folderPath[1] // role文件夹下的直接子目录名
        
        if (!roleMap.has(roleId)) {
          // 创建角色卡片，使用roleId作为显示名称
          roleMap.set(roleId, {
            id: roleId,
            name: roleId.split('-').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' '), // 将kebab-case转换为Title Case
            description: `角色: ${roleId}`,
            thoughtCount: 0,
            executionCount: 0,
            totalFiles: 0,
            path: `role/${roleId}`
          })
        }

        // 统计该角色下的文件数量和类型
        const roleCard = roleMap.get(roleId)!
        roleCard.totalFiles++
        
        // 根据协议类型统计
        if (file.protocol === 'thought') {
          roleCard.thoughtCount++
        } else if (file.protocol === 'execution') {
          roleCard.executionCount++
        }
      }
    })

    return Array.from(roleMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  // 构建工具卡片数据
  const buildToolCards = (fileList: BaseFileMetadata[]) => {
    const promptxFiles = fileList.filter(f => f.category === 'promptx') as PromptXResource[]
    const toolMap = new Map<string, ToolCard>()

    // 扫描tool文件夹下的所有文件，按直接子目录分组
    promptxFiles.forEach(file => {
      if (file.folderPath.length >= 2 && file.folderPath[0] === 'tool') {
        const toolId = file.folderPath[1] // tool文件夹下的直接子目录名
        
        if (!toolMap.has(toolId)) {
          // 创建工具卡片，使用toolId作为显示名称
          toolMap.set(toolId, {
            id: toolId,
            name: toolId.split('-').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' '), // 将kebab-case转换为Title Case
            description: `工具: ${toolId}`,
            hasManual: false,
            hasTool: false,
            totalFiles: 0,
            path: `tool/${toolId}`
          })
        }

        // 统计该工具下的文件数量和类型
        const toolCard = toolMap.get(toolId)!
        toolCard.totalFiles++
        
        // 根据协议类型统计
        if (file.protocol === 'manual') {
          toolCard.hasManual = true
        } else if (file.protocol === 'tool') {
          toolCard.hasTool = true
        }
      }
    })

    return Array.from(toolMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  // 加载统计信息
  const loadStats = async () => {
    try {
      // 检查 API 是否可用
      if (!window.electronAPI?.file?.stats) {
        console.error('File stats API not available')
        return
      }
      const fileStats = await window.electronAPI.file.stats()
      setStats(fileStats)
    } catch (error) {
      console.error('加载统计信息失败:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await loadFiles()
        await loadTreeData()
        await loadStats()
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // 当files更新时，重新构建角色和工具卡片
  useEffect(() => {
    if (files.length > 0) {
      const roleCards = buildRoleCards(files)
      const toolCards = buildToolCards(files)
      setRoleCards(roleCards)
      setToolCards(toolCards)
    }
  }, [files])

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveTab(key)
    setCurrentRole(null) // 重置当前角色
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 获取图标
  const getIcon = (file: BaseFileMetadata) => {
    if (file.category === 'promptx') {
      const resource = file as PromptXResource
      switch (resource.protocol) {
        case 'role': return <RobotOutlined style={{ color: '#1890ff' }} />
        case 'thought': return <BulbOutlined style={{ color: '#52c41a' }} />
        case 'execution': return <ThunderboltOutlined style={{ color: '#fa8c16' }} />
        case 'tool': return <ToolOutlined style={{ color: '#722ed1' }} />
      }
    }
    return <FileOutlined />
  }

  // 获取树节点图标
  const getTreeIcon = (node: TreeNode) => {
    if (node.type === 'folder') {
      return <FolderOutlined style={{ color: '#faad14' }} />
    }
    
    switch (node.protocol) {
      case 'role': return <TeamOutlined style={{ color: '#1890ff' }} />
      case 'thought': return <BulbOutlined style={{ color: '#52c41a' }} />
      case 'execution': return <ThunderboltOutlined style={{ color: '#fa8c16' }} />
      case 'tool': return <ToolOutlined style={{ color: '#722ed1' }} />
      default: return <FileOutlined style={{ color: '#8c8c8c' }} />
    }
  }


  // 过滤文件
  const filteredFiles = files.filter(file => {
    const matchesSearch = searchText === '' || 
      file.name.toLowerCase().includes(searchText.toLowerCase()) ||
      file.description?.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'chat' && file.category === 'chat') ||
      (activeTab === 'promptx' && file.category === 'promptx') ||
      (activeTab === 'knowledge' && file.category === 'knowledge')
    
    return matchesSearch && matchesTab
  })

  // 表格列定义
  const columns: ColumnsType<BaseFileMetadata> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {getIcon(record)}
          <span>{text}</span>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type, record) => {
        if (record.category === 'promptx') {
          const resource = record as PromptXResource
          const colorMap = {
            role: 'blue',
            thought: 'green',
            execution: 'orange',
            tool: 'purple'
          }
          return <Tag color={colorMap[resource.protocol]}>{resource.protocol}</Tag>
        }
        return <Tag>{type}</Tag>
      },
      filters: [
        { text: '角色', value: 'role' },
        { text: '思维', value: 'thought' },
        { text: '执行', value: 'execution' },
        { text: '工具', value: 'tool' }
      ],
      onFilter: (value, record) => {
        if (record.category === 'promptx') {
          const resource = record as PromptXResource
          return resource.protocol === value
        }
        return false
      }
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category) => {
        const colorMap = {
          chat: 'blue',
          promptx: 'green',
          knowledge: 'orange'
        }
        const nameMap = {
          chat: '聊天',
          promptx: 'AI资源',
          knowledge: '知识库'
        }
        return <Tag color={colorMap[category]}>{nameMap[category]}</Tag>
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size) => formatFileSize(size),
      sorter: (a, b) => a.size - b.size
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            onClick={() => handleViewFile(record)}
          >
            查看
          </Button>
          <Button 
            size="small" 
            icon={<CloudDownloadOutlined />}
            onClick={() => handleExportFile(record)}
          >
            导出
          </Button>
        </Space>
      )
    }
  ]

  // 查看文件
  const handleViewFile = async (file: BaseFileMetadata) => {
    try {
      const content = await window.electronAPI.file.read(file.id)
      // TODO: 显示文件内容的弹窗
      message.info(`文件内容长度: ${content.length} 字符`)
    } catch (error) {
      message.error('读取文件失败')
    }
  }

  // 导出文件
  const handleExportFile = async (file: BaseFileMetadata) => {
    try {
      // TODO: 实现文件导出功能
      message.success('导出功能开发中...')
    } catch (error) {
      message.error('导出失败')
    }
  }

  // 进入角色详情
  const handleEnterRole = (roleId: string) => {
    setCurrentRole(roleId)
    // 构建该角色的树形数据
    const treeData = buildRoleTreeData(roleId)
    setRoleTreeData(treeData)
    // 重置文件选择状态
    setSelectedFile(null)
    setFileContent('')
  }

  // 进入工具详情
  const handleEnterTool = (toolId: string) => {
    // TODO: 实现工具详情页面
    message.info(`工具详情功能开发中：${toolId}`)
  }

  // 返回角色列表
  const handleBackToRoles = () => {
    setCurrentRole(null)
  }

  // 获取当前角色的文件
  const getCurrentRoleFiles = () => {
    if (!currentRole) return []
    return files.filter(file => {
      const promptxFile = file as PromptXResource
      return promptxFile.category === 'promptx' && 
             promptxFile.folderPath.length >= 2 && 
             promptxFile.folderPath[0] === 'role' && 
             promptxFile.folderPath[1] === currentRole
    })
  }

  // 构建单角色的树形数据
  const buildRoleTreeData = (roleId: string) => {
    // 直接基于roleId获取文件，而不依赖currentRole状态
    const roleFiles = files.filter(file => {
      const promptxFile = file as PromptXResource
      return promptxFile.category === 'promptx' && 
             promptxFile.folderPath.length >= 2 && 
             promptxFile.folderPath[0] === 'role' && 
             promptxFile.folderPath[1] === roleId
    })
    
    if (roleFiles.length === 0) return []

    // 构建该角色的文件夹结构
    const nodeMap = new Map<string, TreeNode>()
    const folderSet = new Set<string>()

    // 为每个文件创建树节点
    roleFiles.forEach(file => {
      const promptxFile = file as PromptXResource
      // 获取角色内部的相对路径 (去掉 role/roleId 前缀)
      const relativePath = promptxFile.folderPath.slice(2) // 去掉 ['role', 'roleId']
      
      // 创建文件夹节点
      for (let i = 0; i <= relativePath.length; i++) {
        const currentPath = relativePath.slice(0, i)
        const pathKey = currentPath.join('/')
        
        if (!folderSet.has(pathKey)) {
          folderSet.add(pathKey)
          
          const folderName = currentPath.length === 0 ? '根目录' : currentPath[currentPath.length - 1]
          const parentPath = currentPath.slice(0, -1).join('/')
          
          nodeMap.set(pathKey, {
            key: pathKey,
            title: folderName,
            isLeaf: false,
            children: [],
            type: 'folder',
            depth: currentPath.length,
            parentPath: currentPath.length > 0 ? parentPath : null
          })
        }
      }
      
      // 创建文件节点
      const fileKey = `file_${file.id}`
      const parentPath = relativePath.join('/')
      
      const fileNode: TreeNode = {
        key: fileKey,
        title: file.name,
        isLeaf: true,
        type: 'file',
        protocol: (file as PromptXResource).protocol,
        size: file.size,
        createdAt: file.createdAt,
        description: file.description,
        fileData: file
      }
      
      nodeMap.set(fileKey, fileNode)
      
      // 将文件添加到对应文件夹
      const parentNode = nodeMap.get(parentPath)
      if (parentNode) {
        parentNode.children!.push(fileNode)
      }
    })
    
    // 构建父子关系
    for (const [, node] of nodeMap.entries()) {
      if (node.type === 'folder' && node.parentPath !== null) {
        const parentNode = nodeMap.get(node.parentPath)
        if (parentNode) {
          parentNode.children!.push(node)
        }
      }
    }
    
    // 返回根节点的子节点
    const rootNode = nodeMap.get('')
    return rootNode ? rootNode.children || [] : []
  }

  // 处理文件选择
  const handleFileSelect = async (selectedKeys: React.Key[], info: any) => {
    if (info.node.type === 'file' && info.node.fileData) {
      const file = info.node.fileData as FileMetadata
      setSelectedFile(file)
      
      // 加载文件内容
      setLoadingContent(true)
      try {
        const content = await window.electronAPI.file.read(file.id)
        setFileContent(content)
      } catch (error) {
        message.error('读取文件失败')
        console.error(error)
      } finally {
        setLoadingContent(false)
      }
    }
  }

  return (
    <Layout style={{ height: '100%', backgroundColor: '#f0f2f5' }}>
      <Content style={{ padding: 24, overflow: 'auto' }}>


        {/* 主内容区 */}
        <Card>

          {/* 返回按钮和面包屑导航 */}
          {currentRole && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <Button 
                onClick={handleBackToRoles}
                icon={<ArrowLeftOutlined />}
              >
                返回
              </Button>
              <div>
                <Button 
                  type="link" 
                  onClick={handleBackToRoles}
                  style={{ paddingLeft: 0 }}
                >
                  角色列表
                </Button>
                <span style={{ margin: '0 8px', color: '#8c8c8c' }}>/</span>
                <span style={{ fontWeight: 500 }}>{currentRole}</span>
              </div>
            </div>
          )}


          {/* 标签页 */}
          <Tabs 
            activeKey={activeTab} 
            onChange={handleTabChange}
            items={[
              {
                key: 'roles',
                label: (
                  <span>
                    <RobotOutlined />
                    角色资源 ({roleCards.length})
                  </span>
                )
              },
              {
                key: 'tools',
                label: (
                  <span>
                    <ToolOutlined />
                    工具资源 ({toolCards.length})
                  </span>
                )
              }
            ]}
          />

          {/* 内容显示 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 50 }}>
              <Spin size="large" />
            </div>
          ) : currentRole ? (
            // 简洁的文件编辑器
            <div style={{ height: '70vh' }}>
              <Layout style={{ height: '100%', backgroundColor: '#fff' }}>
                {/* 左侧：简洁文件树 */}
                <Layout.Sider 
                  width={280} 
                  theme="light" 
                  style={{ 
                    borderRight: '1px solid #f0f0f0',
                    backgroundColor: '#fafafa'
                  }}
                >
                  <div style={{ padding: '16px 12px 8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                    <Text strong style={{ fontSize: '14px' }}>
                      {currentRole} 文件
                    </Text>
                  </div>
                  <div style={{ padding: '8px' }}>
                    {roleTreeData.length > 0 ? (
                      <Tree
                        treeData={roleTreeData.map(node => ({
                          ...node,
                          title: node.title,
                          children: node.children?.map(child => ({
                            ...child,
                            title: child.title
                          }))
                        }))}
                        showIcon={false}
                        showLine
                        defaultExpandAll
                        onSelect={handleFileSelect}
                        style={{ backgroundColor: 'transparent' }}
                        selectedKeys={selectedFile ? [`file_${selectedFile.id}`] : []}
                      />
                    ) : (
                      <Empty 
                        description="该角色暂无资源文件" 
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ marginTop: 40 }}
                      />
                    )}
                  </div>
                </Layout.Sider>
                
                {/* 右侧：文件编辑器 */}
                <Layout.Content style={{ padding: '16px' }}>
                  <Card 
                    title={
                      selectedFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 500 }}>{selectedFile.name}</span>
                          <Space>
                            <Button 
                              type="primary" 
                              size="small"
                              onClick={async () => {
                                if (!selectedFile) return
                                
                                try {
                                  // 检查 API 是否可用
                                  if (!window.electronAPI?.file?.updateContent) {
                                    message.error('文件更新服务未就绪')
                                    return
                                  }
                                  
                                  await window.electronAPI.file.updateContent(selectedFile.id, fileContent)
                                  message.success('文件保存成功')
                                } catch (error) {
                                  console.error('保存文件失败:', error)
                                  message.error(`保存失败: ${error.message}`)
                                }
                              }}
                            >
                              保存文件
                            </Button>
                            <Button 
                              size="small" 
                              onClick={() => {
                                // 重置为原始内容
                                if (selectedFile) {
                                  window.electronAPI.file.read(selectedFile.id).then(content => {
                                    setFileContent(content)
                                    message.info('已重置为原始内容')
                                  })
                                }
                              }}
                            >
                              重置内容
                            </Button>
                          </Space>
                        </div>
                      ) : (
                        "选择文件开始编辑"
                      )
                    }
                    size="small"
                    style={{ height: '100%' }}
                    styles={{ 
                      body: {
                        height: 'calc(100% - 57px)', 
                        padding: 0
                      }
                    }}
                  >
                    {loadingContent ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <Spin size="large" />
                      </div>
                    ) : selectedFile ? (
                      <Input.TextArea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        style={{
                          height: '100%',
                          border: 'none',
                          resize: 'none',
                          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          backgroundColor: '#fafafa'
                        }}
                        placeholder="在此编辑文件内容..."
                      />
                    ) : (
                      <Empty 
                        description="请从左侧选择要编辑的文件" 
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ marginTop: '20%' }}
                      />
                    )}
                  </Card>
                </Layout.Content>
              </Layout>
            </div>
          ) : activeTab === 'roles' ? (
              // 角色资源标签页
              roleCards.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {roleCards.map(role => (
                    <Col xs={24} sm={12} md={8} lg={6} key={role.id}>
                      <Card
                        hoverable
                        onClick={() => handleEnterRole(role.id)}
                        style={{ height: '100%' }}
                        cover={
                          <div style={{ 
                            height: 120, 
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <TeamOutlined style={{ fontSize: 48, color: 'white' }} />
                          </div>
                        }
                      >
                        <Card.Meta
                          title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{role.name}</span>
                              <Tag color="blue">角色</Tag>
                            </div>
                          }
                          description={
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {role.description || '专业角色，提供特定领域的专业能力'}
                              </Text>
                              <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                                <Space size={4}>
                                  <BulbOutlined style={{ color: '#52c41a' }} />
                                  <Text style={{ fontSize: 12 }}>{role.thoughtCount}</Text>
                                </Space>
                                <Space size={4}>
                                  <ThunderboltOutlined style={{ color: '#fa8c16' }} />
                                  <Text style={{ fontSize: 12 }}>{role.executionCount}</Text>
                                </Space>
                                <Space size={4}>
                                  <FileOutlined style={{ color: '#8c8c8c' }} />
                                  <Text style={{ fontSize: 12 }}>{role.totalFiles}</Text>
                                </Space>
                              </div>
                            </div>
                          }
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty description="暂无角色资源" />
              )
            ) : (
              // 工具资源标签页
              toolCards.length > 0 ? (
                <Row gutter={[16, 16]}>
                  {toolCards.map(tool => (
                    <Col xs={24} sm={12} md={8} lg={6} key={tool.id}>
                      <Card
                        hoverable
                        onClick={() => handleEnterTool(tool.id)}
                        style={{ height: '100%' }}
                        cover={
                          <div style={{ 
                            height: 120, 
                            background: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <ToolOutlined style={{ fontSize: 48, color: 'white' }} />
                          </div>
                        }
                      >
                        <Card.Meta
                          title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{tool.name}</span>
                              <Tag color="orange">工具</Tag>
                            </div>
                          }
                          description={
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {tool.description || '功能工具，提供特定的操作能力'}
                              </Text>
                              <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                                <Space size={4}>
                                  <FileOutlined style={{ color: '#1890ff' }} />
                                  <Text style={{ fontSize: 12 }}>
                                    {tool.hasManual ? 'Manual' : ''}
                                  </Text>
                                </Space>
                                <Space size={4}>
                                  <CloudDownloadOutlined style={{ color: '#52c41a' }} />
                                  <Text style={{ fontSize: 12 }}>
                                    {tool.hasTool ? 'Tool' : ''}
                                  </Text>
                                </Space>
                                <Space size={4}>
                                  <DatabaseOutlined style={{ color: '#8c8c8c' }} />
                                  <Text style={{ fontSize: 12 }}>{tool.totalFiles}</Text>
                                </Space>
                              </div>
                            </div>
                          }
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Empty description="暂无工具资源" />
              )
            )}
        </Card>
      </Content>
    </Layout>
  )
}

export default ResourcesPage