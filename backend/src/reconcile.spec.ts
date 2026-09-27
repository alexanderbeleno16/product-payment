const reference = 'txn_8a52ea31-08d9-4f52-a604-00e56143dce0';

describe('operator reconciliation executable', () => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  const createApplicationContext = jest.fn();
  const execute = jest.fn();
  const close = jest.fn();
  let stderr: jest.SpyInstance;
  let stdout: jest.SpyInstance;

  async function run(args: string[]): Promise<void> {
    process.argv = ['node', 'reconcile.js', ...args];
    jest.resetModules();
    jest.doMock('@nestjs/core', () => ({
      NestFactory: { createApplicationContext },
    }));
    require('./reconcile');
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  beforeEach(() => {
    process.exitCode = undefined;
    jest.clearAllMocks();
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    createApplicationContext.mockResolvedValue({
      get: jest.fn().mockReturnValue({ execute }),
      close,
    });
    close.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    stderr.mockRestore();
    stdout.mockRestore();
    jest.dontMock('@nestjs/core');
  });

  it.each([[], ['invalid'], [reference, 'extra']])(
    'rejects invalid arguments without bootstrapping: %j',
    async (...args: string[]) => {
      await run(args);
      expect(process.exitCode).toBe(2);
      expect(stderr).toHaveBeenCalledWith(
        'Usage: npm run payment:reconcile -- <local-reference>\n',
      );
      expect(createApplicationContext).not.toHaveBeenCalled();
    },
  );

  it('prints only the safe status summary and closes the context on success', async () => {
    execute.mockResolvedValue({
      ok: true,
      value: {
        reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: true,
        providerTransactionId: 'must-not-print',
      },
    });
    await run([reference]);
    expect(createApplicationContext).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(reference);
    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({
        reference,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: 'CREATED',
        applied: true,
      }) + '\n',
    );
    expect(close).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBeUndefined();
  });

  it('reports a typed rejection and closes the context', async () => {
    execute.mockResolvedValue({ ok: false, reason: 'ID_UNAVAILABLE' });
    await run([reference]);
    expect(stderr).toHaveBeenCalledWith(
      'Reconciliation not applied: ID_UNAVAILABLE\n',
    );
    expect(process.exitCode).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('redacts an unexpected use-case fault and still closes the context', async () => {
    execute.mockRejectedValue(new Error('sensitive internal detail'));
    await run([reference]);
    expect(stderr).toHaveBeenCalledWith(
      'Reconciliation failed; review server-side diagnostics.\n',
    );
    expect(stderr).not.toHaveBeenCalledWith(
      expect.stringContaining('sensitive internal detail'),
    );
    expect(process.exitCode).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
