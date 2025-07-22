import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { ModelConfigEntity, TestResult, UserPreferenceEntity, ModelManagementState, ApiResponse } from '../../../shared/types'

// 初始状态
const initialState: ModelManagementState = {
  configs: [],
  currentSessionModel: null,
  userPreferences: null,
  isLoading: false,
  error: null,
  testResults: new Map()
}

// 异步Thunk操作
export const loadModelConfigs = createAsyncThunk(
  'modelManagement/loadConfigs',
  async (_, { rejectWithValue }) => {
    try {
      const response: ApiResponse<ModelConfigEntity[]> = await window.electronAPI.model.getAll()
      if (!response.success) {
        throw new Error(response.error || '加载模型配置失败')
      }
      return response.data || []
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const saveModelConfig = createAsyncThunk(
  'modelManagement/saveConfig',
  async (config: ModelConfigEntity, { rejectWithValue }) => {
    try {
      const response: ApiResponse<void> = await window.electronAPI.model.save(config)
      if (!response.success) {
        throw new Error(response.error || '保存模型配置失败')
      }
      return config
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const deleteModelConfig = createAsyncThunk(
  'modelManagement/deleteConfig',
  async (configId: string, { rejectWithValue }) => {
    try {
      const response: ApiResponse<void> = await window.electronAPI.model.delete(configId)
      if (!response.success) {
        throw new Error(response.error || '删除模型配置失败')
      }
      return configId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const updateModelConfig = createAsyncThunk(
  'modelManagement/updateConfig',
  async (config: ModelConfigEntity, { rejectWithValue }) => {
    try {
      const response: ApiResponse<ModelConfigEntity> = await window.electronAPI.model.update(config)
      if (!response.success) {
        throw new Error(response.error || '更新模型配置失败')
      }
      return response.data || config
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const testModelConfig = createAsyncThunk(
  'modelManagement/testConfig',
  async (configId: string, { rejectWithValue }) => {
    try {
      const response: ApiResponse<TestResult> = await window.electronAPI.model.test(configId)
      if (!response.success) {
        throw new Error(response.error || '测试模型配置失败')
      }
      return { configId, result: response.data! }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const loadUserPreferences = createAsyncThunk(
  'modelManagement/loadPreferences',
  async (_, { rejectWithValue }) => {
    try {
      const response: ApiResponse<UserPreferenceEntity> = await window.electronAPI.preference.get()
      if (!response.success) {
        throw new Error(response.error || '加载用户偏好失败')
      }
      return response.data!
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const saveUserPreferences = createAsyncThunk(
  'modelManagement/savePreferences',
  async (preferences: Partial<UserPreferenceEntity>, { rejectWithValue }) => {
    try {
      const response: ApiResponse<void> = await window.electronAPI.preference.save(preferences)
      if (!response.success) {
        throw new Error(response.error || '保存用户偏好失败')
      }
      return preferences
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const getSessionModel = createAsyncThunk(
  'modelManagement/getSessionModel',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const response: ApiResponse<ModelConfigEntity | null> = await window.electronAPI.session.getModel(sessionId)
      if (!response.success) {
        throw new Error(response.error || '获取会话模型失败')
      }
      return { sessionId, model: response.data }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

export const switchSessionModel = createAsyncThunk(
  'modelManagement/switchSessionModel',
  async ({ sessionId, modelId }: { sessionId: string; modelId: string }, { rejectWithValue }) => {
    try {
      const response: ApiResponse<void> = await window.electronAPI.session.switchModel(sessionId, modelId)
      if (!response.success) {
        throw new Error(response.error || '切换会话模型失败')
      }
      return { sessionId, modelId }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '未知错误')
    }
  }
)

// Slice定义
const modelManagementSlice = createSlice({
  name: 'modelManagement',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setCurrentSessionModel: (state, action: PayloadAction<string | null>) => {
      state.currentSessionModel = action.payload
    },
    updateConfigInState: (state, action: PayloadAction<ModelConfigEntity>) => {
      const index = state.configs.findIndex((c: ModelConfigEntity) => c.id === action.payload.id)
      if (index >= 0) {
        state.configs[index] = action.payload
      }
    },
    toggleConfigEnabled: (state, action: PayloadAction<string>) => {
      const config = state.configs.find((c: ModelConfigEntity) => c.id === action.payload)
      if (config) {
        config.isEnabled = !config.isEnabled
        config.updatedAt = new Date()
      }
    },
    clearTestResults: (state) => {
      state.testResults = new Map()
    }
  },
  extraReducers: (builder) => {
    // 加载模型配置
    builder
      .addCase(loadModelConfigs.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadModelConfigs.fulfilled, (state, action) => {
        state.isLoading = false
        state.configs = action.payload
      })
      .addCase(loadModelConfigs.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 保存模型配置
    builder
      .addCase(saveModelConfig.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(saveModelConfig.fulfilled, (state, action) => {
        state.isLoading = false
        const index = state.configs.findIndex((c: ModelConfigEntity) => c.id === action.payload.id)
        if (index >= 0) {
          state.configs[index] = action.payload
        } else {
          state.configs.push(action.payload)
        }
      })
      .addCase(saveModelConfig.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 删除模型配置
    builder
      .addCase(deleteModelConfig.fulfilled, (state, action) => {
        state.configs = state.configs.filter((c: ModelConfigEntity) => c.id !== action.payload)
        state.testResults.delete(action.payload)
      })

    // 更新模型配置
    builder
      .addCase(updateModelConfig.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateModelConfig.fulfilled, (state, action) => {
        state.isLoading = false
        const index = state.configs.findIndex((c: ModelConfigEntity) => c.id === action.payload.id)
        if (index >= 0) {
          state.configs[index] = action.payload
        }
      })
      .addCase(updateModelConfig.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // 测试模型配置
    builder
      .addCase(testModelConfig.pending, (state, action) => {
        const configId = action.meta.arg
        const config = state.configs.find((c: ModelConfigEntity) => c.id === configId)
        if (config) {
          config.status = 'testing'
        }
      })
      .addCase(testModelConfig.fulfilled, (state, action) => {
        const { configId, result } = action.payload
        state.testResults.set(configId, result)

        const config = state.configs.find((c: ModelConfigEntity) => c.id === configId)
        if (config) {
          config.status = result.success ? 'available' : 'error'
          config.responseTime = result.responseTime
          config.errorMessage = result.error
          config.lastTested = new Date()
          config.updatedAt = new Date()
        }
      })
      .addCase(testModelConfig.rejected, (state, action) => {
        const configId = action.meta.arg
        const config = state.configs.find((c: ModelConfigEntity) => c.id === configId)
        if (config) {
          config.status = 'error'
          config.errorMessage = action.payload as string
          config.lastTested = new Date()
          config.updatedAt = new Date()
        }
      })

    // 加载用户偏好
    builder
      .addCase(loadUserPreferences.fulfilled, (state, action) => {
        state.userPreferences = action.payload
      })

    // 保存用户偏好
    builder
      .addCase(saveUserPreferences.fulfilled, (state, action) => {
        if (state.userPreferences) {
          Object.assign(state.userPreferences, action.payload)
        }
      })

    // 获取会话模型
    builder
      .addCase(getSessionModel.fulfilled, (state, action) => {
        const { model } = action.payload
        state.currentSessionModel = model?.id || null
      })

    // 切换会话模型
    builder
      .addCase(switchSessionModel.fulfilled, (state, action) => {
        const { modelId } = action.payload
        state.currentSessionModel = modelId
        
        // 更新用户偏好中的最后选择
        if (state.userPreferences) {
          state.userPreferences.lastSelectedModelId = modelId
        }
      })
  }
})

export const {
  clearError,
  setCurrentSessionModel,
  updateConfigInState,
  toggleConfigEnabled,
  clearTestResults
} = modelManagementSlice.actions

export default modelManagementSlice.reducer
