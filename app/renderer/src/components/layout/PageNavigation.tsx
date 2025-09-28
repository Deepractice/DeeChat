import React from 'react'
import { Layout, Breadcrumb, Typography, Space } from 'antd'

const { Header } = Layout
const { Title } = Typography

export interface BreadcrumbItem {
  title: string
  icon?: React.ReactNode
  onClick?: () => void
}

interface PageNavigationProps {
  breadcrumb: BreadcrumbItem[]
  title: string
  icon?: React.ReactNode
  actions?: React.ReactNode[]
  description?: string
}

const PageNavigation: React.FC<PageNavigationProps> = ({
  breadcrumb,
  title,
  icon,
  actions = [],
  description
}) => {
  // 构建面包屑数据 - 简化版本，不显示首页
  const breadcrumbItems = breadcrumb.map(item => ({
    title: item.onClick ? (
      <span
        style={{ cursor: 'pointer', color: '#1890ff' }}
        onClick={item.onClick}
      >
        {item.icon && <span style={{ marginRight: 4 }}>{item.icon}</span>}
        {item.title}
      </span>
    ) : (
      <span>
        {item.icon && <span style={{ marginRight: 4 }}>{item.icon}</span>}
        {item.title}
      </span>
    )
  }))

  return (
    <Header style={{
      background: '#fff',
      padding: '8px 24px',
      borderBottom: '1px solid #f0f0f0',
      height: 'auto',
      minHeight: '56px'
    }}>
      {/* 面包屑导航 - 只在有内容时显示 */}
      {breadcrumbItems.length > 0 && (
        <Breadcrumb
          items={breadcrumbItems}
          style={{
            fontSize: '12px',
            marginBottom: '8px',
            color: '#6b7280'
          }}
        />
      )}

      {/* 页面标题和操作 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {icon && (
            <div style={{
              fontSize: '20px',
              color: '#1890ff',
              display: 'flex',
              alignItems: 'center'
            }}>
              {icon}
            </div>
          )}
          <div>
            <Title level={4} style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: '#1f2937'
            }}>
              {title}
            </Title>
            {description && (
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                marginTop: '2px'
              }}>
                {description}
              </div>
            )}
          </div>
        </div>

        {/* 页面操作按钮 */}
        {actions.length > 0 && (
          <Space size={8}>
            {actions}
          </Space>
        )}
      </div>
    </Header>
  )
}

export default PageNavigation