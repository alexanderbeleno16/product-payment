import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetProduct } from '../../../application/get-product';
import type { Product } from '../../../domain/product';
import { ProductResponseDto } from './response.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly getProduct: GetProduct) {}

  @Get(':id')
  @ApiOperation({ summary: 'Read a seeded product and current stock' })
  @ApiParam({
    name: 'id',
    description: 'Product UUID v4',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid product ID' })
  @ApiResponse({ status: 404, description: 'Product not found' })
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
