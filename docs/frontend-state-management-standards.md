# 前端状态管理标准文档

## 🎯 核心原则

### 1. 后端驱动原则
- **数据源唯一性**: 后端是所有数据的唯一真实来源
- **最小前端状态**: 前端只保存必要的UI状态，避免缓存业务数据
- **实时数据获取**: 需要数据时直接调用后端API，不依赖前端缓存

### 2. 状态分类原则

#### ✅ **前端应该保存的状态**：
- **UI交互状态**: loading、modal开关、表单输入等
- **导航状态**: 当前页面、选中的tab等
- **临时选择状态**: 当前选中的ID（如 currentSessionId）
- **用户偏好**: 侧边栏展开状态、主题设置等

#### ❌ **前端不应该保存的状态**：
- **业务数据列表**: 会话列表、消息列表、配置列表等
- **详细对象信息**: 会话详情、用户信息、配置详情等
- **计算结果**: 统计数据、聚合信息等
- **关联数据**: 任何需要与后端保持同步的数据

## 🏗️ 架构模式

### Context 设计模式

```typescript
interface ResourceContextType {
  // 最小状态 - 只保存ID和UI状态
  currentResourceId: string | null
  loading: boolean

  // 操作方法 - 直接调用后端
  createResource: (params) => Promise<Resource | null>
  selectResource: (id: string | null) => void
  updateResource: (id, data) => Promise<boolean>
  deleteResource: (id) => Promise<boolean>

  // 数据获取 - 实时从后端获取
  getResources: () => Promise<Resource[]>
  getCurrentResource: () => Promise<Resource | null>
}
```

### 数据流设计

```
操作触发 → Context方法 → 后端API → 重新获取数据 → UI更新
```

**避免的复杂流程**：
```
操作触发 → 本地状态更新 → 后端API → 状态同步检查 → 可能的冲突处理
```

## 📋 实施指南

### 1. 创建 Context

```typescript
// contexts/SessionContext.tsx
export const SessionProvider: React.FC = ({ children }) => {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const createSession = async (params) => {
    const result = await window.electronAPI.conversation.createSession(params)
    if (result.success) {
      setCurrentSessionId(result.data.id)
      return result.data
    }
    return null
  }

  const selectSession = (sessionId: string | null) => {
    setCurrentSessionId(sessionId)
  }

  const getSessions = async () => {
    const result = await window.electronAPI.conversation.getSessions()
    return result.success ? result.data : []
  }

  const getCurrentSession = async () => {
    if (!currentSessionId) return null
    const sessions = await getSessions()
    return sessions.find(s => s.id === currentSessionId) || null
  }

  return (
    <SessionContext.Provider value={{
      currentSessionId,
      loading,
      createSession,
      selectSession,
      getSessions,
      getCurrentSession
    }}>
      {children}
    </SessionContext.Provider>
  )
}
```

### 2. 在组件中使用

```typescript
const MyComponent: React.FC = () => {
  const { currentSessionId, getSessions, getCurrentSession } = useSession()
  const [sessions, setSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)

  // 数据加载
  useEffect(() => {
    const loadSessions = async () => {
      const data = await getSessions()
      setSessions(data)
    }
    loadSessions()
  }, [getSessions])

  // 当前会话变化时重新获取
  useEffect(() => {
    const loadCurrentSession = async () => {
      const session = await getCurrentSession()
      setCurrentSession(session)
    }
    if (currentSessionId) {
      loadCurrentSession()
    } else {
      setCurrentSession(null)
    }
  }, [currentSessionId, getCurrentSession])

  return (
    <div>
      {/* UI 渲染 */}
    </div>
  )
}
```

## 🚀 Electron 应用优势

### 1. 无网络延迟顾虑
- IPC通信速度极快
- 可以频繁调用后端而不影响性能
- 不需要考虑网络缓存策略

### 2. 数据一致性保障
- 后端直接访问数据库
- 避免前端缓存导致的数据不一致
- 简化并发处理逻辑

### 3. 开发效率提升
- 减少状态同步代码
- 降低bug出现概率
- 简化测试复杂度

## 📏 最佳实践

### DO ✅

1. **状态最小化**
   ```typescript
   // ✅ 只保存ID
   const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

   // ❌ 不要保存完整对象
   const [currentSession, setCurrentSession] = useState<Session | null>(null)
   ```

2. **操作即刷新**
   ```typescript
   // ✅ 操作后重新获取数据
   const handleDelete = async (id) => {
     await deleteSession(id)
     const newSessions = await getSessions() // 重新获取
     setSessions(newSessions)
   }
   ```

3. **错误处理集中化**
   ```typescript
   // ✅ 在Context中统一处理错误
   const createSession = async (params) => {
     try {
       const result = await api.createSession(params)
       if (result.success) return result.data
       message.error(result.error)
       return null
     } catch (error) {
       message.error('创建失败')
       return null
     }
   }
   ```

### DON'T ❌

1. **避免复杂状态同步**
   ```typescript
   // ❌ 不要手动同步状态
   const handleUpdate = (id, newData) => {
     setSessions(prev => prev.map(s => s.id === id ? {...s, ...newData} : s))
     if (currentSession?.id === id) {
       setCurrentSession(prev => ({...prev, ...newData}))
     }
   }
   ```

2. **避免多处数据源**
   ```typescript
   // ❌ 不要在多个组件中维护相同数据
   // Component A
   const [sessions, setSessions] = useState([])
   // Component B
   const [sessionList, setSessionList] = useState([])
   ```

3. **避免复杂的依赖关系**
   ```typescript
   // ❌ 避免复杂的useEffect依赖
   useEffect(() => {
     // 复杂的状态同步逻辑
   }, [session1, session2, sessions, currentId, ...])
   ```

## 🔧 迁移指南

### 从旧模式迁移到新模式

1. **识别数据状态**
   - 列出所有 useState
   - 分类为UI状态和数据状态
   - 数据状态移到Context，UI状态保留

2. **创建Context**
   - 为每个业务领域创建Context
   - 实现CRUD操作方法
   - 添加数据获取方法

3. **重构组件**
   - 移除数据状态
   - 使用Context方法
   - 在需要时调用数据获取

4. **测试验证**
   - 确保数据一致性
   - 验证操作正确性
   - 检查性能影响

## 📊 性能考虑

### 1. 合理的数据获取频率
- 避免过度获取：不在每次render时调用API
- 适当缓存：短期内可以复用数据（如5秒内）
- 按需加载：只在需要时获取数据

### 2. 优化策略
```typescript
// 使用debounce避免频繁调用
const debouncedGetSessions = useMemo(
  () => debounce(getSessions, 500),
  [getSessions]
)

// 缓存时间短暂的数据
const [cachedSessions, setCachedSessions] = useState({
  data: [],
  timestamp: 0
})

const getSessionsWithCache = async () => {
  const now = Date.now()
  if (now - cachedSessions.timestamp < 5000) {
    return cachedSessions.data
  }

  const data = await getSessions()
  setCachedSessions({ data, timestamp: now })
  return data
}
```

## 🎯 总结

这种状态管理模式特别适合Electron应用：

1. **简化架构**: 前端专注UI，后端管理数据
2. **提高可靠性**: 减少状态不一致问题
3. **便于维护**: 逻辑清晰，易于调试
4. **扩展性好**: 新功能只需在Context中添加方法

遵循这些原则，可以构建出简洁、可靠、易维护的前端应用。