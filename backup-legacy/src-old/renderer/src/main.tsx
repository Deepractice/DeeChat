import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { store } from './store'
import App from './App'
import './index.css'

// 创建一个包装组件来处理主题
const ThemedApp = () => {
  const { theme: appTheme } = store.getState().config.config.ui
  
  return (
    <ConfigProvider 
      locale={zhCN}
      theme={{
        algorithm: appTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> // 暂时禁用以测试消息重复问题
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  // </React.StrictMode>,
)
