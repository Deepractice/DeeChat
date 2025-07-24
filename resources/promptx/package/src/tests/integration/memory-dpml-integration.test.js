const fs = require('fs-extra')
const path = require('path')
const RememberCommand = require('../../lib/core/pouch/commands/RememberCommand')
const RecallCommand = require('../../lib/core/pouch/commands/RecallCommand')

describe('Memory DPML Integration', () => {
  const testDir = path.join(__dirname, 'test-workspace')
  const memoryDir = path.join(testDir, '.promptx', 'memory')
  const xmlFile = path.join(memoryDir, 'declarative.dpml')
  const legacyFile = path.join(memoryDir, 'declarative.md')
  const backupFile = path.join(memoryDir, 'declarative.md.bak')
  
  let originalCwd

  beforeEach(async () => {
    // 保存原始工作目录
    originalCwd = process.cwd()
    
    // 清理测试目录
    await fs.remove(testDir)
    await fs.ensureDir(testDir)
    
    // 切换到测试工作目录
    process.chdir(testDir)
  })

  afterEach(async () => {
    // 恢复原始工作目录
    process.chdir(originalCwd)
    
    // 清理测试目录
    await fs.remove(testDir)
  })

  test('完整的保存和检索流程', async () => {
    const rememberCmd = new RememberCommand()
    const recallCmd = new RecallCommand()
    
    // 保存记忆
    const result = await rememberCmd.saveMemory('测试记忆内容')
    expect(result.action).toBe('created')
    expect(result.value).toBe('测试记忆内容')
    
    // 检索记忆
    const memories = await recallCmd.getAllMemories('测试')
    expect(memories.length).toBe(1)
    expect(memories[0].content).toBe('测试记忆内容')
    expect(memories[0].tags).toContain('其他')
  })

  test('DPML文件格式正确', async () => {
    const rememberCmd = new RememberCommand()
    
    // 保存记忆
    await rememberCmd.saveMemory('测试DPML格式')
    
    // 检查DPML文件
    expect(await fs.pathExists(xmlFile)).toBe(true)
    const xmlContent = await fs.readFile(xmlFile, 'utf8')
    
    // 验证XML结构
    expect(xmlContent).toMatch(/<memory>/)
    expect(xmlContent).toMatch(/<\/memory>/)
    expect(xmlContent).toMatch(/<item id="[^"]*" time="[^"]*">/)
    expect(xmlContent).toMatch(/<content>测试DPML格式<\/content>/)
    expect(xmlContent).toMatch(/<tags>其他<\/tags>/)
  })

  test('数据迁移功能', async () => {
    // 确保目录存在
    await fs.ensureDir(memoryDir)
    
    // 创建legacy文件
    const legacyContent = `# 陈述性记忆

## 高价值记忆（评分 ≥ 7）

- 2025/01/15 14:30 测试记忆内容 #工具使用 #评分:8 #有效期:长期

- 2025/01/16 10:20 另一条测试记忆 #流程管理 #评分:9 #有效期:长期`

    await fs.writeFile(legacyFile, legacyContent, 'utf8')
    
    // 触发迁移
    const rememberCmd = new RememberCommand()
    await rememberCmd.saveMemory('新记忆触发迁移')
    
    // 验证迁移结果
    expect(await fs.pathExists(xmlFile)).toBe(true)
    expect(await fs.pathExists(backupFile)).toBe(true)
    
    // 检查迁移的内容
    const recallCmd = new RecallCommand()
    const memories = await recallCmd.getAllMemories()
    
    // 应该有3条记忆（2条迁移的 + 1条新的）
    expect(memories.length).toBe(3)
    
    // 验证迁移的记忆内容
    const migratedMemories = memories.filter(m => 
      m.content.includes('测试记忆内容') || m.content.includes('另一条测试记忆')
    )
    expect(migratedMemories.length).toBe(2)
  })

  test('搜索功能正常工作', async () => {
    const rememberCmd = new RememberCommand()
    const recallCmd = new RecallCommand()
    
    // 保存多条记忆
    await rememberCmd.saveMemory('前端开发最佳实践')
    await rememberCmd.saveMemory('后端API设计规范')
    await rememberCmd.saveMemory('测试流程优化')
    
    // 搜索特定内容
    const frontendMemories = await recallCmd.getAllMemories('前端')
    expect(frontendMemories.length).toBe(1)
    expect(frontendMemories[0].content).toBe('前端开发最佳实践')
    
    // 搜索标签
    const flowMemories = await recallCmd.getAllMemories('流程')
    expect(flowMemories.length).toBe(1)
    expect(flowMemories[0].content).toBe('测试流程优化')
  })

  test('XML转义功能正常', async () => {
    const rememberCmd = new RememberCommand()
    const recallCmd = new RecallCommand()
    
    // 保存包含特殊字符的记忆
    const specialContent = '使用<script>标签时要注意"安全性"问题 & 性能优化'
    await rememberCmd.saveMemory(specialContent)
    
    // 检索记忆
    const memories = await recallCmd.getAllMemories('script')
    expect(memories.length).toBe(1)
    expect(memories[0].content).toBe(specialContent)
    
    // 检查DPML文件中的转义
    const xmlContent = await fs.readFile(xmlFile, 'utf8')
    expect(xmlContent).toMatch(/&lt;script&gt;/)
    expect(xmlContent).toMatch(/&quot;安全性&quot;/)
    expect(xmlContent).toMatch(/&amp; 性能优化/)
  })

  test('迁移只执行一次', async () => {
    // 确保目录存在
    await fs.ensureDir(memoryDir)
    
    // 创建legacy文件
    const legacyContent = '- 2025/01/15 14:30 测试记忆 #其他 #评分:8 #有效期:长期'
    await fs.writeFile(legacyFile, legacyContent, 'utf8')
    
    const rememberCmd = new RememberCommand()
    
    // 第一次触发迁移
    await rememberCmd.saveMemory('第一次记忆')
    expect(await fs.pathExists(backupFile)).toBe(true)
    
    // 记录备份文件的修改时间
    const firstBackupStats = await fs.stat(backupFile)
    
    // 等待一小段时间确保时间戳不同
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // 第二次保存，不应该再次迁移
    await rememberCmd.saveMemory('第二次记忆')
    
    // 备份文件的修改时间应该没有变化
    const secondBackupStats = await fs.stat(backupFile)
    expect(secondBackupStats.mtime.getTime()).toBe(firstBackupStats.mtime.getTime())
  })
})