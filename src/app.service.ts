import { Injectable } from '@nestjs/common';
import { getDoc } from 'swagger-to-typescript/swagger-to-model.service';
import { swaggerToTypescript } from 'swagger-to-typescript/swagger-to-typescript.service';

export interface IBody {
  json: any;
}
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  convert(body: IBody): string {
    if (!body?.json) {
      throw 'json field missing ' + JSON.stringify(body);
    }
    const doc = getDoc(body?.json);
    if (!doc) {
      throw 'doc cannot be null';
    }

    try {
      const typescriptResult = swaggerToTypescript(doc);
      return typescriptResult;
    } catch (ex) {
      throw ex;
    }
  }
}
