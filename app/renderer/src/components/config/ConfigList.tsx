/**
 * ConfigList - AI配置列表组件
 *
 * 职责: 纯展示组件,负责渲染配置列表和操作按钮
 */

import React from 'react'
import { Button, Table, Space, Badge, Popconfirm } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EditOutlined
} from '@ant-design/icons'
import type { AIConfig } from '../../hooks/useConfigPageLogic'

interface ConfigListProps {
  configs: AIConfig[]
  loading: boolean
  onRefresh: () => void
  onAdd: () => void
  onEdit: (config: AIConfig) => void
  onDelete: (nameOrId: string | number) => void
}

const ConfigList: React.FC<ConfigListProps> = ({
  configs,
  loading,
  onRefresh,
  onAdd,
  onEdit,
  onDelete
}) => {
  // 表格列定义
  const columns = [
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AIConfig) => (
        <Space size="small">
          <span style={{ fontWeight: 500, color: '#2c3e50' }}>{name}</span>
          {record.is_default && (
            <Badge status="success" text="默认" />
          )}
          {!record.is_active && (
            <Badge status="error" text="已禁用" />
          )}
        </Space>
      )
    },
    {
      title: 'API地址',
      dataIndex: 'base_url',
      key: 'base_url',
      render: (url: string) => (
        <code style={{
          fontSize: '12px',
          background: '#f8f9fa',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #e9ecef',
          color: '#495057'
        }}>
          {url}
        </code>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => {
        if (!text) return <span style={{ color: '#9ca3af' }}>-</span>
        return (
          <span style={{ color: '#6b7280' }}>
            {new Date(text).toLocaleString()}
          </span>
        )
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (record: AIConfig) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => onEdit(record)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 8px',
              color: '#1890ff'
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="删除配置"
            description="确定要删除这个配置吗？此操作无法撤销。"
            onConfirm={() => onDelete(record.name)}
            okText="删除"
            cancelText="取消"
            okType="danger"
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px'
              }}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e8e8e8'
    }}>
      {/* 操作栏 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>
          配置列表 ({configs.length} 项)
        </div>
        <Space size="small">
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
            style={{ borderRadius: '6px' }}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAdd}
            style={{
              background: '#1890ff',
              borderColor: '#1890ff',
              borderRadius: '6px'
            }}
          >
            新增配置
          </Button>
        </Space>
      </div>

      {/* 表格区域 */}
      <Table
        columns={columns}
        dataSource={configs}
        loading={loading}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          style: { padding: '16px 24px' }
        }}
        locale={{ emptyText: '暂无配置数据，点击"新增配置"开始添加' }}
        style={{ border: 'none' }}
      />
    </div>
  )
}

export default ConfigList