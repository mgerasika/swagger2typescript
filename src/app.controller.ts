import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService, IBody } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post()
  convert(@Body() body: IBody): string {
    return this.appService.convert(body);
  }
}
