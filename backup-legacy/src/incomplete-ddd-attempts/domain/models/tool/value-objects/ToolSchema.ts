/**
 * 工具模式值对象
 * 定义工具的输入参数规范和验证规则
 */

import { ValueObject } from '../../../core/ValueObject'

export interface IParameterSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required?: boolean
  description?: string
  default?: any
  enum?: any[]
  pattern?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  items?: IParameterSchema
  properties?: Record<string, IParameterSchema>
}

export interface IToolSchemaDefinition {
  name: string
  description: string
  parameters: Record<string, IParameterSchema>
  returns?: {
    type: string
    description?: string
    schema?: any
  }
  examples?: Array<{
    name: string
    description?: string
    parameters: Record<string, any>
    expectedResult?: any
  }>
  tags?: string[]
  version?: string
}

export interface IValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export class ToolSchema extends ValueObject {
  private constructor(private readonly schema: IToolSchemaDefinition) {
    super()
    this.validate()
  }

  /**
   * 创建工具模式
   */
  static create(schema: IToolSchemaDefinition): ToolSchema {
    return new ToolSchema(schema)
  }

  /**
   * 从JSON创建工具模式
   */
  static fromJSON(json: string): ToolSchema {
    try {
      const schema = JSON.parse(json)
      return new ToolSchema(schema)
    } catch (error) {
      throw new Error(`Invalid JSON schema: ${error}`)
    }
  }

  /**
   * 创建简单模式（只有基本信息）
   */
  static createSimple(name: string, description: string, parameters: Record<string, IParameterSchema> = {}): ToolSchema {
    return new ToolSchema({
      name,
      description,
      parameters,
      version: '1.0.0'
    })
  }

  /**
   * 获取模式定义
   */
  getSchema(): IToolSchemaDefinition {
    return { ...this.schema }
  }

  /**
   * 获取工具名称
   */
  getName(): string {
    return this.schema.name
  }

  /**
   * 获取工具描述
   */
  getDescription(): string {
    return this.schema.description
  }

  /**
   * 获取参数定义
   */
  getParameters(): Record<string, IParameterSchema> {
    return { ...this.schema.parameters }
  }

  /**
   * 获取必需参数列表
   */
  getRequiredParameters(): string[] {
    return Object.entries(this.schema.parameters)
      .filter(([_, param]) => param.required === true)
      .map(([name, _]) => name)
  }

  /**
   * 获取可选参数列表
   */
  getOptionalParameters(): string[] {
    return Object.entries(this.schema.parameters)
      .filter(([_, param]) => param.required !== true)
      .map(([name, _]) => name)
  }

  /**
   * 检查是否有特定参数
   */
  hasParameter(paramName: string): boolean {
    return paramName in this.schema.parameters
  }

  /**
   * 获取参数类型
   */
  getParameterType(paramName: string): string | undefined {
    return this.schema.parameters[paramName]?.type
  }

  /**
   * 检查参数是否必需
   */
  isParameterRequired(paramName: string): boolean {
    return this.schema.parameters[paramName]?.required === true
  }

  /**
   * 获取参数默认值
   */
  getParameterDefault(paramName: string): any {
    return this.schema.parameters[paramName]?.default
  }

  /**
   * 验证输入参数
   */
  validate(input: Record<string, any>): IValidationResult {
    const result: IValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    // 检查必需参数
    const requiredParams = this.getRequiredParameters()
    for (const paramName of requiredParams) {
      if (!(paramName in input) || input[paramName] === undefined || input[paramName] === null) {
        result.errors.push(`Missing required parameter: ${paramName}`)
        result.isValid = false
      }
    }

    // 验证每个提供的参数
    for (const [paramName, value] of Object.entries(input)) {
      if (!this.hasParameter(paramName)) {
        result.warnings.push(`Unknown parameter: ${paramName}`)
        continue
      }

      const paramSchema = this.schema.parameters[paramName]
      const paramValidation = this.validateParameter(paramName, value, paramSchema)
      
      result.errors.push(...paramValidation.errors)
      result.warnings.push(...paramValidation.warnings)
      
      if (!paramValidation.isValid) {
        result.isValid = false
      }
    }

    return result
  }

