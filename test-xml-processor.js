/**
 * 简单测试StreamingXMLProcessor的工具识别功能
 */

// 模拟StreamingXMLProcessor的核心逻辑
class TestXMLProcessor {
  constructor() {
    // 🚀 动态工具注册表
    this.availableTools = new Map();
    this.isToolRegistryInitialized = false;
    
    // 🔥 兜底工具前缀（核心系统工具）
    this.FALLBACK_PREFIXES = [
      'promptx_',
      'promptx-builtin__',
      'mcp_'
    ];
    
    // 模拟初始化
    this.setupFallbackTools();
  }
  
  setupFallbackTools() {
    console.log('🔧 [XMLProcessor] 设置兜底工具前缀匹配');
    this.isToolRegistryInitialized = true;
  }
  
  /**
   * 🚀 检查是否为工具标签（支持动态工具发现）
   */
  isToolTag(tagName) {
    // 1. 优先检查动态注册的工具
    if (this.isToolRegistryInitialized && this.availableTools.has(tagName)) {
      console.log(`✅ [XMLProcessor] 在动态工具注册表中找到: ${tagName}`);
      return true;
    }
    
    // 2. 兜底方案：使用前缀匹配
    const isMatchedByPrefix = this.FALLBACK_PREFIXES.some(prefix => tagName.startsWith(prefix));
    if (isMatchedByPrefix) {
      console.log(`✅ [XMLProcessor] 通过兜底前缀匹配: ${tagName}`);
    }
    
    return isMatchedByPrefix;
  }
  
  getToolRegistryStats() {
    const toolsBySource = {};
    
    this.availableTools.forEach(tool => {
      toolsBySource[tool.source] = (toolsBySource[tool.source] || 0) + 1;
    });
    
    return {
      initialized: this.isToolRegistryInitialized,
      totalTools: this.availableTools.size,
      toolsBySource,
      availableTools: Array.from(this.availableTools.keys())
    };
  }
}

console.log('🧪 开始测试动态工具发现功能...');

// 创建处理器
const processor = new TestXMLProcessor();

// 获取统计
const stats = processor.getToolRegistryStats();
console.log('📊 工具注册表统计:', JSON.stringify(stats, null, 2));

// 测试工具识别
console.log('🔍 测试工具标签识别:');

const testTags = [
  'promptx_learn',        // ✅ promptx_ 前缀
  'promptx-builtin__learn', // ✅ promptx-builtin__ 前缀  
  'mcp_test',            // ✅ mcp_ 前缀
  'unknown_tool',        // ❌ 未知工具
  'promptx_action',      // ✅ promptx_ 前缀
  'promptx-builtin__toolx' // ✅ promptx-builtin__ 前缀（之前的问题标签）
];

for (const tag of testTags) {
  const isToolTag = processor.isToolTag(tag);
  console.log(`  ${tag}: ${isToolTag ? '✅ 识别为工具' : '❌ 不是工具'}`);
}

console.log('🎉 测试完成');