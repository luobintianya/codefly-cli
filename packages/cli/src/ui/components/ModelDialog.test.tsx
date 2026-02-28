/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { ModelDialog } from './ModelDialog.js';
import { renderWithProviders } from '../../test-utils/render.js';
import { waitFor } from '../../test-utils/async.js';
import { createMockSettings } from '../../test-utils/settings.js';
import { DEFAULT_CODEFLY_FLASH_LITE_MODEL, DEFAULT_CODEFLY_FLASH_MODEL, DEFAULT_CODEFLY_MODEL, DEFAULT_CODEFLY_MODEL_AUTO, PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL, PREVIEW_CODEFLY_3_1_MODEL, PREVIEW_CODEFLY_FLASH_MODEL, PREVIEW_CODEFLY_MODEL, PREVIEW_CODEFLY_MODEL_AUTO } from '@codeflyai/codefly-core';
import type { Config, ModelSlashCommandEvent } from '@codeflyai/codefly-core';

// Helper for flush event queue
const waitForUpdate = () => new Promise(resolve => setTimeout(resolve, 50));

// Mock dependencies
const mockGetDisplayString = vi.fn();
const mockLogModelSlashCommand = vi.fn();
const mockModelSlashCommandEvent = vi.fn();

vi.mock('@codeflyai/codefly-core', async () => {
  const actual = await vi.importActual('@codeflyai/codefly-core');
  return {
    ...actual,
    getDisplayString: (val: string) => mockGetDisplayString(val),
    logModelSlashCommand: (config: Config, event: ModelSlashCommandEvent) =>
      mockLogModelSlashCommand(config, event),
    ModelSlashCommandEvent: class {
      constructor(model: string) {
        mockModelSlashCommandEvent(model);
      }
    },
  };
});

vi.mock('../contexts/SettingsContext.js', () => ({
  useSettings: () => ({
    merged: {
      security: {
        auth: {
          selectedType: 'login-with-google',
          openai: { models: '' },
        },
      },
    },
  }),
}));

