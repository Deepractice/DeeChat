import React from 'react'
import { Layout } from 'antd'
import GlobalHeader from './GlobalHeader'
import GlobalNavigation, { GlobalNavigationProps } from './GlobalNavigation'
import PageNavigation, { BreadcrumbItem } from './PageNavigation'

const { Content } = Layout

interface AppLayoutProps {
  children: React.ReactNode
  // 全局导航配置
  globalNavigation: GlobalNavigationProps
  // 全局顶栏配置（暂时保留用于兼容）
  globalHeader?: {
    show?: boolean
    title?: string
    onMenuClick?: () => void
    onSettingsClick?: () => void
  }
  // 页面导航配置（可选，用于向后兼容）
  navigation?: {
    breadcrumb: BreadcrumbItem[]
    title: string
    icon?: React.ReactNode
    actions?: React.ReactNode[]
    description?: string
  }
  // 布局样式
  contentStyle?: React.CSSProperties
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  globalNavigation,
  navigation,
  globalHeader = { show: false },
  contentStyle = {}
}) => {
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 全局导航栏 */}
      <GlobalNavigation {...globalNavigation} />

      {/* 向后兼容的页面导航栏（如果提供的话） */}
      {navigation && (
        <PageNavigation
          breadcrumb={navigation.breadcrumb}
          title={navigation.title}
          icon={navigation.icon}
          actions={navigation.actions}
          description={navigation.description}
        />
      )}

      {/* 内容区域 */}
      <Content style={{
        flex: 1,
        overflow: 'hidden',
        background: '#fff',
        ...contentStyle
      }}>
        {children}
      </Content>
    </Layout>
  )
}

export default AppLayout