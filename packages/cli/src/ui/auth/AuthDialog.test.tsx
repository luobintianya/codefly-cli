/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderWithProviders } from '../../test-utils/render.js';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import { AuthDialog } from './AuthDialog.js';
import { AuthType, type Config } from '@codeflyai/codefly-core';
import type { LoadedSettings } from '../../config/settings.js';

import { RadioButtonSelect } from '../components/shared/RadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { validateAuthMethodWithSettings } from './useAuth.js';
import { Text } from 'ink';

// Mocks
vi.mock('@codeflyai/codefly-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@codeflyai/codefly-core')>();
  return {
    ...actual,
  };
});

vi.mock('../../utils/cleanup.js', () => ({
  runExitCleanup: vi.fn(),
}));

vi.mock('./useAuth.js', () => ({
  validateAuthMethodWithSettings: vi.fn(),
}));

vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: vi.fn(),
}));

vi.mock('../components/shared/RadioButtonSelect.js', () => ({
  RadioButtonSelect: vi.fn(({ items, initialIndex }) => (
    <>
      {items.map((item: { value: string; label: string }, index: number) => (
        <Text key={item.value}>
          {index === initialIndex ? '(selected)' : '(not selected)'}{' '}
          {item.label}
        </Text>
      ))}
    </>
  )),
}));

const mockedUseKeypress = useKeypress as Mock;
const mockedRadioButtonSelect = RadioButtonSelect as Mock;
const mockedValidateAuthMethod = validateAuthMethodWithSettings as Mock;

