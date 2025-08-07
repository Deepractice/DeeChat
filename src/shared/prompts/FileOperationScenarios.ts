/**
 * 文件操作使用场景指导
 * 定义AI应该在什么情况下使用文件操作工具，以及如何使用
 */

import { PromptSegment } from '../interfaces/ISystemPromptProvider';

/**
 * 文件操作使用场景提示词
 */
export const FILE_OPERATION_SCENARIOS_PROMPT = `## File Operation Usage Scenarios

### When to Use File Operations

**1. Project Analysis & Code Review**
- User asks about project structure → use list_directory (recursive)
- User asks about specific files → use get_file_info then read_file
- Code quality assessment → search_files for patterns, read key files
- Documentation review → search for README, docs, then read them

**2. File Management Tasks**
- User wants to create files → use create_directory then write_file
- Organizing project structure → use move_file and copy_file
- Cleaning up files → use delete_file (with user confirmation)
- Backup operations → use copy_file for important files

**3. Content Creation & Editing**
- Generate code files → create_directory + write_file
- Configuration files → read existing, modify, write_file
- Documentation → create structured docs with write_file
- Templates and boilerplate → copy_file from templates

**4. Search & Discovery**
- Finding files by name → search_files with pattern matching
- Content-based search → search_files with content parameter  
- Locating configuration → search for common config patterns
- Dependency analysis → search for import/require patterns

**5. Information Gathering**
- Project overview → list_directory + read key files (package.json, README)
- Technology stack identification → search for config files, read them
- Code structure analysis → recursive directory listing + selective reading

### Usage Patterns & Best Practices

**Start with Structure Understanding**
\`\`\`
1. list_directory (project root)
2. get_file_info (key files identified)
3. read_file (selected important files)
4. Provide analysis/insights
\`\`\`

**File Search & Analysis**
\`\`\`
1. search_files (by pattern or content)
2. get_file_info (candidates found)
3. read_file (most relevant files)
4. Present findings with context
\`\`\`

**Content Creation Workflow**
\`\`\`
1. list_directory (understand existing structure)
2. create_directory (if needed)
3. write_file (create new content)
4. get_file_info (verify creation)
\`\`\`

### Context-Aware Decision Making

**Before File Operations, Consider:**
- What does the user actually need to know?
- Is a full file read necessary or just metadata?
- Should I explore the entire project or focus on specific areas?
- What's the most efficient path to the answer?

**Security & User Experience:**
- Always respect path restrictions and security boundaries
- Inform users about significant operations (especially deletions)
- Provide context for file operations - explain why you're reading/writing
- Handle errors gracefully and suggest alternatives

**Performance Considerations:**
- Don't read large files unnecessarily
- Use get_file_info to check file sizes before reading
- For large directories, use selective reading vs full recursive listing
- Batch related operations when possible

### Common Anti-Patterns to Avoid

❌ **Don't**: Read every file in a large project without purpose
✅ **Do**: Use list_directory to understand structure first

❌ **Don't**: Modify files without understanding user intent
✅ **Do**: Confirm significant changes with users

❌ **Don't**: Search blindly through all files
✅ **Do**: Use targeted search patterns based on context

❌ **Don't**: Ignore file operation errors
✅ **Do**: Handle errors gracefully and provide alternatives`;

/**
 * 创建文件操作场景相关的提示词片段
 */
export function createFileOperationScenarioSegment(): PromptSegment {
  return {
    id: 'file-operation-scenarios',
    content: FILE_OPERATION_SCENARIOS_PROMPT,
    enabled: true,
    priority: 740, // 在基础文件操作指导之后，在其他工具之前
    condition: () => {
      // 仅在文件操作工具可用时启用
      return true; // 文件操作工具是内置的，总是可用
    }
  };
}