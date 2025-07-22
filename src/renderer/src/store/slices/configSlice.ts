import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { AppConfig, LLMConfig } from '../../../../shared/types'

interface ConfigState {
  config: AppConfig
  isLoading: boolean
  error: string | null
}

// 默认配置
const defaultConfig: AppConfig = {
  llm: {
    provider: 'openai',
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2000,
  },
  ui: {
    theme: 'auto',
    language: 'zh',
  },
  chat: {
    maxHistoryLength: 100,
    autoSave: true,
  },
}

const initialState: ConfigState = {
  config: defaultConfig,
  isLoading: false,
  error: null,
}

// 异步 thunk：加载配置
export const loadConfig = createAsyncThunk(
  'config/load',
  async () => {
    const response = await window.electronAPI.getConfig()
    return response
  }
)

// 异步 thunk：保存配置
export const saveConfig = createAsyncThunk(
  'config/save',
  async (config: AppConfig) => {
    const response = await window.electronAPI.setConfig(config)
    return response
  }
)

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    // 更新 LLM 配置
    updateLLMConfig: (state, action: PayloadAction<Partial<LLMConfig>>) => {
      state.config.llm = { ...state.config.llm, ...action.payload }
    },

    // 更新 UI 配置
    updateUIConfig: (state, action: PayloadAction<Partial<AppConfig['ui']>>) => {
      state.config.ui = { ...state.config.ui, ...action.payload }
    },

    // 更新聊天配置
    updateChatConfig: (state, action: PayloadAction<Partial<AppConfig['chat']>>) => {
      state.config.chat = { ...state.config.chat, ...action.payload }
    },

    // 重置配置
    resetConfig: (state) => {
      state.config = defaultConfig
    },

    // 清除错误
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // 加载配置
      .addCase(loadConfig.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadConfig.fulfilled, (state, action) => {
        state.isLoading = false
        if (action.payload.success) {
          state.config = { ...defaultConfig, ...action.payload.data }
        }
      })
      .addCase(loadConfig.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || '加载配置失败'
      })
      // 保存配置
      .addCase(saveConfig.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(saveConfig.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(saveConfig.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || '保存配置失败'
      })
  },
})

export const { 
  updateLLMConfig, 
  updateUIConfig, 
  updateChatConfig, 
  resetConfig, 
  clearError 
} = configSlice.actions

export default configSlice.reducer
