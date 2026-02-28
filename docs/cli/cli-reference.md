# Codefly CLI cheatsheet

This page provides a reference for commonly used Codefly CLI commands, options,
and parameters.

## CLI commands

| Command                            | Description                        | Example                                             |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------- |
| `codefly`                           | Start interactive REPL             | `codefly`                                            |
| `codefly "query"`                   | Query non-interactively, then exit | `codefly "explain this project"`                     |
| `cat file \| codefly`               | Process piped content              | `cat logs.txt \| codefly`                            |
| `codefly -i "query"`                | Execute and continue interactively | `codefly -i "What is the purpose of this project?"`  |
| `codefly -r "latest"`               | Continue most recent session       | `codefly -r "latest"`                                |
| `codefly -r "latest" "query"`       | Continue session with a new prompt | `codefly -r "latest" "Check for type errors"`        |
| `codefly -r "<session-id>" "query"` | Resume session by ID               | `codefly -r "abc123" "Finish this PR"`               |
| `codefly update`                    | Update to latest version           | `codefly update`                                     |
| `codefly extensions`                | Manage extensions                  | See [Extensions Management](#extensions-management) |
| `codefly mcp`                       | Configure MCP servers              | See [MCP Server Management](#mcp-server-management) |

### Positional arguments

| Argument | Type              | Description                                                                                                        |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `query`  | string (variadic) | Positional prompt. Defaults to one-shot mode. Use `-i/--prompt-interactive` to execute and continue interactively. |

## CLI Options

| Option                           | Alias | Type    | Default   | Description                                                                                                                                                            |
| -------------------------------- | ----- | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--debug`                        | `-d`  | boolean | `false`   | Run in debug mode with verbose logging                                                                                                                                 |
| `--version`                      | `-v`  | -       | -         | Show CLI version number and exit                                                                                                                                       |
| `--help`                         | `-h`  | -       | -         | Show help information                                                                                                                                                  |
| `--model`                        | `-m`  | string  | `auto`    | Model to use. See [Model Selection](#model-selection) for available values.                                                                                            |
| `--prompt`                       | `-p`  | string  | -         | Prompt text. Appended to stdin input if provided. **Deprecated:** Use positional arguments instead.                                                                    |
| `--prompt-interactive`           | `-i`  | string  | -         | Execute prompt and continue in interactive mode                                                                                                                        |
| `--sandbox`                      | `-s`  | boolean | `false`   | Run in a sandboxed environment for safer execution                                                                                                                     |
| `--approval-mode`                | -     | string  | `default` | Approval mode for tool execution. Choices: `default`, `auto_edit`, `yolo`                                                                                              |
| `--yolo`                         | `-y`  | boolean | `false`   | **Deprecated.** Auto-approve all actions. Use `--approval-mode=yolo` instead.                                                                                          |
| `--experimental-acp`             | -     | boolean | -         | Start in ACP (Agent Code Pilot) mode. **Experimental feature.**                                                                                                        |
| `--experimental-zed-integration` | -     | boolean | -         | Run in Zed editor integration mode. **Experimental feature.**                                                                                                          |
| `--allowed-mcp-server-names`     | -     | array   | -         | Allowed MCP server names (comma-separated or multiple flags)                                                                                                           |
| `--allowed-tools`                | -     | array   | -         | **Deprecated.** Use the [Policy Engine](../reference/policy-engine.md) instead. Tools that are allowed to run without confirmation (comma-separated or multiple flags) |
| `--extensions`                   | `-e`  | array   | -         | List of extensions to use. If not provided, all extensions are enabled (comma-separated or multiple flags)                                                             |
| `--list-extensions`              | `-l`  | boolean | -         | List all available extensions and exit                                                                                                                                 |
| `--resume`                       | `-r`  | string  | -         | Resume a previous session. Use `"latest"` for most recent or index number (e.g. `--resume 5`)                                                                          |
| `--list-sessions`                | -     | boolean | -         | List available sessions for the current project and exit                                                                                                               |
| `--delete-session`               | -     | string  | -         | Delete a session by index number (use `--list-sessions` to see available sessions)                                                                                     |
| `--include-directories`          | -     | array   | -         | Additional directories to include in the workspace (comma-separated or multiple flags)                                                                                 |
| `--screen-reader`                | -     | boolean | -         | Enable screen reader mode for accessibility                                                                                                                            |
| `--output-format`                | `-o`  | string  | `text`    | The format of the CLI output. Choices: `text`, `json`, `stream-json`                                                                                                   |

## Model selection

The `--model` (or `-m`) flag lets you specify which Codefly model to use. You can
use either model aliases (user-friendly names) or concrete model names.

### Model aliases

These are convenient shortcuts that map to specific models:

| Alias        | Resolves To                                | Description                                                                                                               |
| ------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `auto`       | `codefly-2.5-pro` or `codefly-3-pro-preview` | **Default.** Resolves to the preview model if preview features are enabled, otherwise resolves to the standard pro model. |
| `pro`        | `codefly-2.5-pro` or `codefly-3-pro-preview` | For complex reasoning tasks. Uses preview model if enabled.                                                               |
| `flash`      | `codefly-2.5-flash`                         | Fast, balanced model for most tasks.                                                                                      |
| `flash-lite` | `codefly-2.5-flash-lite`                    | Fastest model for simple tasks.                                                                                           |

## Extensions management

| Command                                            | Description                                  | Example                                                                        |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `codefly extensions install <source>`               | Install extension from Git URL or local path | `codefly extensions install https://github.com/user/my-extension`               |
| `codefly extensions install <source> --ref <ref>`   | Install from specific branch/tag/commit      | `codefly extensions install https://github.com/user/my-extension --ref develop` |
| `codefly extensions install <source> --auto-update` | Install with auto-update enabled             | `codefly extensions install https://github.com/user/my-extension --auto-update` |
| `codefly extensions uninstall <name>`               | Uninstall one or more extensions             | `codefly extensions uninstall my-extension`                                     |
| `codefly extensions list`                           | List all installed extensions                | `codefly extensions list`                                                       |
| `codefly extensions update <name>`                  | Update a specific extension                  | `codefly extensions update my-extension`                                        |
| `codefly extensions update --all`                   | Update all extensions                        | `codefly extensions update --all`                                               |
| `codefly extensions enable <name>`                  | Enable an extension                          | `codefly extensions enable my-extension`                                        |
| `codefly extensions disable <name>`                 | Disable an extension                         | `codefly extensions disable my-extension`                                       |
| `codefly extensions link <path>`                    | Link local extension for development         | `codefly extensions link /path/to/extension`                                    |
| `codefly extensions new <path>`                     | Create new extension from template           | `codefly extensions new ./my-extension`                                         |
| `codefly extensions validate <path>`                | Validate extension structure                 | `codefly extensions validate ./my-extension`                                    |

See [Extensions Documentation](../extensions/index.md) for more details.

## MCP server management

| Command                                                       | Description                     | Example                                                                                              |
| ------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `codefly mcp add <name> <command>`                             | Add stdio-based MCP server      | `codefly mcp add github npx -y @modelcontextprotocol/server-github`                                   |
| `codefly mcp add <name> <url> --transport http`                | Add HTTP-based MCP server       | `codefly mcp add api-server http://localhost:3000 --transport http`                                   |
| `codefly mcp add <name> <command> --env KEY=value`             | Add with environment variables  | `codefly mcp add slack node server.js --env SLACK_TOKEN=xoxb-xxx`                                     |
| `codefly mcp add <name> <command> --scope user`                | Add with user scope             | `codefly mcp add db node db-server.js --scope user`                                                   |
| `codefly mcp add <name> <command> --include-tools tool1,tool2` | Add with specific tools         | `codefly mcp add github npx -y @modelcontextprotocol/server-github --include-tools list_repos,get_pr` |
| `codefly mcp remove <name>`                                    | Remove an MCP server            | `codefly mcp remove github`                                                                           |
| `codefly mcp list`                                             | List all configured MCP servers | `codefly mcp list`                                                                                    |

See [MCP Server Integration](../tools/mcp-server.md) for more details.

## Skills management

| Command                          | Description                           | Example                                           |
| -------------------------------- | ------------------------------------- | ------------------------------------------------- |
| `codefly skills list`             | List all discovered agent skills      | `codefly skills list`                              |
| `codefly skills install <source>` | Install skill from Git, path, or file | `codefly skills install https://github.com/u/repo` |
| `codefly skills link <path>`      | Link local agent skills via symlink   | `codefly skills link /path/to/my-skills`           |
| `codefly skills uninstall <name>` | Uninstall an agent skill              | `codefly skills uninstall my-skill`                |
| `codefly skills enable <name>`    | Enable an agent skill                 | `codefly skills enable my-skill`                   |
| `codefly skills disable <name>`   | Disable an agent skill                | `codefly skills disable my-skill`                  |
| `codefly skills enable --all`     | Enable all skills                     | `codefly skills enable --all`                      |
| `codefly skills disable --all`    | Disable all skills                    | `codefly skills disable --all`                     |

See [Agent Skills Documentation](./skills.md) for more details.
