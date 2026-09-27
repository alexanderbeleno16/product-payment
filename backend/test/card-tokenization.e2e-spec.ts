import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CardTokenizationController } from '../src/adapters/inbound/http/card-tokenization.controller';
import { SandboxCardTokenization } from '../src/adapters/outbound/payment/sandbox-card-tokenization';
import { TokenizationRateLimitGuard } from '../src/adapters/inbound/http/tokenization-rate-limit.guard';

const header = Buffer.from(
  JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM' }),
).toString('base64url');
const payload = `${header}.encrypted.key.ciphertext.tag`;

describe('Same-origin card-tokenization HTTP boundary', () => {
  let app: INestApplication<App>;
  const encryptionKey = jest.fn();
  const tokenize = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [CardTokenizationController],
      providers: [
        TokenizationRateLimitGuard,
        {
          provide: SandboxCardTokenization,
          useValue: { encryptionKey, tokenize },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('returns only public PEM and opaque token, never provider body', async () => {
    encryptionKey.mockResolvedValue('public-pem');
    tokenize.mockResolvedValue('tok_fixture');
    const keyResponse = await request(app.getHttpServer())
      .get('/checkout/tokenization-key')
      .expect(200);
    expect(keyResponse.body).toEqual({ publicKey: 'public-pem' });
    expect(keyResponse.headers['cache-control']).toBe('no-store');
    const tokenResponse = await request(app.getHttpServer())
      .post('/checkout/card-tokens')
      .send({ payload })
      .expect(201);
    expect(tokenResponse.body).toEqual({ token: 'tok_fixture' });
    expect(tokenResponse.headers['cache-control']).toBe('no-store');
    expect(tokenize).toHaveBeenCalledWith(payload);
  });

  it('rejects plaintext, extra fields, and oversized payload without outbound call', async () => {
    for (const body of [
      { number: '4111111111111111', cvc: '123' },
      { payload: 'plaintext-card-data' },
      { payload, url: 'https://attacker.example' },
      { payload: 'a'.repeat(4097) },
    ])
      await request(app.getHttpServer())
        .post('/checkout/card-tokens')
        .send(body)
        .expect(400);
    expect(tokenize).not.toHaveBeenCalled();
  });

  it('returns safe 503 without remote diagnostics', async () => {
    encryptionKey.mockRejectedValue(new Error('remote-sensitive-body'));
    tokenize.mockRejectedValue(new Error('remote-sensitive-body'));
    const keyResponse = await request(app.getHttpServer())
      .get('/checkout/tokenization-key')
      .expect(503);
    const tokenResponse = await request(app.getHttpServer())
      .post('/checkout/card-tokens')
      .send({ payload })
      .expect(503);
    expect(
      JSON.stringify(keyResponse.body) + JSON.stringify(tokenResponse.body),
    ).not.toContain('remote-sensitive-body');
  });

  it('limits a burst before validation or outbound tokenization, ignoring forwarded IP', async () => {
    tokenize.mockResolvedValue('tok_fixture');
    for (let index = 0; index < 10; index++) {
      await request(app.getHttpServer())
        .post('/checkout/card-tokens')
        .set('X-Forwarded-For', `192.0.2.${index + 1}`)
        .send({ payload })
        .expect(201);
    }
    const blocked = await request(app.getHttpServer())
      .post('/checkout/card-tokens')
      .set('X-Forwarded-For', '198.51.100.1')
      .send({ invalid: true })
      .expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(tokenize).toHaveBeenCalledTimes(10);
  });

  it('limits public-key reads before outbound I/O', async () => {
    encryptionKey.mockResolvedValue('public-pem');
    for (let index = 0; index < 30; index++)
      await request(app.getHttpServer())
        .get('/checkout/tokenization-key')
        .expect(200);
    const blocked = await request(app.getHttpServer())
      .get('/checkout/tokenization-key')
      .expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(encryptionKey).toHaveBeenCalledTimes(30);
  });
});
