# Get started with Codefly CLI

Welcome to Codefly CLI! This guide will help you install, configure, and start
using the Codefly CLI to enhance your workflow right from your terminal.

## Quickstart: Install, authenticate, configure, and use Codefly CLI

Codefly CLI brings the power of advanced language models directly to your command
line interface. As an AI-powered assistant, Codefly CLI can help you with a
variety of tasks, from understanding and generating code to reviewing and
editing documents.

## Install

The standard method to install and run Codefly CLI uses `npm`:

```bash
npm install -g @codeflyai/codefly
```

Once Codefly CLI is installed, run Codefly CLI from your command line:

```bash
codefly
```

For more installation options, see [Codefly CLI Installation](./installation.md).

## Authenticate

To begin using Codefly CLI, you must authenticate with a Google service. In most
cases, you can log in with your existing Google account:

1. Run Codefly CLI after installation:

   ```bash
   codefly
   ```

2. When asked "How would you like to authenticate for this project?" select **1.
   Login with Google**.

3. Select your Google account.

4. Click on **Sign in**.

Certain account types may require you to configure a Google Cloud project. For
more information, including other authentication methods, see
[Codefly CLI Authentication Setup](./authentication.md).

## Configure

Codefly CLI offers several ways to configure its behavior, including environment
variables, command-line arguments, and settings files.

To explore your configuration options, see
[Codefly CLI Configuration](../reference/configuration.md).

## Use

Once installed and authenticated, you can start using Codefly CLI by issuing
commands and prompts in your terminal. Ask it to generate code, explain files,
and more.

To explore the power of Codefly CLI, see [Codefly CLI examples](./examples.md).

## Check usage and quota

You can check your current token usage and quota information using the
`/stats model` command. This command provides a snapshot of your current
session's token usage, as well as your overall quota and usage for the supported
models.

For more information on the `/stats` command and its subcommands, see the
[Command Reference](../../reference/commands.md#stats).

## Next steps

- Follow the [File management](../cli/tutorials/file-management.md) guide to
  start working with your codebase.
- See [Shell commands](../cli/tutorials/shell-commands.md) to learn about
  terminal integration.
