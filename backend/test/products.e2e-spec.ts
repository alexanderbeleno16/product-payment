import { SandboxCardTokenization } from '../src/adapters/outbound/payment/sandbox-card-tokenization';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { ProductReader } from '../src/application/product-reader.port';
import { PRODUCT_READER } from '../src/products.module';
import { configureOpenApi } from '../src/openapi';
import {
  CONSENT_TERMS_READER,
  PAYMENT_GATEWAY,
  PAYMENT_STATUS_READER,
} from '../src/checkout.tokens';
import { PaymentEventVerifier } from '../src/adapters/inbound/http/payment-event.verifier';

const product = {
  id: '8a52ea31-08d9-4f52-a604-00e56143dce0',
  name: 'Wireless Headphones',
  description: 'Over-ear wireless headphones',
  currency: 'COP',
  priceCents: 12990000,
  stock: 12,
};

describe('ProductsController (e2e)', () => {
  let app: INestApplication<App>;
  const findById = jest.fn();
  const findAll = jest.fn();
  const reader: ProductReader = { findAll, findById };

  beforeEach(async () => {
    findById.mockResolvedValue(product);
    findAll.mockResolvedValue([product]);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRODUCT_READER)
      .useValue(reader)
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
    configureOpenApi(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('GET /products/:id returns server-owned product data', async () => {
    await request(app.getHttpServer())
      .get(`/products/${product.id}`)
      .expect(200)
      .expect(product);
    expect(findById).toHaveBeenCalledWith(product.id);
  });

  it('GET /products returns the catalog via the shared reader port', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .expect(200)
      .expect([product]);
    expect(findAll).toHaveBeenCalledTimes(1);
    expect(findById).not.toHaveBeenCalled();
  });

  it('GET /products returns an empty list when no products are available', async () => {
    findAll.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/products').expect(200).expect([]);
  });

  it('documents the catalog response as an array in OpenAPI', async () => {
    const { body: document } = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);
    expect(
      document.paths['/products'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toMatchObject({ type: 'array' });
    expect(document.paths['/products/{id}'].get.responses['200']).toBeDefined();
  });

  it('GET /products/:id returns 404 when absent', async () => {
    findById.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get(`/products/${product.id}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 404,
          message: 'Product not found',
        });
      });
  });

  it('GET /products/:id rejects malformed IDs without querying persistence', async () => {
    await request(app.getHttpServer()).get('/products/not-a-uuid').expect(400);
    expect(findById).not.toHaveBeenCalled();
  });
});
