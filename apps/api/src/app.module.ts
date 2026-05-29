import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DocumentationRunsController } from './documentation-runs.controller.js';
import { DocumentationRunsService } from './documentation-runs.service.js';

@Module({
  controllers: [AppController, DocumentationRunsController],
  providers: [DocumentationRunsService]
})
export class AppModule {}
