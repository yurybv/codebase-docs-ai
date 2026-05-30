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
  UseFilters,
  UseInterceptors
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentationRunsService } from './documentation-runs.service.js';
import { MulterExceptionFilter } from './multer-exception.filter.js';
import { getDocumentationUploadMulterOptions } from './upload-limits.js';

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

  @Get()
  listRuns(
    @Query('limit') limit: string | undefined,
    @Query('status') status: string | undefined,
    @Query('role') role: string | undefined,
    @Query('name') name: string | undefined,
    @Query('format') format: string | undefined,
    @Query('minSources') minSources: string | undefined,
    @Query('maxSources') maxSources: string | undefined,
    @Query('sort') sort: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('createdAfter') createdAfter: string | undefined,
    @Query('createdBefore') createdBefore: string | undefined,
    @Query('updatedAfter') updatedAfter: string | undefined,
    @Query('updatedBefore') updatedBefore: string | undefined
  ): Promise<object> {
    return this.documentationRunsService.listRuns({
      limit,
      status,
      role,
      name,
      format,
      minSources,
      maxSources,
      sort,
      cursor,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore
    });
  }

  @Post('/:runId/sources')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(AnyFilesInterceptor(getDocumentationUploadMulterOptions()))
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
