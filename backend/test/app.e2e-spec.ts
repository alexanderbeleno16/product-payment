import { SandboxCardTokenization } from '../src/adapters/outbound/payment/sandbox-card-tokenization';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PRODUCT_READER } from '../src/products.module';
import {
  CONSENT_TERMS_READER,
  PAYMENT_GATEWAY,
  PAYMENT_STATUS_READER,
} from '../src/checkout.tokens';
import { PaymentEventVerifier } from '../src/adapters/inbound/http/payment-event.verifier';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRODUCT_READER)
      .useValue({ findById: jest.fn() })
      .overrideProvider(CONSENT_TERMS_READER)
      .useValue({ getCurrent: jest.fn() })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue({ submit: jest.fn() })
      .overrideProvider(PAYMENT_STATUS_READER)
      .useValue({ getById: jest.fn() })
      .overrideProvider(PaymentEventVerifier)
      .useValue(new PaymentEventVerifier('test_events_fixture_only'))
      .overrideProvider(SandboxCardTokenization)
      .useValue({ encryptionKey: jest.fn(), tokenize: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
