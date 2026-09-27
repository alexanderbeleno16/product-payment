import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const baseFilter = new BaseExceptionFilter(this.adapterHost.httpAdapter);
    if (exception instanceof HttpException) {
      baseFilter.catch(exception, host);
      return;
    }

    // Infrastructure errors may contain SQL parameters or provider data.
    this.logger.error('Unhandled request failure');
    baseFilter.catch(new InternalServerErrorException(), host);
  }
}
