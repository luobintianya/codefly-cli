# Memory tool (`save_memory`)

The `save_memory` tool allows the Codefly agent to persist specific facts, user
preferences, and project details across sessions.

## Technical reference

This tool appends information to the `## Codefly Added Memories` section of your
global `CODEFLY.md` file (typically located at `~/.codefly/CODEFLY.md`).

### Arguments

- `fact` (string, required): A clear, self-contained statement in natural
  language.

## Technical behavior

The tool appends the provided `fact` to a special `CODEFLY.md` file located in
the user's home directory (`~/.codefly/CODEFLY.md`). This file can be configured
to have a different name.

## Use cases

- Persisting user preferences (for example, "I prefer functional programming").
- Saving project-wide architectural decisions.
- Storing frequently used aliases or system configurations.

## Next steps

- Follow the [Memory management guide](../cli/tutorials/memory-management.md)
  for practical examples.
- Learn how the [Project context (CODEFLY.md)](../cli/codefly-md.md) system loads
  this information.
