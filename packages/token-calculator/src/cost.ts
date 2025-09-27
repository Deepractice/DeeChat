import { TokenUsage, CostEstimate, ModelPricing, Provider, ModelInfo } from './types'
import { TokenCalculator } from './calculator'

export class CostCalculator {
  private calculator: TokenCalculator
  private pricingData: Map<string, ModelPricing> = new Map()

  constructor(calculator: TokenCalculator) {
    this.calculator = calculator
    this.initializePricing()
  }

  private initializePricing(): void {
    // OpenAI模型定价 (2024年价格，单位：USD per 1K tokens)
    this.pricingData.set('gpt-4', {
      inputPrice: 0.03,
      outputPrice: 0.06,
      currency: 'USD'
    })

    this.pricingData.set('gpt-4-turbo', {
      inputPrice: 0.01,
      outputPrice: 0.03,
      currency: 'USD'
    })

    this.pricingData.set('gpt-4o', {
      inputPrice: 0.005,
      outputPrice: 0.015,
      currency: 'USD'
    })

    this.pricingData.set('gpt-3.5-turbo', {
      inputPrice: 0.001,
      outputPrice: 0.002,
      currency: 'USD'
    })

    this.pricingData.set('text-davinci-003', {
      inputPrice: 0.02,
      outputPrice: 0.02,
      currency: 'USD'
    })

    // Anthropic模型定价 (单位：USD per 1K tokens，实际按1M计价)
    this.pricingData.set('claude-3-opus', {
      inputPrice: 0.015,   // $15 per 1M tokens
      outputPrice: 0.075,  // $75 per 1M tokens
      currency: 'USD'
    })

    this.pricingData.set('claude-3-sonnet', {
      inputPrice: 0.003,   // $3 per 1M tokens
      outputPrice: 0.015,  // $15 per 1M tokens
      currency: 'USD'
    })

    this.pricingData.set('claude-3-haiku', {
      inputPrice: 0.00025, // $0.25 per 1M tokens
      outputPrice: 0.00125, // $1.25 per 1M tokens
      currency: 'USD'
    })

    this.pricingData.set('claude-3-5-sonnet', {
      inputPrice: 0.003,
      outputPrice: 0.015,
      currency: 'USD'
    })

    this.pricingData.set('claude-2.1', {
      inputPrice: 0.008,
      outputPrice: 0.024,
      currency: 'USD'
    })

    this.pricingData.set('claude-2', {
      inputPrice: 0.008,
      outputPrice: 0.024,
      currency: 'USD'
    })

    this.pricingData.set('claude-instant-1.2', {
      inputPrice: 0.0008,
      outputPrice: 0.0024,
      currency: 'USD'
    })
  }

  // 基于token使用量估算成本
  estimateCost(usage: TokenUsage, model: string): CostEstimate {
    const pricing = this.getPricing(model)
    
    const inputCost = (usage.inputTokens / 1000) * pricing.inputPrice
    const outputCost = ((usage.outputTokens || 0) / 1000) * pricing.outputPrice
    const totalCost = inputCost + outputCost

    return {
      inputCost: this.roundCost(inputCost),
      outputCost: this.roundCost(outputCost),
      totalCost: this.roundCost(totalCost),
      currency: pricing.currency
    }
  }

  // 基于文本直接估算成本
  estimateCostFromText(
    inputText: string, 
    outputTokens: number = 0, 
    model: string,
    provider?: Provider | string
  ): CostEstimate {
    const inputTokens = this.calculator.count(inputText, provider, model)
    const usage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    }
    
