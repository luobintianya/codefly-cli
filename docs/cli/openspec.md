# OpenSpec CLI

OpenSpec is an AI-native system for spec-driven development, integrated directly
into Codefly CLI. It provides a structured workflow for creating, validating,
and implementing changes in your codebase using a "spec-first" approach.

## Overview

The `openspec` command allows you to:

- **Initialize** OpenSpec in your project.
- **Manage Changes:** Create, list, show, and archive change proposals.
- **Validate:** Ensure your specs and changes adhere to the schema and project
  rules.
- **Generate Instructions:** Get step-by-step guidance for creating artifacts
  (proposals, designs, tasks).
- **Workflow Automation:** Check status and fast-forward through the development
  lifecycle.

## Getting Started

### Initialization

To start using OpenSpec in your project, run the init command:

```bash
codefly openspec init
```

This will:

1.  Check for write permissions.
2.  Create the `.openspec/` directory structure.
3.  Prompt you to select AI tools (skills) to configure (e.g.,
    `openspec-explore`, `openspec-new-change`).
4.  Generate skill files (`SKILL.md`) and configuration.

**Options:**

- `--tools <tools>`: Configure tools non-interactively (e.g., `all`, `none`, or
  `claude,cursor`).
- `--force`: Auto-cleanup legacy files without prompting.

## Core Workflow

The typical OpenSpec workflow involves creating a "change", defining its specs,
implementing it, and then archiving it.

### 1. Create a New Change

Start a new piece of work (feature, fix, refactor) by creating a change
container:

```bash
codefly openspec new change <name>
```

- `<name>`: A short, kebab-case name for your change (e.g., `add-auth-flow`).
- `--description <text>`: Optional description for the change.
- `--schema <name>`: Workflow schema to use (defaults to `spec-driven`).

This creates a directory at `openspec/changes/<name>/` with placeholders for
your artifacts.

### 2. View and Manage Changes

List all active changes:

```bash
codefly openspec list
```

Show details of a specific change:

```bash
codefly openspec show <change-name>
```

- `--json`: Output as JSON.
- `--deltas-only`: Show only the delta specs (requirements added/modified).

### 3. Check Status and Instructions

Check the status of artifacts for a change:

```bash
codefly openspec status --change <change-name>
```

Get instructions for the next step in your workflow:

```bash
codefly openspec instructions <artifact-id> --change <change-name>
```

- `<artifact-id>`: The artifact you want to work on (e.g., `proposal`, `design`,
  `tasks`).
- Use `openspec instructions apply` to get instructions for the implementation
  phase.

### 4. Validation

Validate your changes and specs to ensure they meet the required format and
schema:

```bash
codefly openspec validate <change-name>
```

- `--strict`: Enable strict validation mode.
- `--json`: Output results as JSON.
- `--all`: Validate all changes and specs.

### 5. Archiving

When a change is complete and merged, archive it to keep your workspace clean:

```bash
codefly openspec archive <change-name>
```

- Moves the change to `openspec/changes/archive/YYYY-MM-DD-<name>/`.
- Updates main specs based on the change's delta specs.
- `-y, --yes`: Skip confirmation prompts.
- `--skip-specs`: Skip updating main specs (for doc-only or tooling changes).

## Advanced Usage

### Shell Completions

Generate shell completion scripts for your shell (Bash, Zsh, Fish, PowerShell):

```bash
codefly openspec completion install <shell>
```

### Configuration

Update OpenSpec instruction files and skills:

```bash
codefly openspec update
```

View available workflow schemas:

```bash
codefly openspec schemas
```

View resolved template paths for a schema:

```bash
codefly openspec templates --schema <name>
```

## Legacy Commands (Deprecated)

The following commands are deprecated in favor of the verb-first style:

- `openspec change list` -> Use `openspec list`
- `openspec change show` -> Use `openspec show`
- `openspec change validate` -> Use `openspec validate`
- `openspec spec show` -> Use `openspec show --type spec`
