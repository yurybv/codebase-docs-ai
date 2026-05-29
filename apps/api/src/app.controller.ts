import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('/health')
  health(): { status: 'ok'; service: string } {
    return {
      status: 'ok',
      service: 'codebase-docs-ai-api'
    };
  }
}