    return this.estimateCost(usage, model)
  }

  // 比较不同模型的成本
  compareCosts(
    inputText: string, 
    outputTokens: number = 0,
    models: string[]
  ): { model: string; cost: CostEstimate; tokens: number }[] {
    return models.map(model => {
      try {
        const provider = this.calculator.autoDetectProvider(model)
        const tokens = this.calculator.count(inputText, provider, model)
        const usage: TokenUsage = {
          inputTokens: tokens,
          outputTokens,
          totalTokens: tokens + outputTokens
        }
        const cost = this.estimateCost(usage, model)
        
        return { model, cost, tokens }
      } catch (error) {
        return {
          model,
          cost: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
          tokens: 0
        }
      }
    })
  }

  // 获取最经济的模型建议
  getMostEconomical(
    inputText: string,
    outputTokens: number = 0,
    models?: string[]
  ): { model: string; cost: CostEstimate; savings?: number } {
    const modelsToCompare = models || [
      'gpt-3.5-turbo', 'gpt-4', 'gpt-4o',
      'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'
    ]
    
    const comparisons = this.compareCosts(inputText, outputTokens, modelsToCompare)
    const validComparisons = comparisons.filter(c => c.cost.totalCost > 0)
    
    if (validComparisons.length === 0) {
      throw new Error('No valid cost comparisons available')
    }
    
    // 找到最便宜的
    const cheapest = validComparisons.reduce((min, current) => 
      current.cost.totalCost < min.cost.totalCost ? current : min
    )
    
    // 计算相对于最贵的节省
    const mostExpensive = validComparisons.reduce((max, current) => 
      current.cost.totalCost > max.cost.totalCost ? current : max
    )
    
    const savings = mostExpensive.cost.totalCost - cheapest.cost.totalCost
    
    return {
      model: cheapest.model,
      cost: cheapest.cost,
      savings: savings > 0 ? this.roundCost(savings) : undefined
    }
  }

  // 计算月度成本估算
  estimateMonthlyCost(
    dailyInputTokens: number,
    dailyOutputTokens: number,
    model: string,
    daysPerMonth: number = 30
  ): CostEstimate {
    const dailyUsage: TokenUsage = {
      inputTokens: dailyInputTokens,
      outputTokens: dailyOutputTokens,
      totalTokens: dailyInputTokens + dailyOutputTokens
    }
    
    const dailyCost = this.estimateCost(dailyUsage, model)
    
    return {
      inputCost: this.roundCost(dailyCost.inputCost * daysPerMonth),
      outputCost: this.roundCost(dailyCost.outputCost * daysPerMonth),
      totalCost: this.roundCost(dailyCost.totalCost * daysPerMonth),
      currency: dailyCost.currency
    }
  }

  // 获取定价信息
  getPricing(model: string): ModelPricing {
    const pricing = this.pricingData.get(model)
    if (!pricing) {
      console.warn(`No pricing data for model: ${model}, using default`)
      return {
        inputPrice: 0.01,  // 默认价格
        outputPrice: 0.02,
        currency: 'USD'
      }
    }
    return pricing
  }

  // 更新定价数据
  updatePricing(model: string, pricing: ModelPricing): void {
    this.pricingData.set(model, pricing)
  }

  // 获取所有支持定价的模型
  getSupportedModels(): string[] {
    return Array.from(this.pricingData.keys())
  }

  // 批量成本估算
  batchEstimateCost(
    texts: string[],
    outputTokensPerText: number = 0,
    model: string,
    provider?: Provider | string
  ): { text: string; cost: CostEstimate; index: number }[] {
    return texts.map((text, index) => {
      try {
        const cost = this.estimateCostFromText(text, outputTokensPerText, model, provider)
        return { text, cost, index }
      } catch (error) {
        return {
          text,
          cost: { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' },
          index
        }
      }
    })
  }

  // 成本预算检查
  checkBudget(
    inputText: string,
    outputTokens: number,
    model: string,
    budget: number,
    provider?: Provider | string
  ): { withinBudget: boolean; cost: CostEstimate; remaining?: number; overage?: number } {
    const cost = this.estimateCostFromText(inputText, outputTokens, model, provider)
    const withinBudget = cost.totalCost <= budget
    
    return {
      withinBudget,
      cost,
      remaining: withinBudget ? this.roundCost(budget - cost.totalCost) : undefined,
      overage: !withinBudget ? this.roundCost(cost.totalCost - budget) : undefined
    }
  }

  // 辅助方法：四舍五入成本到4位小数
  private roundCost(cost: number): number {
    return Math.round(cost * 10000) / 10000
  }
}