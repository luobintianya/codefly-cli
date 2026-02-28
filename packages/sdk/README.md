# @codeflyai/codefly-sdk

The Codefly CLI SDK provides a programmatic interface to interact with Codefly
models and tools.

## Installation

```bash
npm install @codeflyai/codefly-sdk
```

## Usage

```typescript
import { CodeflyCliAgent } from '@codeflyai/codefly-sdk';

async function main() {
  const agent = new CodeflyCliAgent({
    instructions: 'You are a helpful assistant.',
  });

  const controller = new AbortController();
  const signal = controller.signal;

  // Stream responses from the agent
  const stream = agent.sendStream('Why is the sky blue?', signal);

  for await (const chunk of stream) {
    if (chunk.type === 'content') {
      process.stdout.write(chunk.value.text || '');
    }
  }
}

main().catch(console.error);
```