describe('AuthDialog', () => {
  let props: {
    config: Config;
    settings: LoadedSettings;
    onSelect: (authType: AuthType | undefined) => Promise<void>;
    authError: string | null;
    onAuthError: (error: string | null) => void;
  };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('CLOUD_SHELL', undefined as unknown as string);
    vi.stubEnv('GEMINI_CLI_USE_COMPUTE_ADC', undefined as unknown as string);
    vi.stubEnv('GEMINI_DEFAULT_AUTH_TYPE', undefined as unknown as string);
    vi.stubEnv('GEMINI_API_KEY', undefined as unknown as string);

    props = {
      config: {
        isBrowserLaunchSuppressed: vi.fn().mockReturnValue(false),
      } as unknown as Config,
      settings: {
        merged: {
          security: {
            auth: {},
          },
        },
        setValue: vi.fn(),
      } as unknown as LoadedSettings,
      onSelect: vi.fn(),
      authError: null,
      onAuthError: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Environment Variable Effects on Auth Options', () => {
    const cloudShellLabel = 'Use Cloud Shell user credentials';
    const metadataServerLabel =
      'Use metadata server application default credentials';
    const computeAdcItem = (label: string) => ({
      label,
      value: AuthType.COMPUTE_ADC,
      key: AuthType.COMPUTE_ADC,
    });

    it.each([
      {
        env: { CLOUD_SHELL: 'true' },
        shouldContain: [computeAdcItem(cloudShellLabel)],
        shouldNotContain: [computeAdcItem(metadataServerLabel)],
        desc: 'in Cloud Shell',
      },
      {
        env: { GEMINI_CLI_USE_COMPUTE_ADC: 'true' },
        shouldContain: [computeAdcItem(metadataServerLabel)],
        shouldNotContain: [computeAdcItem(cloudShellLabel)],
        desc: 'with GEMINI_CLI_USE_COMPUTE_ADC',
      },
      {
        env: {},
        shouldContain: [],
        shouldNotContain: [
          computeAdcItem(cloudShellLabel),
          computeAdcItem(metadataServerLabel),
        ],
        desc: 'by default',
      },
    ])(
      'correctly shows/hides COMPUTE_ADC options $desc',
      ({ env, shouldContain, shouldNotContain }) => {
        for (const [key, value] of Object.entries(env)) {
          vi.stubEnv(key, value as string);
        }
        renderWithProviders(<AuthDialog {...props} />);
        const items = mockedRadioButtonSelect.mock.calls[0][0].items;
        for (const item of shouldContain) {
          expect(items).toContainEqual(item);
        }
        for (const item of shouldNotContain) {
          expect(items).not.toContainEqual(item);
        }
      },
    );
  });

  it('filters auth types when enforcedType is set', () => {
    props.settings.merged.security.auth.enforcedType = AuthType.USE_GEMINI;
    renderWithProviders(<AuthDialog {...props} />);
    const items = mockedRadioButtonSelect.mock.calls[0][0].items;
    expect(items).toHaveLength(1);
    expect(items[0].value).toBe(AuthType.USE_GEMINI);
  });

  it('sets initial index to 0 when enforcedType is set', () => {
    props.settings.merged.security.auth.enforcedType = AuthType.USE_GEMINI;
    renderWithProviders(<AuthDialog {...props} />);
    const { initialIndex } = mockedRadioButtonSelect.mock.calls[0][0];
    expect(initialIndex).toBe(0);
  });

  describe('Initial Auth Type Selection', () => {
    it.each([
      {
        setup: () => {
          props.settings.merged.security.auth.selectedType =
            AuthType.USE_VERTEX_AI;
        },
        expected: AuthType.USE_VERTEX_AI,
        desc: 'from settings',
      },
      {
        setup: () => {
          vi.stubEnv('GEMINI_DEFAULT_AUTH_TYPE', AuthType.USE_GEMINI);
        },
        expected: AuthType.USE_GEMINI,
        desc: 'from GEMINI_DEFAULT_AUTH_TYPE env var',
      },
      {
        setup: () => {
          vi.stubEnv('GEMINI_API_KEY', 'test-key');
        },
        expected: AuthType.USE_GEMINI,
        desc: 'from GEMINI_API_KEY env var',
      },
      {
        setup: () => {},
        expected: AuthType.OPENAI,
        desc: 'defaults to OpenAI Compatible',
      },
    ])('selects initial auth type $desc', ({ setup, expected }) => {
      setup();
      renderWithProviders(<AuthDialog {...props} />);
      const { items, initialIndex } = mockedRadioButtonSelect.mock.calls[0][0];
      expect(items[initialIndex].value).toBe(expected);
    });
  });

  describe('handleAuthSelect', () => {
    it('calls onAuthError if validation fails', () => {
      mockedValidateAuthMethod.mockReturnValue('Invalid method');
      renderWithProviders(<AuthDialog {...props} />);
      const { onSelect: handleAuthSelect } =
        mockedRadioButtonSelect.mock.calls[0][0];
      handleAuthSelect(AuthType.USE_GEMINI);

      expect(mockedValidateAuthMethod).toHaveBeenCalledWith(
        AuthType.USE_GEMINI,
        props.settings,
      );
      expect(props.onAuthError).toHaveBeenCalledWith('Invalid method');
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('calls onSelect with correct type', async () => {
      mockedValidateAuthMethod.mockReturnValue(null);
      renderWithProviders(<AuthDialog {...props} />);
      const { onSelect: handleAuthSelect } =
        mockedRadioButtonSelect.mock.calls[0][0];
      await handleAuthSelect(AuthType.LOGIN_WITH_GOOGLE);

      expect(props.onSelect).toHaveBeenCalledWith(AuthType.LOGIN_WITH_GOOGLE);
    });

    it('calls onSelect for USE_GEMINI', async () => {
      mockedValidateAuthMethod.mockReturnValue(null);
      vi.stubEnv('GEMINI_API_KEY', 'test-key-from-env');

      renderWithProviders(<AuthDialog {...props} />);
      const { onSelect: handleAuthSelect } =
        mockedRadioButtonSelect.mock.calls[0][0];
      await handleAuthSelect(AuthType.USE_GEMINI);

      expect(props.onSelect).toHaveBeenCalledWith(AuthType.USE_GEMINI);
    });
  });

  it('displays authError when provided', () => {
    props.authError = 'Something went wrong';
    const { lastFrame } = renderWithProviders(<AuthDialog {...props} />);
    expect(lastFrame()).toContain('Something went wrong');
  });

  describe('useKeypress', () => {
    it.each([
      {
        desc: 'does nothing on escape if authError is present',
        setup: () => {
          props.authError = 'Some error';
        },
        expectations: (p: typeof props) => {
          expect(p.onAuthError).not.toHaveBeenCalled();
          expect(p.onSelect).not.toHaveBeenCalled();
        },
      },
      {
        desc: 'calls onAuthError on escape if no auth method is set',
        setup: () => {
          props.settings.merged.security.auth.selectedType = undefined;
        },
        expectations: (p: typeof props) => {
          expect(p.onAuthError).toHaveBeenCalledWith(
            'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
          );
        },
      },
      {
        desc: 'calls onSelect(undefined) on escape if auth method is set',
        setup: () => {
          props.settings.merged.security.auth.selectedType =
            AuthType.USE_GEMINI;
        },
        expectations: (p: typeof props) => {
          expect(p.onSelect).toHaveBeenCalledWith(undefined);
          expect(p.settings.setValue).not.toHaveBeenCalled();
        },
      },
    ])('$desc', ({ setup, expectations }) => {
      setup();
      renderWithProviders(<AuthDialog {...props} />);
      const keypressHandler = mockedUseKeypress.mock.calls[0][0];
      keypressHandler({ name: 'escape' });
      expectations(props);
    });
  });

  describe('Snapshots', () => {
    it('renders correctly with default props', () => {
      const { lastFrame } = renderWithProviders(<AuthDialog {...props} />);
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders correctly with auth error', () => {
      props.authError = 'Something went wrong';
      const { lastFrame } = renderWithProviders(<AuthDialog {...props} />);
      expect(lastFrame()).toMatchSnapshot();
    });

    it('renders correctly with enforced auth type', () => {
      props.settings.merged.security.auth.enforcedType = AuthType.USE_GEMINI;
      const { lastFrame } = renderWithProviders(<AuthDialog {...props} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });
});
