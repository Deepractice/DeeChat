import { DDDIntegrationTest } from './ddd-integration-test'
import { ChatService } from '../main/services/core/ChatService'
import path from 'path'
import fs from 'fs'

/**
 * DDD重构测试运行器
 * 直接在当前项目环境中运行新旧实现对比测试
 */
async function runDDDIntegrationTest() {
  console.log('🔧 正在初始化DDD集成测试环境...')

  try {
    // 初始化测试数据库路径（使用临时测试数据库）
    const testDbPath = path.join(__dirname, '../../test-db.sqlite')
    
    // 如果测试数据库不存在，创建一个简单的测试环境
    if (!fs.existsSync(testDbPath)) {
      console.log('📦 创建测试数据库...')
      // 这里可以初始化一个简单的测试数据库
      // 暂时跳过，直接使用现有的数据库连接
    }

    // 初始化ChatService (原有实现)
    console.log('🏗️  初始化ChatService...')
    const legacyChatService = new ChatService()

    // 初始化DDD测试器
    console.log('🏗️  初始化DDD测试器...')
    const tester = new DDDIntegrationTest()
    tester.setLegacyChatService(legacyChatService)

    // 运行完整测试套件
    console.log('🚀 开始运行完整测试套件...\n')
    const testResults = await tester.runFullTest()

    // 输出详细的测试结果分析
    console.log('\n' + '='.repeat(60))
    console.log('📋 详细测试结果分析')
    console.log('='.repeat(60))

    // 会话创建测试结果
    if (testResults.results.sessionCreation) {
      console.log('\n1️⃣ 会话创建测试:')
      console.log(`   状态: ${testResults.results.sessionCreation.success ? '✅ 通过' : '❌ 失败'}`)
      if (!testResults.results.sessionCreation.success) {
        console.log(`   错误: ${testResults.results.sessionCreation.errors?.join(', ')}`)
      }
      console.log(`   Legacy ID: ${testResults.results.sessionCreation.legacy?.sessionId}`)
      console.log(`   New ID: ${testResults.results.sessionCreation.new?.sessionId}`)
    }

    // 消息发送测试结果
    if (testResults.results.messageSending) {
      console.log('\n2️⃣ 消息发送测试:')
      console.log(`   状态: ${testResults.results.messageSending.success ? '✅ 通过' : '❌ 失败'}`)
      if (!testResults.results.messageSending.success) {
        console.log(`   错误: ${testResults.results.messageSending.errors?.join(', ')}`)
      }
      console.log(`   Legacy Success: ${testResults.results.messageSending.legacy?.success}`)
      console.log(`   New Success: ${testResults.results.messageSending.new?.success}`)
    }

    // 会话历史测试结果
    if (testResults.results.chatHistory) {
      console.log('\n3️⃣ 会话历史测试:')
      console.log(`   状态: ${testResults.results.chatHistory.success ? '✅ 通过' : '❌ 失败'}`)
      if (!testResults.results.chatHistory.success) {
        console.log(`   错误: ${testResults.results.chatHistory.errors?.join(', ')}`)
      }
      console.log(`   Legacy Messages: ${testResults.results.chatHistory.legacy?.messages?.length}`)
      console.log(`   New Messages: ${testResults.results.chatHistory.new?.messages?.length}`)
    }

    // 会话列表测试结果
    if (testResults.results.sessionList) {
      console.log('\n4️⃣ 会话列表测试:')
      console.log(`   状态: ${testResults.results.sessionList.success ? '✅ 通过' : '❌ 失败'}`)
      if (!testResults.results.sessionList.success) {
        console.log(`   错误: ${testResults.results.sessionList.errors?.join(', ')}`)
      }
      console.log(`   Legacy Count: ${testResults.results.sessionList.legacy?.length}`)
      console.log(`   New Count: ${testResults.results.sessionList.new?.length}`)
    }

    // 输出建议
    console.log('\n' + '='.repeat(60))
    console.log('💡 重构建议')
    console.log('='.repeat(60))

    if (testResults.overall) {
      console.log(`
✅ 恭喜！新的DDD实现完全兼容原有功能
   
🚀 下一步建议:
   1. 在生产环境中启用功能开关(Feature Flag)
   2. 逐步将流量切换到新的DDD实现
   3. 监控性能指标和错误率
   4. 收集用户反馈
   5. 完全迁移后移除旧代码
`)
    } else {
      console.log(`
⚠️  发现兼容性问题，需要修复:

🔧 修复建议:
   1. 检查数据结构转换逻辑
   2. 确保所有业务规则正确实现
   3. 验证错误处理机制
   4. 修复后重新运行测试
   
📊 问题统计:
   - 总测试数: ${testResults.summary.total}
   - 通过数: ${testResults.summary.passed}
   - 失败数: ${testResults.summary.failed}
`)
      
      if (testResults.summary.errors.length > 0) {
        console.log('\n🔍 具体错误清单:')
        testResults.summary.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`)
        })
      }
    }

    return testResults

  } catch (error) {
    console.error('❌ 测试运行失败:', error)
    throw error
  }
}

/**
 * 性能对比测试
 */
async function runPerformanceComparison() {
  console.log('\n⚡ 开始性能对比测试...')
  
  const iterations = 10
  const results: any = {
    legacy: { times: [], average: 0 },
    new: { times: [], average: 0 }
  }

  // TODO: 实现性能测试逻辑
  console.log('📊 性能测试功能待实现')
  
  return results
}

// 主执行函数
if (require.main === module) {
  runDDDIntegrationTest()
    .then(() => {
      console.log('\n🎯 测试完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 测试执行失败:', error)
      process.exit(1)
    })
}

export { runDDDIntegrationTest, runPerformanceComparison }