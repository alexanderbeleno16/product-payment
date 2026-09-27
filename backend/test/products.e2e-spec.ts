import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { ProductReader } from '../src/application/product-reader.port';
import { PRODUCT_READER } from '../src/products.module';
import { CONSENT_TERMS_READER, PAYMENT_GATEWAY } from '../src/checkout.tokens';

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
  const reader: ProductReader = { findById };

  beforeEach(async () => {
    findById.mockResolvedValue(product);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PRODUCT_READER)
      .useValue(reader)
      .overrideProvider(CONSENT_TERMS_READER)
      .useValue({ getCurrent: jest.fn() })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue({ submit: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
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
