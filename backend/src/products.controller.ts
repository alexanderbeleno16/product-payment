import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GetProduct } from './application/get-product';
import type { Product } from './application/product';

@Controller('products')
export class ProductsController {
  constructor(private readonly getProduct: GetProduct) {}

  @Get(':id')
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Product> {
    const product = await this.getProduct.execute(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }
}
