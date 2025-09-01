/**
 * 唯一实体ID
 * 为实体提供唯一标识符
 */

export class UniqueEntityID {
  private readonly value: string

  constructor(value?: string) {
    this.value = value || this.generateUUID()
  }

  /**
   * 获取ID值
   */
  getValue(): string {
    return this.value
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return this.value
  }

  /**
   * ID相等性比较
   */
  equals(id?: UniqueEntityID): boolean {
    if (id === null || id === undefined) return false
    if (!(id instanceof UniqueEntityID)) return false
    return id.value === this.value
  }

  /**
   * 生成UUID格式的ID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}