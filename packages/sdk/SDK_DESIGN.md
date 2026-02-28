# `Codefly CLI SDK`

> **Implementation Status:** Core agent loop, tool execution, and session
> context are implemented. Advanced features like hooks, skills, subagents, and
> ACP are currently missing.

# `Examples`

## `Simple Example`

> **Status:** Implemented. `CodeflyCliAgent` supports `session()` and
> `resumeSession()`.

Equivalent to `codefly -p "what does this project do?"`. Loads all workspace and
user settings.

```ts
import { CodeflyCliAgent } from '@codeflyai/codefly-sdk';

const simpleAgent = new CodeflyCliAgent({
  cwd: '/path/to/some/dir',
});

// Create a new empty session
const session = simpleAgent.session();

// Resume a specific session by ID
// const session = await simpleAgent.resumeSession('some-session-id');

for await (const chunk of session.sendStream('what does this project do?')) {
  console.log(chunk); // equivalent to JSON streaming chunks
}
```

Validation:

- Model receives call containing "what does this project do?" text.

## `System Instructions`

> **Status:** Implemented. Both static string instructions and dynamic functions
> (receiving `SessionContext`) are supported.

System instructions can be provided by a static string OR dynamically via a
function:

```ts
import { CodeflyCliAgent } from "@codeflyai/codefly-sdk";

const agent = new CodeflyCliAgent({
  instructions: "This is a static string instruction"; // this is valid
  instructions: (ctx) => `The current time is ${new Date().toISOString()} in session ${ctx.sessionId}.`
});
```

Validation:

- Static string instructions show up where CODEFLY.md content normally would in
  model call
- Dynamic instructions show up and contain dynamic content.

## `Custom Tools`

> **Status:** Implemented. `tool()` helper and `CodeflyCliAgent` support custom
> tool definitions and execution.

```ts
import { CodeflyCliAgent, tool, z } from "@codeflyai/codefly-sdk";

const addTool = tool({
  name: 'add',
  description: 'add two numbers',
  inputSchema: z.object({
    a: z.number().describe('first number to add'),
    b: z.number().describe('second number to add'),
  }),
}, (({a, b}) => ({result: a + b}),);

const toolAgent = new CodeflyCliAgent({
  tools: [addTool],
});

const result = await toolAgent.send("what is 23 + 79?");
console.log(result.text);
```

Validation:

- Model receives tool definition in prompt
- Model receives tool response after returning tool

## `Custom Hooks`

> **Status:** Not Implemented.

SDK users can provide programmatic custom hooks

```ts
import { CodeflyCliAgent, hook, z } from '@codeflyai/codefly-sdk';
import { reformat } from './reformat.js';

const myHook = hook(
  {
    event: 'AfterTool',
    name: 'reformat',
    matcher: 'write_file',
  },
  (hook, ctx) => {
    const filePath = hook.toolInput.path;

    // void return is a no-op
    if (!filePath.endsWith('.ts')) return;

    // ctx.fs gives us a filesystem interface that obeys Codefly CLI permissions/sandbox
    const reformatted = await reformat(await ctx.fs.read(filePath));
    await ctx.fs.write(filePath, reformatted);

    // hooks return a payload instructing the agent how to proceed
    return {
      hookSpecificOutput: {
        additionalContext: `Reformatted file ${filePath}, read again before modifying further.`,
      },
    };
  },
);
```

SDK Hooks can also run as standalone scripts to implement userland "command"
style hooks:

```ts
import { hook } from "@codeflyai/codefly-sdk";

// define a hook as above
const myHook = hook({...}, (hook) => {...});
// calling runAsCommand parses stdin, calls action, uses appropriate exit code
// with output, but you get nice strong typings to guide your impl
myHook.runAsCommand();
```

Validation (these are probably hardest to validate):

- Test each type of hook and check that model api receives injected content
- Check global halt scenarios
- Check specific return types for each type of hook

## `Custom Skills`

> **Status:** Implemented. `skillDir` helper and `CodeflyCliAgent` support
> loading skills from filesystem.

Custom skills can be referenced by individual directories or by "skill roots"
(directories containing many skills).

### Directory Structure

```
skill-dir/
  SKILL.md  (Metadata and instructions)
  tools/    (Optional directory for tools)
    my-tool.js
```

### Usage