  /**
   * 验证单个参数
   */
  private validateParameter(paramName: string, value: any, schema: IParameterSchema): IValidationResult {
    const result: IValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    // 类型检查
    if (!this.isValidType(value, schema.type)) {
      result.errors.push(`Parameter ${paramName} must be of type ${schema.type}, got ${typeof value}`)
      result.isValid = false
      return result
    }

    // 枚举值检查
    if (schema.enum && !schema.enum.includes(value)) {
      result.errors.push(`Parameter ${paramName} must be one of: ${schema.enum.join(', ')}`)
      result.isValid = false
    }

    // 字符串特定验证
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        result.errors.push(`Parameter ${paramName} does not match pattern: ${schema.pattern}`)
        result.isValid = false
      }
      
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        result.errors.push(`Parameter ${paramName} must be at least ${schema.minLength} characters long`)
        result.isValid = false
      }
      
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        result.errors.push(`Parameter ${paramName} must be at most ${schema.maxLength} characters long`)
        result.isValid = false
      }
    }

    // 数值特定验证
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        result.errors.push(`Parameter ${paramName} must be at least ${schema.minimum}`)
        result.isValid = false
      }
      
      if (schema.maximum !== undefined && value > schema.maximum) {
        result.errors.push(`Parameter ${paramName} must be at most ${schema.maximum}`)
        result.isValid = false
      }
    }

    // 数组特定验证
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const itemValidation = this.validateParameter(`${paramName}[${i}]`, value[i], schema.items)
          result.errors.push(...itemValidation.errors)
          result.warnings.push(...itemValidation.warnings)
          if (!itemValidation.isValid) {
            result.isValid = false
          }
        }
      }
    }

    // 对象特定验证
    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName in value) {
            const propValidation = this.validateParameter(`${paramName}.${propName}`, value[propName], propSchema)
            result.errors.push(...propValidation.errors)
            result.warnings.push(...propValidation.warnings)
            if (!propValidation.isValid) {
              result.isValid = false
            }
          }
        }
      }
    }

    return result
  }

  /**
   * 检查值是否为指定类型
   */
  private isValidType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return false
    }
  }

  /**
   * 应用默认值
   */
  applyDefaults(input: Record<string, any>): Record<string, any> {
    const result = { ...input }
    
    for (const [paramName, paramSchema] of Object.entries(this.schema.parameters)) {
      if (!(paramName in result) && paramSchema.default !== undefined) {
        result[paramName] = paramSchema.default
      }
    }
    
    return result
  }

  /**
   * 获取参数文档
   */
  getParameterDocumentation(): Array<{
    name: string
    type: string
    required: boolean
    description?: string
    default?: any
    examples?: any[]
  }> {
    return Object.entries(this.schema.parameters).map(([name, schema]) => ({
      name,
      type: schema.type,
      required: schema.required === true,
      description: schema.description,
      default: schema.default,
      examples: schema.enum
    }))
  }

  /**
   * 获取使用示例
   */
  getExamples(): Array<{
    name: string
    description?: string
    parameters: Record<string, any>
    expectedResult?: any
  }> {
    return this.schema.examples || []
  }

  /**
   * 转换为OpenAPI规范格式
   */
  toOpenAPISchema(): object {
    return {
      type: 'object',
      properties: Object.entries(this.schema.parameters).reduce((props, [name, schema]) => {
        props[name] = this.parameterSchemaToOpenAPI(schema)
        return props
      }, {} as any),
      required: this.getRequiredParameters()
    }
  }

  /**
   * 转换参数模式为OpenAPI格式
   */
  private parameterSchemaToOpenAPI(schema: IParameterSchema): object {
    const openApiSchema: any = {
      type: schema.type,
      description: schema.description
    }

    if (schema.default !== undefined) openApiSchema.default = schema.default
    if (schema.enum) openApiSchema.enum = schema.enum
    if (schema.pattern) openApiSchema.pattern = schema.pattern
    if (schema.minimum !== undefined) openApiSchema.minimum = schema.minimum
    if (schema.maximum !== undefined) openApiSchema.maximum = schema.maximum
    if (schema.minLength !== undefined) openApiSchema.minLength = schema.minLength
    if (schema.maxLength !== undefined) openApiSchema.maxLength = schema.maxLength

    if (schema.type === 'array' && schema.items) {
      openApiSchema.items = this.parameterSchemaToOpenAPI(schema.items)
    }

    if (schema.type === 'object' && schema.properties) {
      openApiSchema.properties = Object.entries(schema.properties).reduce((props, [name, propSchema]) => {
        props[name] = this.parameterSchemaToOpenAPI(propSchema)
        return props
      }, {} as any)
    }

    return openApiSchema
  }

  /**
   * 相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof ToolSchema)) return false
    return JSON.stringify(this.schema) === JSON.stringify(other.schema)
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return JSON.stringify(this.schema)
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return `${this.schema.name}: ${this.schema.description}`
  }

  /**
   * 转换为JSON
   */
  toJSON(): string {
    return JSON.stringify(this.schema, null, 2)
  }

  /**
   * 验证模式定义
   */
  protected validate(): void {
    if (!this.schema) {
      throw new Error('Schema definition is required')
    }

    if (!this.schema.name || typeof this.schema.name !== 'string') {
      throw new Error('Schema name must be a non-empty string')
    }

    if (!this.schema.description || typeof this.schema.description !== 'string') {
      throw new Error('Schema description must be a non-empty string')
    }

    if (!this.schema.parameters || typeof this.schema.parameters !== 'object') {
      throw new Error('Schema parameters must be an object')
    }

    // 验证每个参数定义
    for (const [paramName, paramSchema] of Object.entries(this.schema.parameters)) {
      this.validateParameterSchema(paramName, paramSchema)
    }
  }

  /**
   * 验证参数模式定义
   */
  private validateParameterSchema(paramName: string, schema: IParameterSchema): void {
    if (!schema.name || typeof schema.name !== 'string') {
      throw new Error(`Parameter ${paramName} must have a name`)
    }

    if (!['string', 'number', 'boolean', 'object', 'array'].includes(schema.type)) {
      throw new Error(`Parameter ${paramName} has invalid type: ${schema.type}`)
    }

    if (schema.pattern && schema.type !== 'string') {
      throw new Error(`Parameter ${paramName} pattern can only be used with string type`)
    }

    if ((schema.minimum !== undefined || schema.maximum !== undefined) && schema.type !== 'number') {
      throw new Error(`Parameter ${paramName} minimum/maximum can only be used with number type`)
    }

    if ((schema.minLength !== undefined || schema.maxLength !== undefined) && schema.type !== 'string') {
      throw new Error(`Parameter ${paramName} minLength/maxLength can only be used with string type`)
    }
  }
}