describe('<ModelDialog />', () => {
  const mockSetModel = vi.fn();
  const mockGetModel = vi.fn();
  const mockOnClose = vi.fn();
  const mockGetHasAccessToPreviewModel = vi.fn();
  const mockGetCodefly31LaunchedSync = vi.fn();
  const mockGetPreviewFeatures = vi.fn();

  interface MockConfig extends Partial<Config> {
    setModel: (model: string, isTemporary?: boolean) => Promise<void>;
    getModel: () => string;
    getHasAccessToPreviewModel: () => boolean;
    getPreviewFeatures: () => boolean;
    getIdeMode: () => boolean;
    getCodefly31LaunchedSync: () => boolean;
  }

  const mockConfig: MockConfig = {
    setModel: mockSetModel,
    getModel: mockGetModel,
    getHasAccessToPreviewModel: mockGetHasAccessToPreviewModel,
    getPreviewFeatures: mockGetPreviewFeatures,
    getIdeMode: () => false,
    getCodefly31LaunchedSync: mockGetCodefly31LaunchedSync,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetModel.mockReturnValue(DEFAULT_CODEFLY_MODEL_AUTO);
    mockGetPreviewFeatures.mockReturnValue(false);
    mockGetHasAccessToPreviewModel.mockReturnValue(false);
    mockGetCodefly31LaunchedSync.mockReturnValue(false);

    // Default implementation for getDisplayString
    mockGetDisplayString.mockImplementation((val: string) => {
      if (val === 'auto-codefly-2.5') return 'Auto (Codefly 2.5)';
      if (val === 'auto-codefly-3') return 'Auto (Codefly 3)';
      return val;
    });
  });

  const renderComponent = async (
    configValue = mockConfig as unknown as Config,
    authType = 'login-with-google',
  ) => {
    const settings = createMockSettings({
      security: {
        auth: {
          selectedType: authType,
        },
      },
    });

    const result = renderWithProviders(<ModelDialog onClose={mockOnClose} />, {
      config: configValue,
      settings,
    });
    await result.waitUntilReady();
    return result;
  };

  it('renders the initial "main" view correctly', async () => {
    const { lastFrame } = await renderComponent();
    expect(lastFrame()).toContain('Select Model');
    expect(lastFrame()).toContain('Remember model for future sessions: true');
    expect(lastFrame()).toContain('Auto');
    expect(lastFrame()).toContain('Manual');
  });

  it('renders "main" view with preview options when preview features are enabled', async () => {
    mockGetPreviewFeatures.mockReturnValue(true);
    mockGetHasAccessToPreviewModel.mockReturnValue(true); // Must have access
    const { lastFrame } = await renderComponent();
    expect(lastFrame()).toContain('Auto (Codefly 3)');
  });

  it('renders "manual" view after selecting manual option', async () => {
    const { lastFrame, stdin, waitUntilReady } =
      await renderComponent();

    // Select "Manual" (index 1)
    // Press down arrow to move to "Manual"
    stdin.write('\u001B[B'); // Arrow Down
    stdin.write('\u001B[B'); // Arrow Down
    stdin.write('\u001B[B'); // Arrow Down
    await waitForUpdate();

    // Press enter to select
    await act(async () => {
      stdin.write('\r');
    });
    await waitUntilReady();

    // Should now show manual options and headers
    expect(lastFrame()).toContain('Google / Codefly');
    expect(lastFrame()).toContain(DEFAULT_CODEFLY_MODEL);
    expect(lastFrame()).toContain(DEFAULT_CODEFLY_FLASH_MODEL);
    expect(lastFrame()).toContain(DEFAULT_CODEFLY_FLASH_LITE_MODEL);
  });

  it('renders "manual" view with preview options when preview features are enabled', async () => {
    mockGetPreviewFeatures.mockReturnValue(true);
    mockGetHasAccessToPreviewModel.mockReturnValue(true); // Must have access
    mockGetModel.mockReturnValue(PREVIEW_CODEFLY_MODEL_AUTO);
    const { lastFrame, stdin } = await renderComponent();

    // Select "Manual" (index 1 because Preview Auto is same as Default Auto now due to deduplication)
    stdin.write('\u001B[B'); // Arrow Down
    stdin.write('\u001B[B'); // Arrow Down
    stdin.write('\u001B[B'); // Arrow Down
    await waitForUpdate();

    // Press enter to select Manual
    stdin.write('\r');
    await waitForUpdate();

    expect(lastFrame()).toContain(PREVIEW_CODEFLY_MODEL);
  });

  it('sets model and closes when a model is selected in "main" view', async () => {
    const { stdin, waitUntilReady } = await renderComponent();

    // Select "Auto" (index 0)
    await act(async () => {
      stdin.write('\r');
    });
    await waitUntilReady();

    expect(mockSetModel).toHaveBeenCalledWith(
      DEFAULT_CODEFLY_MODEL_AUTO,
      false, // Session only by default (persistMode=true means NOT temporary, so isTemporary=false)
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('sets model and closes when a model is selected in "manual" view', async () => {
    const { stdin } = await renderComponent();

    // Navigate to Manual (index 1) and select
    stdin.write('\u001B[B');
    stdin.write('\u001B[B');
    stdin.write('\u001B[B');
    await waitForUpdate();
    stdin.write('\r');
    await waitForUpdate();

    // Now in manual view. Default selection is first item (DEFAULT_CODEFLY_MODEL)
    stdin.write('\r');
    await waitForUpdate();

    expect(mockSetModel).toHaveBeenCalledWith(DEFAULT_CODEFLY_MODEL, false);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('toggles persist mode with Tab key', async () => {
    const { lastFrame, stdin, waitUntilReady } =
      await renderComponent();

    expect(lastFrame()).toContain('Remember model for future sessions: true');

    // Press Tab to toggle persist mode
    await act(async () => {
      stdin.write('\t');
    });
    await waitUntilReady();

    expect(lastFrame()).toContain('Remember model for future sessions: false');

    // Select "Auto" (index 0)
    await act(async () => {
      stdin.write('\r');
    });
    await waitUntilReady();

    expect(mockSetModel).toHaveBeenCalledWith(
      DEFAULT_CODEFLY_MODEL_AUTO,
      true, // Persist disable (isTemporary=true)
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes dialog on escape in "main" view', async () => {
    const { stdin, waitUntilReady } = await renderComponent();

    await act(async () => {
      stdin.write('\u001B'); // Escape
    });
    // Escape key has a 50ms timeout in KeypressContext, so we need to wrap waitUntilReady in act
    await act(async () => {
      await waitUntilReady();
    });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('goes back to "main" view on escape in "manual" view', async () => {
    const { lastFrame, stdin, waitUntilReady } =
      await renderComponent();

    // Go to manual view
    stdin.write('\u001B[B');
    stdin.write('\u001B[B');
    stdin.write('\u001B[B');
    await waitForUpdate();
    stdin.write('\r');
    await waitForUpdate();

    expect(lastFrame()).toContain(DEFAULT_CODEFLY_MODEL);

    // Press Escape
    await act(async () => {
      stdin.write('\u001B');
    });
    await act(async () => {
      await waitUntilReady();
    });

    await waitFor(() => {
      expect(mockOnClose).not.toHaveBeenCalled();
      // Should be back to main view (Manual option visible)
      expect(lastFrame()).toContain('Manual');
    });
  });

  it('shows the preferred manual model in the main view option using getDisplayString', async () => {
    mockGetModel.mockReturnValue(DEFAULT_CODEFLY_MODEL);
    mockGetDisplayString.mockImplementation((val: string) => {
      if (val === DEFAULT_CODEFLY_MODEL) return 'My Custom Model Display';
      if (val === 'auto-codefly-2.5') return 'Auto (Codefly 2.5)';
      return val;
    });
    const { lastFrame } = await renderComponent();

    expect(lastFrame()).toContain('Manual (My Custom Model Display)');
  });

  describe('Preview Models', () => {
    beforeEach(() => {
      mockGetHasAccessToPreviewModel.mockReturnValue(true);
    });

    it('should NOT show preview options if user has access but preview features are disabled', async () => {
      mockGetHasAccessToPreviewModel.mockReturnValue(true);
      mockGetPreviewFeatures.mockReturnValue(false);
      const { lastFrame } = await renderComponent();
      expect(lastFrame()).not.toContain('Auto (Preview)');
    });

    it('should show preview options if user has access AND preview features are enabled', async () => {
      mockGetHasAccessToPreviewModel.mockReturnValue(true);
      mockGetPreviewFeatures.mockReturnValue(true);
      const { lastFrame } = await renderComponent();
      expect(lastFrame()).toContain('Auto (Codefly 3)');
    });

    it('shows Codefly 3 models in manual view when Codefly 3.1 is NOT launched', async () => {
      mockGetCodefly31LaunchedSync.mockReturnValue(false);
      const { lastFrame, stdin, waitUntilReady } =
        await renderComponent();

      // Go to manual view
      await act(async () => {
        stdin.write('\u001B[B'); // Manual
      });
      await waitUntilReady();
      await act(async () => {
        stdin.write('\r');
      });
      await waitUntilReady();

      const output = lastFrame();
      expect(output).toContain(PREVIEW_CODEFLY_MODEL);
      expect(output).toContain(PREVIEW_CODEFLY_FLASH_MODEL);
    });

    it('shows Codefly 3.1 models in manual view when Codefly 3.1 IS launched', async () => {
      mockGetCodefly31LaunchedSync.mockReturnValue(true);
      const { lastFrame, stdin, waitUntilReady } =
        await renderComponent(mockConfig as unknown as Config, 'use-vertex-ai');

      // Go to manual view
      await act(async () => {
        stdin.write('\u001B[B'); // Manual
      });
      await waitUntilReady();
      await act(async () => {
        stdin.write('\r');
      });
      await waitUntilReady();

      const output = lastFrame();
      expect(output).toContain(PREVIEW_CODEFLY_3_1_MODEL);
      expect(output).toContain(PREVIEW_CODEFLY_FLASH_MODEL);
    });

    it('uses custom tools model when Codefly 3.1 IS launched and auth is Codefly API Key', async () => {
      mockGetCodefly31LaunchedSync.mockReturnValue(true);
      const { stdin, waitUntilReady } = await renderComponent(
        mockConfig as unknown as Config,
        'use-codefly',
      );

      // Go to manual view
      await act(async () => {
        stdin.write('\u001B[B'); // Manual
      });
      await waitUntilReady();
      await act(async () => {
        stdin.write('\r');
      });
      await waitUntilReady();

      // Select Codefly 3.1 (first item in preview section)
      await act(async () => {
        stdin.write('\r');
      });
      await waitUntilReady();

      await waitFor(() => {
        expect(mockSetModel).toHaveBeenCalledWith(
          PREVIEW_CODEFLY_3_1_CUSTOM_TOOLS_MODEL,
          true,
        );
      });
    });
  });
});
