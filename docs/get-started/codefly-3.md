# Codefly 3 Pro and Codefly 3 Flash on Codefly CLI

Codefly 3 Pro and Codefly 3 Flash are available on Codefly CLI for all users!

> **Note:** Codefly 3.1 Pro Preview is rolling out. To determine whether you have
> access to Codefly 3.1, use the `/model` command and select **Manual**. If you
> have access, you will see `codefly-3.1-pro-preview`.
>
> If you have access to Codefly 3.1, it will be included in model routing when
> you select **Auto (Codefly 3)**. You can also launch the Codefly 3.1 model
> directly using the `-m` flag:
>
> ```
> codefly -m codefly-3.1-pro-preview
> ```
>
> Learn more about [models](../cli/model.md) and
> [model routing](../cli/model-routing.md).

## How to get started with Codefly 3 on Codefly CLI

Get started by upgrading Codefly CLI to the latest version:

```bash
npm install -g @codeflyai/codefly@latest
```

After you’ve confirmed your version is 0.21.1 or later:

1. Run `/model`.
2. Select **Auto (Codefly 3)**.

For more information, see [Codefly CLI model selection](../cli/model.md).

### Usage limits and fallback

Codefly CLI will tell you when you reach your Codefly 3 Pro daily usage limit.
When you encounter that limit, you’ll be given the option to switch to Codefly
2.5 Pro, upgrade for higher limits, or stop. You’ll also be told when your usage
limit resets and Codefly 3 Pro can be used again.

Similarly, when you reach your daily usage limit for Codefly 2.5 Pro, you’ll see
a message prompting fallback to Codefly 2.5 Flash.

### Capacity errors

There may be times when the Codefly 3 Pro model is overloaded. When that happens,
Codefly CLI will ask you to decide whether you want to keep trying Codefly 3 Pro
or fallback to Codefly 2.5 Pro.

> **Note:** The **Keep trying** option uses exponential backoff, in which Codefly
> CLI waits longer between each retry, when the system is busy. If the retry
> doesn't happen immediately, please wait a few minutes for the request to
> process.

### Model selection and routing types

When using Codefly CLI, you may want to control how your requests are routed
between models. By default, Codefly CLI uses **Auto** routing.

When using Codefly 3 Pro, you may want to use Auto routing or Pro routing to
manage your usage limits:

- **Auto routing:** Auto routing first determines whether a prompt involves a
  complex or simple operation. For simple prompts, it will automatically use
  Codefly 2.5 Flash. For complex prompts, if Codefly 3 Pro is enabled, it will use
  Codefly 3 Pro; otherwise, it will use Codefly 2.5 Pro.
- **Pro routing:** If you want to ensure your task is processed by the most
  capable model, use `/model` and select **Pro**. Codefly CLI will prioritize the
  most capable model available, including Codefly 3 Pro if it has been enabled.

To learn more about selecting a model and routing, refer to
[Codefly CLI Model Selection](../cli/model.md).

## How to enable Codefly 3 with Codefly CLI on Codefly Code Assist

If you're using Codefly Code Assist Standard or Codefly Code Assist Enterprise,
enabling Codefly 3 Pro on Codefly CLI requires configuring your release channels.
Using Codefly 3 Pro will require two steps: administrative enablement and user
enablement.

To learn more about these settings, refer to
[Configure Codefly Code Assist release channels](https://developers.google.com/codefly-code-assist/docs/configure-release-channels).

### Administrator instructions

An administrator with **Google Cloud Settings Admin** permissions must follow
these directions:

- Navigate to the Google Cloud Project you're using with Codefly CLI for Code
  Assist.
- Go to **Admin for Codefly** > **Settings**.
- Under **Release channels for Codefly Code Assist in local IDEs** select
  **Preview**.
- Click **Save changes**.

### User instructions

Wait for two to three minutes after your administrator has enabled **Preview**,
then:

- Open Codefly CLI.
- Use the `/settings` command.
- Set **Preview Features** to `true`.

Restart Codefly CLI and you should have access to Codefly 3.

## Need help?

If you need help, we recommend searching for an existing
[GitHub issue](https://github.com/google-codefly/codefly-cli/issues). If you
cannot find a GitHub issue that matches your concern, you can
[create a new issue](https://github.com/google-codefly/codefly-cli/issues/new/choose).
For comments and feedback, consider opening a
[GitHub discussion](https://github.com/google-codefly/codefly-cli/discussions).
