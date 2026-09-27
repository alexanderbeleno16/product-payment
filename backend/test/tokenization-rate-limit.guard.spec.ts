import type { ExecutionContext } from '@nestjs/common';
import { TokenizationRateLimitGuard } from '../src/adapters/inbound/http/tokenization-rate-limit.guard';

describe('TokenizationRateLimitGuard', () => {
  let guard: TokenizationRateLimitGuard;
  let now: number;

  beforeEach(() => {
    guard = new TokenizationRateLimitGuard();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  function attempt(method: 'GET' | 'POST', address: string) {
    const headers: Record<string, string> = {};
    const response = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    };
    const request = {
      method,
      socket: { remoteAddress: address },
      headers: { 'x-forwarded-for': '203.0.113.99' },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
    try {
      return { allowed: guard.canActivate(context), headers };
    } catch {
      return { allowed: false, headers };
    }
  }

  it('bounds POST per socket peer and resets after the window', () => {
    for (let index = 0; index < 10; index++)
      expect(attempt('POST', '192.0.2.1').allowed).toBe(true);
    const blocked = attempt('POST', '192.0.2.1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.headers['Retry-After']).toBe('60');
    now += 60_000;
    expect(attempt('POST', '192.0.2.1').allowed).toBe(true);
  });

  it('keeps GET and POST separate and permits a distinct peer', () => {
    for (let index = 0; index < 10; index++) attempt('POST', '192.0.2.1');
    expect(attempt('POST', '192.0.2.2').allowed).toBe(true);
    expect(attempt('GET', '192.0.2.1').allowed).toBe(true);
    for (let index = 1; index < 30; index++)
      expect(attempt('GET', '192.0.2.1').allowed).toBe(true);
    expect(attempt('GET', '192.0.2.1').allowed).toBe(false);
  });

  it('enforces the process-wide POST cap across peers', () => {
    for (let index = 0; index < 100; index++)
      expect(attempt('POST', `192.0.2.${index}`).allowed).toBe(true);
    expect(attempt('POST', '198.51.100.1').allowed).toBe(false);
    now += 60_000;
    expect(attempt('POST', '198.51.100.1').allowed).toBe(true);
  });

  it('keeps peer tracking bounded across many expired windows', () => {
    for (let window = 0; window < 16; window++) {
      for (let index = 0; index < 300; index++)
        expect(
          attempt(
            'GET',
            `192.${window}.${Math.floor(index / 256)}.${index % 256}`,
          ).allowed,
        ).toBe(true);
      now += 60_000;
    }
    const windows = (guard as unknown as { perIp: Map<string, unknown> }).perIp;
    expect(windows.size).toBeLessThanOrEqual(4096);
    expect(attempt('GET', '198.51.100.1').allowed).toBe(true);
  });
});
