import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PRODUCT_READER } from '../src/products.module';
import { CONSENT_TERMS_READER, PAYMENT_GATEWAY } from '../src/checkout.tokens';

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