```typescript
import { CodeflyCliAgent, skillDir } from '@google/codefly-sdk';

const agent = new CodeflyCliAgent({
  instructions: 'You are a helpful assistant.',
  skills: [
    // Load a single skill from a directory
    skillDir('./my-skill'),
    // Load all skills found in subdirectories of this root
    skillDir('./skills-collection'),
  ],
});
```

## `Subagents`

> **Status:** Not Implemented.

```ts
import { CodeflyCliAgent, subagent } from "@codeflyai/codefly";

const mySubagent = subagent({
  name: "my-subagent",
  description: "when the subagent should be used",

  // simple prompt agent with static string or dynamic string
  instructions: "the instructions",
  instructions (prompt, ctx) => `can also be dynamic with context`,

  // OR (in an ideal world)...

  // pass a full standalone agent
  agent: new CodeflyCliAgent(...);
});

const agent = new CodeflyCliAgent({
  subagents: [mySubagent]
});
```

## `Extensions`

> **Status:** Not Implemented.

Potentially the most important feature of the Codefly CLI SDK is support for
extensions, which modularly encapsulate all of the primitives listed above:

```ts
import { CodeflyCliAgent, extension } from "@codeflyai/codefly-sdk";

const myExtension = extension({
  name: "my-extension",
  description: "...",
  instructions: "THESE ARE CONCATENATED WITH OTHER AGENT
INSTRUCTIONS",
  tools: [...],
  skills: [...],
  hooks: [...],
  subagents: [...],
});
```

## `ACP Mode`

> **Status:** Not Implemented.

The SDK will include a wrapper utility to interact with the agent via ACP
instead of the SDK's natural API.

```ts
import { CodeflyCliAgent } from "@codeflyai/codefly-sdk";
import { CodeflyCliAcpServer } from "@codeflyai/codefly-sdk/acp";

const server = new CodeflyCliAcpServer(new CodeflyCliAgent({...}));
server.start(); // calling start runs a stdio ACP server

const client = server.connect({
  onMessage: (message) => { /* updates etc received here */ },
});
client.send({...clientMessage}); // e.g. a "session/prompt" message
```

## `Approvals / Policies`

> **Status:** Not Implemented.

TODO

# `Implementation Guidance`

## `Session Context`

> **Status:** Implemented. `SessionContext` interface exists and is passed to
> tools.

Whenever executing a tool, hook, command, or skill, a SessionContext object
should be passed as an additional argument after the arguments/payload. The
interface should look something like:

```ts
export interface SessionContext {
  // translations of existing common hook payload info
  sessionId: string;
  transcript: Message[];
  cwd: string;
  timestamp: string;

  // helpers to access files and run shell commands while adhering to policies/validation
  fs: AgentFilesystem;
  shell: AgentShell;
  // the agent and session are passed as context
  agent: CodeflyCliAgent;
  session: CodeflyCliSession;
}

export interface AgentFilesystem {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  // consider others including delete, globbing, etc but read/write are bare minimum
}

export interface AgentShell {
  // simple promise-based execution that blocks until complete
  exec(
    cmd: string,
    options?: AgentShellOptions,
  ): Promise<{
    exitCode: number;
    output: string;
    stdout: string;
    stderr: string;
  }>;
  start(cmd: string, options?: AgentShellOptions): AgentShellProcess;
}

export interface AgentShellOptions {
  env?: Record<string, string>;
  timeoutSeconds?: number;
}

export interface AgentShellProcess {
  // figure out how to have a streaming shell process here that supports stdin too
  // investigate how Codefly CLI already does this
}
```

# `Notes`

- To validate the SDK, it would be useful to have a robust way to mock the
  underlying model API so that the tests could be closer to end-to-end but still
  deterministic.
- Need to work in both Codefly-CLI-triggered approvals and optional
  developer-initiated user prompts / HITL stuff.
- Need to think about how subagents inherit message context \- e.g. do they have
  the same session id?
- Presumably the transcript is kept updated in memory and also persisted to disk
  by default?

# `Next Steps`

Based on the current implementation status, we can proceed with:

## Feature 3: Custom Hooks Support

Implement support for loading and registering custom hooks. This involves adding
a `hooks` option to `CodeflyCliAgentOptions`.

**Tasks:**

1.  Define `Hook` interface and helper functions.
2.  Add `hooks` option to `CodeflyCliAgentOptions`.
3.  Implement hook registration logic in `CodeflyCliAgent`.

IMPORTANT: Hook signatures should be strongly typed all the way through. You'll
need to create a mapping of the string event name to the request/response types.
