import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { AppModule } from './app.module.js';

const port = Number.parseInt(process.env.API_PORT ?? '3000', 10);

const app = await NestFactory.create(AppModule);
app.useGlobalFilters(new ApiExceptionFilter());
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true
  })
);
app.enableCors();

await app.listen(port);
