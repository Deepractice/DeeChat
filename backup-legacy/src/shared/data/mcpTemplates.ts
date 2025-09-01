/**
 * MCP市场预置模板数据
 * 提供常用MCP服务器的一键安装配置
 */

export interface MCPTemplate {
  id: string;
  name: string;
  icon: string;          // 图标字母或字符
  description: string;   // 简短描述
  category: string;      // 分类
  status: 'local' | 'remote';
  popularity: number;    // 热度排序(1-10)
  tags: string[];        // 标签
  
  // 自动配置信息
  autoConfig: {
    command: string;
    args: string[];
    transport: 'stdio' | 'sse';
    workingDirectory?: string;
    env?: Record<string, string>;
    requiresSetup?: boolean;
    setupPrompts?: SetupPrompt[];
  };
  
  // 元信息
  meta: {
    author: string;
    version: string;
    website?: string;
    documentation?: string;
    repository?: string;
  };
}

export interface SetupPrompt {
  field: string;
  label: string;
  type: 'text' | 'password' | 'path' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];  // for select type
  defaultValue?: string;
}

// MCP市场模板数据 - 只包含官方和真实可用的MCP服务器
export const MCPTemplates: MCPTemplate[] = [
  {
    id: 'filesystem',
    name: 'File System',
    icon: 'F',
    description: '文件读写、目录浏览和文件管理功能',
    category: '开发工具',
    status: 'local',
    popularity: 9,
    tags: ['文件', '开发', '本地'],
    autoConfig: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/'],
      transport: 'stdio',
      requiresSetup: true,
      setupPrompts: [
        {
          field: 'rootPath',
          label: '根目录路径',
          type: 'path',
          required: true,
          placeholder: '/Users/username/projects',
          defaultValue: '/Users/username/projects'
        }
      ]
    },
    meta: {
      author: 'Anthropic',
      version: '0.1.0',
      repository: 'https://github.com/modelcontextprotocol/servers',
      documentation: 'https://modelcontextprotocol.io/docs/servers/filesystem'
    }
  },

  {
    id: 'github',
    name: 'GitHub',
    icon: 'G',
    description: 'GitHub API集成，仓库管理和代码搜索',
    category: '开发工具',
    status: 'remote',
    popularity: 8,
    tags: ['Git', '代码', '协作'],
    autoConfig: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-github'],
      transport: 'stdio',
      requiresSetup: true,
      setupPrompts: [
        {
          field: 'GITHUB_TOKEN',
          label: 'GitHub访问令牌',
          type: 'password',
          required: true,
          placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx'
        }
      ]
    },
    meta: {
      author: 'Anthropic',
      version: '0.1.0',
      repository: 'https://github.com/modelcontextprotocol/servers',
      documentation: 'https://modelcontextprotocol.io/docs/servers/github'
    }
  },

  {
    id: 'sqlite',
    name: 'SQLite',
    icon: 'S',
    description: 'SQLite数据库查询和管理功能',
    category: '数据处理',
    status: 'local',
    popularity: 7,
    tags: ['数据库', 'SQL', '本地'],
    autoConfig: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-sqlite', '/path/to/database.db'],
      transport: 'stdio',
      requiresSetup: true,
      setupPrompts: [
        {
          field: 'databasePath',
          label: '数据库文件路径',
          type: 'path',
          required: true,
          placeholder: '/path/to/your/database.db'
        }
      ]
    },
    meta: {
      author: 'Anthropic',
      version: '0.1.0',
      repository: 'https://github.com/modelcontextprotocol/servers',
      documentation: 'https://modelcontextprotocol.io/docs/servers/sqlite'
    }
  },

  {
    id: 'brave-search',
    name: 'Brave Search',
    icon: 'B',
    description: 'Brave搜索引擎API集成',
    category: '网络服务',
    status: 'remote',
    popularity: 6,
    tags: ['搜索', 'API', '网络'],
    autoConfig: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-brave-search'],
      transport: 'stdio',
      requiresSetup: true,
      setupPrompts: [
        {
          field: 'BRAVE_API_KEY',
          label: 'Brave API密钥',
          type: 'password',
          required: true,
          placeholder: 'your-brave-api-key'
        }
      ]
    },
    meta: {
      author: 'Anthropic',
      version: '0.1.0',
      repository: 'https://github.com/modelcontextprotocol/servers',
      documentation: 'https://modelcontextprotocol.io/docs/servers/brave-search'
    }
  },

  {
    id: 'postgres',
    name: 'PostgreSQL',
    icon: 'P',
    description: 'PostgreSQL数据库读取和查询功能',
    category: '数据处理',
    status: 'remote',
    popularity: 6,
    tags: ['数据库', 'SQL', '查询'],
    autoConfig: {
      command: 'npx',
      args: ['@modelcontextprotocol/server-postgres'],
      transport: 'stdio',
      requiresSetup: true,
      setupPrompts: [
        {
          field: 'DATABASE_URL',
          label: '数据库连接字符串',
          type: 'text',
          required: true,
          placeholder: 'postgresql://user:password@localhost:5432/dbname'
        }
      ]
    },
    meta: {
      author: 'Anthropic',
      version: '0.1.0',
      repository: 'https://github.com/modelcontextprotocol/servers',
      documentation: 'https://modelcontextprotocol.io/docs/servers/postgres'
    }
  }
];

// 按分类分组模板
export const MCPTemplatesByCategory = MCPTemplates.reduce((acc, template) => {
  const category = template.category;
  if (!acc[category]) {
    acc[category] = [];
  }
  acc[category].push(template);
  return acc;
}, {} as Record<string, MCPTemplate[]>);

// 获取所有分类
export const MCPCategories = Object.keys(MCPTemplatesByCategory);

// 按热度排序
export const MCPTemplatesByPopularity = [...MCPTemplates].sort((a, b) => b.popularity - a.popularity);