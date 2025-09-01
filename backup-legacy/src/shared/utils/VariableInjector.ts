/**
 * 🔧 变量注入器
 * 处理模板中的 {{变量}} 语法替换
 */

export interface VariableMap {
  [key: string]: string | undefined
}

export class VariableInjector {
  /**
   * 注入变量到模板中
   * @param template 包含{{变量}}的模板字符串
   * @param variables 变量映射
   * @returns 处理后的字符串
   */
  static inject(template: any, variables: VariableMap): string {
    // 🔧 确保template是字符串
    let result: string
    if (typeof template === 'string') {
      result = template
    } else if (template && typeof template === 'object' && template.content) {
      // 如果是PromptX返回的对象，提取content字段
      result = String(template.content)
      console.log(`🔧 [变量注入] 从对象提取content字段: ${result.length}字符`)
    } else if (template && template.toString) {
      result = template.toString()
      console.log(`⚠️ [变量注入] 转换对象为字符串: ${result.length}字符`)
    } else {
      console.error(`❌ [变量注入] template类型无效:`, typeof template, template)
      return '我是您的智能AI助手。'
    }

    // 🚨🚨🚨 关键调试：输出所有变量
    console.log(`🚨🚨🚨 [变量注入-CRITICAL] 输入变量对象:`, variables)
    console.log(`🚨🚨🚨 [变量注入-CRITICAL] ROLE_IDENTITY_INJECTION值:`, variables.ROLE_IDENTITY_INJECTION)
    console.log(`🚨🚨🚨 [变量注入-CRITICAL] ROLE_IDENTITY_INJECTION长度:`, variables.ROLE_IDENTITY_INJECTION?.length || 0)
    
    // 🔥 显示关键信息
    const hasRoleInjection = variables.ROLE_IDENTITY_INJECTION !== undefined
    console.log(`🔥 VariableInjector.inject()执行！ROLE_IDENTITY_INJECTION: ${hasRoleInjection ? '✅存在' : '❌不存在'}, 长度: ${variables.ROLE_IDENTITY_INJECTION?.length || 0}`)

    // 处理普通变量 {{VARIABLE_NAME}}
    result = result.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, varName) => {
      const value = variables[varName]
      if (value !== undefined) {
        console.log(`✅ [变量注入] ${varName} -> ${value.length}字符`)
        // 🚨🚨🚨 特殊关注 ROLE_IDENTITY_INJECTION
        if (varName === 'ROLE_IDENTITY_INJECTION') {
          console.log(`🎯🎯🎯 [变量注入-ROLE] ROLE_IDENTITY_INJECTION 成功替换！`)
          console.log(`🎭 [变量注入-ROLE] 替换内容预览:`, value.substring(0, 200))
        }
        return value
      } else {
        console.log(`⚠️ [变量注入] ${varName} 未定义，保留原样`)
        // 🚨🚨🚨 特殊关注 ROLE_IDENTITY_INJECTION 未定义的情况
        if (varName === 'ROLE_IDENTITY_INJECTION') {
          console.log(`💥💥💥 [变量注入-ERROR] ROLE_IDENTITY_INJECTION 未定义！这是问题根源！`)
        }
        return match // 保留未定义的变量
      }
    })

    // 处理条件变量 {{#VARIABLE}}content{{/VARIABLE}}
    result = result.replace(/\{\{#([A-Z_][A-Z0-9_]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, varName, content) => {
      const value = variables[varName]
      if (value !== undefined && value.trim() !== '') {
        console.log(`✅ [条件变量] ${varName} 存在，展示内容`)
        return content.trim()
      } else {
        console.log(`❌ [条件变量] ${varName} 不存在，隐藏内容`)
        return ''
      }
    })

    // 处理反向条件变量 {{^VARIABLE}}content{{/VARIABLE}} (变量不存在时显示)
    result = result.replace(/\{\{\^([A-Z_][A-Z0-9_]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, varName, content) => {
      const value = variables[varName]
      if (value === undefined || value.trim() === '') {
        console.log(`✅ [反向条件] ${varName} 不存在，展示fallback内容`)
        return content.trim()
      } else {
        console.log(`❌ [反向条件] ${varName} 存在，隐藏fallback内容`)
        return ''
      }
    })

    // 🚨🚨🚨 最终结果调试
    console.log(`🚨🚨🚨 [变量注入-FINAL] 最终结果长度: ${result.length}字符`)
    console.log(`🚨🚨🚨 [变量注入-FINAL] 最终结果预览:`, result.substring(0, 500))
    
    // 检查是否还包含未替换的 ROLE_IDENTITY_INJECTION
    if (result.includes('{{ROLE_IDENTITY_INJECTION}}')) {
      console.log(`💥💥💥 [变量注入-ERROR] 最终结果仍包含未替换的 {{ROLE_IDENTITY_INJECTION}}！`)
    }
    
    // 检查是否包含nuwa关键字
    if (result.includes('nuwa') || result.includes('女娲')) {
      console.log(`🎯🎯🎯 [变量注入-SUCCESS] 最终结果包含nuwa/女娲关键字！`)
    } else {
      console.log(`💥💥💥 [变量注入-ERROR] 最终结果不包含nuwa/女娲关键字！`)
    }

    return result
  }

  /**
   * 从模板中提取所有变量名
   * @param template 模板字符串
   * @returns 变量名数组
   */
  static extractVariables(template: string): string[] {
    const variables = new Set<string>()
    
    // 提取 {{VARIABLE}} 格式
    const simpleMatches = template.match(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g) || []
    simpleMatches.forEach(match => {
      const varName = match.replace(/[\{\}]/g, '')
      variables.add(varName)
    })

    // 提取 {{#VARIABLE}} 和 {{^VARIABLE}} 格式
    const conditionalMatches = template.match(/\{\{[#\^]([A-Z_][A-Z0-9_]*)\}\}/g) || []
    conditionalMatches.forEach(match => {
      const varName = match.replace(/[\{\}#\^]/g, '')
      variables.add(varName)
    })

    return Array.from(variables)
  }

  /**
   * 验证所有必需变量是否已提供
   * @param template 模板字符串
   * @param variables 变量映射
   * @returns 缺失的变量列表
   */
  static validateVariables(template: string, variables: VariableMap): string[] {
    const requiredVars = this.extractVariables(template)
    return requiredVars.filter(varName => variables[varName] === undefined)
  }
}