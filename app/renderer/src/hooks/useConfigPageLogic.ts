/**
 * ConfigPage 业务逻辑 Hook
 *
 * 职责:
 * 1. AI配置的增删改查
 * 2. 状态管理
 * 3. 表单控制
 * 4. API Key 可见性控制
 */

import { useState, useEffect, useCallback } from 'react'
import { message, Form } from 'antd'

export interface AIConfig {
  id: number
  name: string
  api_key: string
  base_url: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UseConfigPageLogicOptions {
  onConfigChange?: () => void
}

export const useConfigPageLogic = (options: UseConfigPageLogicOptions = {}) => {
  const { onConfigChange } = options

  // ==================== 状态管理 ====================
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null)
  const [showRealApiKey, setShowRealApiKey] = useState(false)
  const [form] = Form.useForm()

  // ==================== 加载配置 ====================
  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      console.log('🔄 请求获取配置列表...')
      const result = await window.electronAPI.aiConfig.getAll()
      console.log('📥 后端响应:', result)

      if (result.success) {
        setConfigs(result.data || [])
      } else {
        message.error('获取配置失败: ' + result.error)
      }
    } catch (error) {
      console.error('获取配置异常:', error)
      message.error('获取配置异常: ' + error)
    }
    setLoading(false)
  }, [])

  // ==================== 创建配置 ====================
  const createConfig = useCallback(async (values: any) => {
    try {
      console.log('📤 发送创建配置请求:', values)

      const input = {
        name: values.name,
        api_key: values.api_key,
        base_url: values.base_url || 'https://api.openai.com/v1',
        is_default: values.is_default || false,
        is_active: true
      }

      const result = await window.electronAPI.aiConfig.create(input)
      console.log('📥 创建响应:', result)

      if (result.success) {
        message.success('✅ 配置创建成功！')
        setModalVisible(false)
        form.resetFields()
        loadConfigs() // 重新加载列表
        onConfigChange?.() // 通知父组件配置变化
      } else {
        message.error('❌ 创建失败: ' + result.error)
      }
    } catch (error) {
      console.error('创建配置异常:', error)
      message.error('❌ 创建异常: ' + error)
    }
  }, [form, loadConfigs, onConfigChange])

  // ==================== 更新配置 ====================
  const updateConfig = useCallback(async (values: any) => {
    if (!editingConfig) return

    try {
      console.log('📤 发送更新配置请求:', values)

      // 只包含实际变更的字段
      const input: any = {}
      if (values.name !== editingConfig.name) input.name = values.name

      // API Key 逻辑：
      // 1. 如果是掩码，说明用户没有修改，不更新
      // 2. 如果不是掩码但与原始值相同，说明用户只是查看了，不更新
      // 3. 只有当不是掩码且与原始值不同时才更新
      if (values.api_key &&
          values.api_key !== '••••••••••••••••' &&
          values.api_key.trim() &&
          values.api_key !== editingConfig.api_key) {
        input.api_key = values.api_key
      }

      if (values.base_url !== editingConfig.base_url) input.base_url = values.base_url

      const result = await window.electronAPI.aiConfig.update(editingConfig.id, input)
      console.log('📥 更新响应:', result)

      if (result.success) {
        message.success('✅ 配置更新成功！')
        setModalVisible(false)
        setEditingConfig(null)
        setShowRealApiKey(false)
        form.resetFields()
        loadConfigs() // 重新加载列表
        onConfigChange?.() // 通知父组件配置变化
      } else {
        message.error('❌ 更新失败: ' + result.error)
      }
    } catch (error) {
      console.error('更新配置异常:', error)
      message.error('❌ 更新异常: ' + error)
    }
  }, [editingConfig, form, loadConfigs, onConfigChange])

  // ==================== 删除配置 ====================
  const deleteConfig = useCallback(async (nameOrId: string | number) => {
    try {
      console.log('🗑️ 发送删除请求:', nameOrId)

      const result = await window.electronAPI.aiConfig.delete(nameOrId)
      console.log('📥 删除响应:', result)

      if (result.success) {
        message.success('✅ 配置删除成功！')
        loadConfigs() // 重新加载列表
        onConfigChange?.() // 通知父组件配置变化
      } else {
        message.error('❌ 删除失败: ' + result.error)
      }
    } catch (error) {
      console.error('删除配置异常:', error)
      message.error('❌ 删除异常: ' + error)
    }
  }, [loadConfigs, onConfigChange])

  // ==================== 编辑配置 ====================
  const handleEdit = useCallback((record: AIConfig) => {
    setEditingConfig(record)
    setShowRealApiKey(false) // 默认显示掩码
    form.setFieldsValue({
      name: record.name,
      api_key: '••••••••••••••••', // 显示掩码表示已有密钥
      base_url: record.base_url
    })
    setModalVisible(true)
  }, [form])

  // ==================== 切换API Key显示状态 ====================
  const toggleApiKeyVisibility = useCallback(() => {
    if (!editingConfig) return

    if (showRealApiKey) {
      // 从显示真实值切换回掩码
      form.setFieldsValue({
        api_key: '••••••••••••••••'
      })
      setShowRealApiKey(false)
    } else {
      // 从掩码切换到真实值
      form.setFieldsValue({
        api_key: editingConfig.api_key
      })
      setShowRealApiKey(true)
    }
  }, [editingConfig, showRealApiKey, form])

  // ==================== 表单提交 ====================
  const handleFormSubmit = useCallback((values: any) => {
    if (editingConfig) {
      updateConfig(values)
    } else {
      createConfig(values)
    }
  }, [editingConfig, updateConfig, createConfig])

  // ==================== 打开新增弹窗 ====================
  const openCreateModal = useCallback(() => {
    setEditingConfig(null)
    setShowRealApiKey(false)
    form.resetFields()
    setModalVisible(true)
  }, [form])

  // ==================== 关闭弹窗 ====================
  const closeModal = useCallback(() => {
    setModalVisible(false)
    setEditingConfig(null)
    setShowRealApiKey(false)
    form.resetFields()
  }, [form])

  // ==================== 初始化加载 ====================
  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  // ==================== 返回状态和方法 ====================
  return {
    // 状态
    configs,
    loading,
    modalVisible,
    editingConfig,
    showRealApiKey,
    form,

    // 方法
    loadConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    handleEdit,
    toggleApiKeyVisibility,
    handleFormSubmit,
    openCreateModal,
    closeModal
  }
}