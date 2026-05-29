import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './app-bootstrap.js';
import { AppModule } from './app.module.js';

const port = Number.parseInt(process.env.API_PORT ?? '3000', 10);

const app = await NestFactory.create(AppModule);
configureApp(app);

await app.listen(port);
