# Codefly CLI

Within Codefly CLI, `packages/cli` is the frontend for users to send and receive
prompts with the Codefly AI model and its associated tools. For a general
overview of Codefly CLI, see the [main documentation page](../index.md).

## Basic features

- **[Commands](./commands.md):** A reference for all built-in slash commands
- **[Custom commands](./custom-commands.md):** Create your own commands and
  shortcuts for frequently used prompts.
- **[Headless mode](./headless.md):** Use Codefly CLI programmatically for
  scripting and automation.
- **[Model selection](./model.md):** Configure the Codefly AI model used by the
  CLI.
- **[Settings](./settings.md):** Configure various aspects of the CLI's behavior
  and appearance.
- **[Themes](./themes.md):** Customizing the CLI's appearance with different
  themes.
- **[Keyboard shortcuts](./keyboard-shortcuts.md):** A reference for all
  keyboard shortcuts to improve your workflow.
- **[Tutorials](./tutorials.md):** Step-by-step guides for common tasks.

## Advanced features

- **[Checkpointing](./checkpointing.md):** Automatically save and restore
  snapshots of your session and files.
- **[Enterprise configuration](./enterprise.md):** Deploy and manage Codefly CLI
  in an enterprise environment.
- **[Sandboxing](./sandbox.md):** Isolate tool execution in a secure,
  containerized environment.
- **[Agent Skills](./skills.md):** (Experimental) Extend the CLI with
  specialized expertise and procedural workflows.
- **[Telemetry](./telemetry.md):** Configure observability to monitor usage and
  performance.
- **[Token caching](./token-caching.md):** Optimize API costs by caching tokens.
- **[Trusted folders](./trusted-folders.md):** A security feature to control
  which projects can use the full capabilities of the CLI.
- **[Ignoring files (.codeflyignore)](./codefly-ignore.md):** Exclude specific
  files and directories from being accessed by tools.
- **[Context files (CODEFLY.md)](./codefly-md.md):** Provide persistent,
  hierarchical context to the model.
- **[OpenSpec](./openspec.md):** An AI-native system for spec-driven development
  workflows.
- **[System prompt override](./system-prompt.md):** Replace the built‑in system
  instructions using `CODEFLY_SYSTEM_MD`.

## Non-interactive mode

Codefly CLI can be run in a non-interactive mode, which is useful for scripting
and automation. In this mode, you pipe input to the CLI, it executes the
command, and then it exits.

The following example pipes a command to Codefly CLI from your terminal:

```bash
echo "What is fine tuning?" | codefly
```

You can also use the `--prompt` or `-p` flag:

```bash
codefly -p "What is fine tuning?"
```

For comprehensive documentation on headless usage, scripting, automation, and
advanced examples, see the **[Headless mode](./headless.md)** guide.
