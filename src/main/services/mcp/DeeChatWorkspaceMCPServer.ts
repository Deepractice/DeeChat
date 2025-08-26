/**
 * DeeChat工作区MCP服务器
 * 提供独立的工作区文件操作工具，完全解耦于PromptX
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import * as path from 'path'
import * as fs from 'fs/promises'
import { existsSync } from 'fs'
import { DeeChatDirectoryService } from '../../../shared/services/DeeChatDirectoryService'

interface WorkspaceFileInfo {
  id: string
  name: string
  path: string
  size: number
  lastModified: Date
  type: string
}

export class DeeChatWorkspaceMCPServer {
  private server: Server
  private directoryService: DeeChatDirectoryService

  constructor() {
    this.directoryService = DeeChatDirectoryService.getInstance()
    
    this.server = new Server(
      {
        name: 'deechat-workspace',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupHandlers()
  }

  /**
   * 获取工具定义列表 - 兼容InProcessMCPServer的调用
   */
  getToolDefinitions() {
    return [
      {
        name: 'deechat_workspace_read',
        description: 'Read a file from DeeChat workspace',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the file within workspace (relative or absolute)',
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'deechat_workspace_write',
        description: 'Write content to a file in DeeChat workspace',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the file within workspace',
            },
            content: {
              type: 'string',
              description: 'Content to write to the file',
            },
            overwrite: {
              type: 'boolean',
              description: 'Whether to overwrite existing file (default: false)',
              default: false,
            },
          },
          required: ['file_path', 'content'],
        },
      },
      {
        name: 'deechat_workspace_list',
        description: 'List all files in DeeChat workspace',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Optional file pattern filter (e.g., "*.txt")',
            },
            include_temp: {
              type: 'boolean',
              description: 'Include temporary files (default: false)',
              default: false,
            },
          },
        },
      },
      {
        name: 'deechat_workspace_diff',
        description: 'Compare two files in DeeChat workspace',
        inputSchema: {
          type: 'object',
          properties: {
            file1_path: {
              type: 'string',
              description: 'Path to the first file',
            },
            file2_path: {
              type: 'string',
              description: 'Path to the second file',
            },
            format: {
              type: 'string',
              enum: ['unified', 'side-by-side', 'json'],
              description: 'Diff output format',
              default: 'unified',
            },
          },
          required: ['file1_path', 'file2_path'],
        },
      },
      {
        name: 'deechat_workspace_stats',
        description: 'Get statistics about DeeChat workspace',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'deechat_workspace_delete',
        description: 'Delete a file from DeeChat workspace',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the file to delete',
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag (required for safety)',
            },
          },
          required: ['file_path', 'confirm'],
        },
      },
    ]
  }

  private setupHandlers() {
    // 工具列表
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'deechat_workspace_read',
            description: 'Read a file from DeeChat workspace',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to the file within workspace (relative or absolute)',
                },
              },
              required: ['file_path'],
            },
          },
          {
            name: 'deechat_workspace_write',
            description: 'Write content to a file in DeeChat workspace',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to the file within workspace',
                },
                content: {
                  type: 'string',
                  description: 'Content to write to the file',
                },
                overwrite: {
                  type: 'boolean',
                  description: 'Whether to overwrite existing file (default: false)',
                  default: false,
                },
              },
              required: ['file_path', 'content'],
            },
          },
          {
            name: 'deechat_workspace_list',
            description: 'List all files in DeeChat workspace',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'Optional file pattern filter (e.g., "*.txt")',
                },
                include_temp: {
                  type: 'boolean',
                  description: 'Include temporary files (default: false)',
                  default: false,
                },
              },
            },
          },
          {
            name: 'deechat_workspace_diff',
            description: 'Compare two files in DeeChat workspace',
            inputSchema: {
              type: 'object',
              properties: {
                file1_path: {
                  type: 'string',
                  description: 'Path to the first file',
                },
                file2_path: {
                  type: 'string',
                  description: 'Path to the second file',
                },
                format: {
                  type: 'string',
                  enum: ['unified', 'side-by-side', 'json'],
                  description: 'Diff output format',
                  default: 'unified',
                },
              },
              required: ['file1_path', 'file2_path'],
            },
          },
          {
            name: 'deechat_workspace_stats',
            description: 'Get statistics about DeeChat workspace',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'deechat_workspace_delete',
            description: 'Delete a file from DeeChat workspace',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path to the file to delete',
                },
                confirm: {
                  type: 'boolean',
                  description: 'Confirmation flag (required for safety)',
                },
              },
              required: ['file_path', 'confirm'],
            },
          },
        ],
      }
    })

    // 工具调用处理
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case 'deechat_workspace_read':
            return await this.handleRead(args as { file_path: string })

          case 'deechat_workspace_write':
            return await this.handleWrite(args as { 
              file_path: string
              content: string
              overwrite?: boolean 
            })

          case 'deechat_workspace_list':
            return await this.handleList(args as { 
              pattern?: string
              include_temp?: boolean 
            })

          case 'deechat_workspace_diff':
            return await this.handleDiff(args as { 
              file1_path: string
              file2_path: string
              format?: string 
            })

          case 'deechat_workspace_stats':
            return await this.handleStats()

          case 'deechat_workspace_delete':
            return await this.handleDelete(args as { 
              file_path: string
              confirm: boolean 
            })

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            )
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`)
      }
    })
  }

  private async handleRead(args: { file_path: string }) {
    const filePath = this.resolveWorkspacePath(args.file_path)
    
    if (!existsSync(filePath)) {
      throw new McpError(ErrorCode.InvalidParams, `File not found: ${args.file_path}`)
    }

    if (!(await this.directoryService.isFileInWorkspace(filePath))) {
      throw new McpError(ErrorCode.InvalidParams, `File is outside workspace: ${args.file_path}`)
    }

    const content = await fs.readFile(filePath, 'utf-8')
    const stat = await fs.stat(filePath)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            file_path: args.file_path,
            content: content,
            size: stat.size,
            last_modified: stat.mtime.toISOString(),
            success: true
          }, null, 2)
        }
      ]
    }
  }

  private async handleWrite(args: { file_path: string; content: string; overwrite?: boolean }) {
    const filePath = this.resolveWorkspacePath(args.file_path)
    
    if (existsSync(filePath) && !args.overwrite) {
      throw new McpError(ErrorCode.InvalidParams, `File exists and overwrite is false: ${args.file_path}`)
    }

    // 确保目录存在
    const dir = path.dirname(filePath)
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true })
    }

    await fs.writeFile(filePath, args.content, 'utf-8')
    const stat = await fs.stat(filePath)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            file_path: args.file_path,
            size: stat.size,
            last_modified: stat.mtime.toISOString(),
            success: true,
            action: existsSync(filePath) ? 'updated' : 'created'
          }, null, 2)
        }
      ]
    }
  }

  private async handleList(args: { pattern?: string; include_temp?: boolean }) {
    const files: WorkspaceFileInfo[] = []
    
    // 扫描文档目录
    await this.scanDirectory(this.directoryService.getDocumentsDir(), files, 'documents')
    
    // 可选扫描临时目录
    if (args.include_temp) {
      await this.scanDirectory(this.directoryService.getTempDir(), files, 'temp')
    }

    // 应用模式过滤
    let filteredFiles = files
    if (args.pattern) {
      const regex = new RegExp(args.pattern.replace(/\*/g, '.*'))
      filteredFiles = files.filter(file => regex.test(file.name))
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total_files: filteredFiles.length,
            workspace_dir: this.directoryService.getWorkspaceDir(),
            files: filteredFiles,
            success: true
          }, null, 2)
        }
      ]
    }
  }

  private async handleDiff(args: { file1_path: string; file2_path: string; format?: string }) {
    const file1Path = this.resolveWorkspacePath(args.file1_path)
    const file2Path = this.resolveWorkspacePath(args.file2_path)

    if (!existsSync(file1Path)) {
      throw new McpError(ErrorCode.InvalidParams, `First file not found: ${args.file1_path}`)
    }

    if (!existsSync(file2Path)) {
      throw new McpError(ErrorCode.InvalidParams, `Second file not found: ${args.file2_path}`)
    }

    const content1 = await fs.readFile(file1Path, 'utf-8')
    const content2 = await fs.readFile(file2Path, 'utf-8')

    // 简单的行差异比较
    const lines1 = content1.split('\n')
    const lines2 = content2.split('\n')
    const diff = this.computeSimpleDiff(lines1, lines2)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            file1: args.file1_path,
            file2: args.file2_path,
            format: args.format || 'unified',
            differences: diff,
            success: true
          }, null, 2)
        }
      ]
    }
  }

  private async handleStats() {
    const stats = await this.directoryService.getDirectoryStats()
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            workspace_directory: this.directoryService.getWorkspaceDir(),
            ...stats,
            success: true
          }, null, 2)
        }
      ]
    }
  }

  private async handleDelete(args: { file_path: string; confirm: boolean }) {
    if (!args.confirm) {
      throw new McpError(ErrorCode.InvalidParams, 'Deletion requires confirmation flag')
    }

    const filePath = this.resolveWorkspacePath(args.file_path)
    
    if (!existsSync(filePath)) {
      throw new McpError(ErrorCode.InvalidParams, `File not found: ${args.file_path}`)
    }

    if (!(await this.directoryService.isFileInWorkspace(filePath))) {
      throw new McpError(ErrorCode.InvalidParams, `File is outside workspace: ${args.file_path}`)
    }

    await fs.unlink(filePath)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            file_path: args.file_path,
            action: 'deleted',
            success: true
          }, null, 2)
        }
      ]
    }
  }

  private resolveWorkspacePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath
    }
    return this.directoryService.getDocumentPath(filePath)
  }

  private async scanDirectory(dirPath: string, files: WorkspaceFileInfo[], type: string) {
    if (!existsSync(dirPath)) {
      return
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(dirPath, entry.name)
        const stat = await fs.stat(filePath)
        const relativePath = this.directoryService.getRelativePathInWorkspace(filePath)
        
        files.push({
          id: `${type}_${entry.name}`,
          name: entry.name,
          path: relativePath,
          size: stat.size,
          lastModified: stat.mtime,
          type: path.extname(entry.name).toLowerCase() || 'unknown'
        })
      }
    }
  }

  private computeSimpleDiff(lines1: string[], lines2: string[]): any[] {
    const diff = []
    const maxLines = Math.max(lines1.length, lines2.length)
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || ''
      const line2 = lines2[i] || ''
      
      if (line1 !== line2) {
        diff.push({
          line: i + 1,
          type: line1 === '' ? 'added' : line2 === '' ? 'removed' : 'changed',
          old_content: line1,
          new_content: line2
        })
      }
    }
    
    return diff
  }

  async start() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.log('✅ [DeeChat] MCP工作区服务器已启动')
  }
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  const server = new DeeChatWorkspaceMCPServer()
  server.start().catch((error) => {
    console.error('❌ [DeeChat] MCP服务器启动失败:', error)
    process.exit(1)
  })
}