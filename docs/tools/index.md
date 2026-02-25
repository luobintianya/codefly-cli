# Gemini CLI tools

Gemini CLI uses tools to interact with your local environment, access
information, and perform actions on your behalf. These tools extend the model's
capabilities beyond text generation, letting it read files, execute commands,
and search the web.

## User-triggered tools

You can directly trigger these tools using special syntax in your prompts.

- **[File access](./file-system.md#read_many_files) (`@`):** Use the `@` symbol
  followed by a file or directory path to include its content in your prompt.
  This triggers the `read_many_files` tool.
- **[Shell commands](./shell.md) (`!`):** Use the `!` symbol followed by a
  system command to execute it directly. This triggers the `run_shell_command`
  tool.

## Model-triggered tools

The Gemini model automatically requests these tools when it needs to perform
specific actions or gather information to fulfill your requests. You do not call
these tools manually.

### File management

These tools let the model explore and modify your local codebase.

- **[Directory listing](./file-system.md#list_directory) (`list_directory`):**
  Lists files and subdirectories.
- **[File reading](./file-system.md#read_file) (`read_file`):** Reads the
  content of a specific file.
- **[File writing](./file-system.md#write_file) (`write_file`):** Creates or
  overwrites a file with new content.
- **[File search](./file-system.md#glob) (`glob`):** Finds files matching a glob
  pattern.
- **[Text search](./file-system.md#search_file_content)
  (`search_file_content`):** Searches for text within files using grep or
  ripgrep.
- **[Text replacement](./file-system.md#replace) (`replace`):** Performs precise
  edits within a file.

### Agent coordination

These tools help the model manage its plan and interact with you.

- **Ask user (`ask_user`):** Requests clarification or missing information from
  you via an interactive dialog.
- **[Memory](./memory.md) (`save_memory`):** Saves important facts to your
  long-term memory (`GEMINI.md`).
- **[Todos](./todos.md) (`write_todos`):** Manages a list of subtasks for
  complex plans.
- **[Agent Skills](../cli/skills.md) (`activate_skill`):** Loads specialized
  procedural expertise when needed.
- **[Browser agent](../core/subagents.md#browser-agent-experimental)
  (`browser_agent`):** Automates web browser tasks through the accessibility
  tree.
- **Internal docs (`get_internal_docs`):** Accesses Gemini CLI's own
  documentation to help answer your questions.

### Information gathering

These tools provide the model with access to external data.

- **[Web fetch](./web-fetch.md) (`web_fetch`):** Retrieves and processes content
  from specific URLs.
- **[Web search](./web-search.md) (`google_web_search`):** Performs a Google
  Search to find up-to-date information.

## How to use tools

You use tools indirectly by providing natural language prompts to Gemini CLI.

1.  **Prompt:** You enter a request or use syntax like `@` or `!`.
2.  **Request:** The model analyzes your request and identifies if a tool is
    required.
3.  **Validation:** If a tool is needed, the CLI validates the parameters and
    checks your security settings.
4.  **Confirmation:** For sensitive operations (like writing files), the CLI
    prompts you for approval.
5.  **Execution:** The tool runs, and its output is sent back to the model.
6.  **Response:** The model uses the results to generate a final, grounded
    answer.

## Security and confirmation

Safety is a core part of the tool system. To protect your system, Gemini CLI
implements several safeguards.

- **User confirmation:** You must manually approve tools that modify files or
  execute shell commands. The CLI shows you a diff or the exact command before
  you confirm.
- **Sandboxing:** You can run tool executions in secure, containerized
  environments to isolate changes from your host system. For more details, see
  the [Sandboxing](../cli/sandbox.md) guide.
- **Trusted folders:** You can configure which directories allow the model to
  use system tools.

Always review confirmation prompts carefully before allowing a tool to execute.

## Next steps

Gemini CLI's built-in tools can be broadly categorized as follows:

- **[File System Tools](./file-system.md):** For interacting with files and
  directories (reading, writing, listing, searching, etc.).
- **[Shell Tool](./shell.md) (`run_shell_command`):** For executing shell
  commands.
- **[Web Fetch Tool](./web-fetch.md) (`web_fetch`):** For retrieving content
  from URLs.
- **[Web Search Tool](./web-search.md) (`google_web_search`):** For searching
  the web.
- **[Memory Tool](./memory.md) (`save_memory`):** For saving and recalling
  information across sessions.
- **[Todo Tool](./todos.md) (`write_todos`):** For managing subtasks of complex
  requests.
- **[Database Schema Tool](./database-schema.md) (`get_database_schema`):** For
  retrieving database table structures from MySQL or PostgreSQL databases.
- **[Swagger Schema Tool](./swagger-schema.md) (`get_swagger_schema`):** For
  fetching and parsing Swagger/OpenAPI schema definitions from URLs.

Additionally, these tools incorporate:

- **[MCP servers](./mcp-server.md)**: MCP servers act as a bridge between the
  Gemini model and your local environment or other services like APIs.
- **[Agent Skills](../cli/skills.md)**: (Experimental) On-demand expertise
  packages that are activated via the `activate_skill` tool to provide
  specialized guidance and resources.
- **[Sandboxing](../cli/sandbox.md)**: Sandboxing isolates the model and its
  changes from your environment to reduce potential risk.
