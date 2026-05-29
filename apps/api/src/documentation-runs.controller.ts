import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentationRunsService } from './documentation-runs.service.js';

@Controller('/v1/documentation-runs')
export class DocumentationRunsController {
  constructor(
    @Inject(DocumentationRunsService)
    private readonly documentationRunsService: DocumentationRunsService
  ) {}

  @Post()
  createRun(@Body() body: unknown): Promise<object> {
    return this.documentationRunsService.createRun(body);
  }

  @Post('/:runId/sources')
  @UseInterceptors(AnyFilesInterceptor())
  async uploadSources(
    @Param('runId') runId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('metadata') metadata: string
  ): Promise<object> {
    return this.documentationRunsService.uploadSources(runId, files, metadata);
  }

  @Post('/:runId/start')
  async startRun(@Param('runId') runId: string): Promise<object> {
    return this.documentationRunsService.startRun(runId);
  }

  @Get('/:runId')
  getRun(@Param('runId') runId: string): Promise<object> {
    return this.documentationRunsService.getRun(runId);
  }

  @Get('/:runId/result')
  getResult(@Param('runId') runId: string): Promise<object> {
    return this.documentationRunsService.getResult(runId);
  }

  @Get('/:runId/download')
  async download(
    @Param('runId') runId: string,
    @Query('format') format: string | undefined,
    @Res() response: Response
  ): Promise<void> {
    const download = await this.documentationRunsService.getDownload(runId, format ?? 'markdown-tree');
    response.setHeader('Content-Type', download.mediaType);
    response.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
    response.send(download.content);
  }

  @Delete('/:runId')
  async deleteRun(@Param('runId') runId: string): Promise<object> {
    await this.documentationRunsService.deleteRun(runId);
    return {
      runId,
      deleted: true
    };
  }
}
