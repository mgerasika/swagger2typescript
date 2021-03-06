/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export interface ISwaggerDoc {
  title?: string;
  methods: ISwaggerMethod[];
  models: ISwaggerModel[];
}

export interface ISwaggerMethod {
  path: string;
  summary: string;
  httpMethod: string;
  tags: string[];
  name: string;
  originalName: string;
  body?: ISwaggerMethodBody;
  successResponse?: ISwaggerMethodReturn;
  errorResponseTypeName: string;
  errorResponses?: ISwaggerMethodReturn[];
  parameters?: ISwaggerMethodParameter[];
}

export interface ISwaggerMethodReturn {
  isArray: boolean;
  status: string | undefined;
  model: ISwaggerModel | undefined;
}

export interface ISwaggerMethodParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
}

export interface ISwaggerModel {
  name: string;
  originalName: string;
  type: string;
  properties?: ISwaggerProperty[];
  enum?: string[];
  schema?: string;
  arrayItemModel?: ISwaggerModel | undefined;
}

export interface ISwaggerProperty {
  name: string;
  type: string;
  required?: boolean;
  subModel?: ISwaggerModel;
}
export interface ISwaggerMethodBody {
  required: boolean;
  model?: ISwaggerModel;
}

export const getDoc = (source: any): ISwaggerDoc | undefined => {
  try {
    const models = getModels(source);
    const res = {
      title: source.info?.title,
      methods: getMethods(source, models),
      models,
    };
    // console.log('getDoc', source, res);
    return res;
  } catch (e) {
    console.error('getDoc error', e);
  }
  return undefined;
};

export const getMethods = (
  source: any,
  models: ISwaggerModel[],
): ISwaggerMethod[] => {
  return Object.keys(source['paths'])
    .map((key) => {
      const path = source['paths'][key];

      return Object.keys(path).map((httpMethod: string) => {
        const content = path[httpMethod];
        const name = getMethodName(key, httpMethod);
        return {
          name,
          errorResponseTypeName: 'T' + capitalize(`${name}Error`),
          originalName: key,
          httpMethod,
          summary: content.summary,
          path: key,
          tags: content.tags,
          parameters: getMethodParameters(content),
          body: {
            required: content.requestBody?.required,
            model: models.find(
              (x) =>
                x.schema ===
                content?.requestBody?.content['application/json']?.schema[
                  '$ref'
                ],
            ),
          },
          successResponse: Object.keys(content.responses)
            .filter((statusStr) => {
              const status = parseInt(statusStr, 10);
              return status >= 200 && status <= 299;
            })
            .map((statusStr) =>
              getSwaggerMethodReturn(content, statusStr, models),
            )
            .filter((f) => f)[0],

          errorResponses: Object.keys(content.responses)
            .filter((statusStr) => {
              const status = parseInt(statusStr, 10);
              return status >= 400;
            })
            .map(
              (statusStr) =>
                getSwaggerMethodReturn(
                  content,
                  statusStr,
                  models,
                ) as ISwaggerMethodReturn,
            )
            .filter((f) => f),
        };
      });
    })
    .flat();
};

export const getModels = (source: any): ISwaggerModel[] => {
  return Object.keys(source.components?.schemas).map((key) => {
    const schema = source.components?.schemas[key];
    return getModel(source, schema, key);
  });
};

export const getModel = (
  root: any,
  schema: any,
  key: string,
): ISwaggerModel => {
  let arrayItemModel = undefined;

  if (schema.type === 'array') {
    // console.log('bug here', schema);
    if (!schema.items.properties) {
      const parts = schema.items['$ref']?.split('/') || [];
      const name = parts[parts.length - 1];
      const subSchema = root.components.schemas[name];
      arrayItemModel = getModel(root, subSchema, name);
    }
  }
  const properties = schema.properties || schema.items?.properties;
  return {
    name: key
      ? schema.enum
        ? (key.toLowerCase().startsWith('e') ? '' : 'E') + capitalize(key)
        : 'I' + capitalize(key)
      : '',
    originalName: key,
    type: schema.type,
    schema: root.components.schemas[key]
      ? `#/components/schemas/${key}`
      : undefined,
    enum: schema.enum,
    arrayItemModel,
    properties: properties
      ? Object.keys(properties).map((propertyKey: string) => {
          const property = properties[propertyKey];
          const subModel = getPropertyModel(root, property, propertyKey);
          const propertyType =
            property.type === 'integer'
              ? 'number'
              : property.type || subModel?.name;
          return {
            name: propertyKey,
            type: propertyType,
            required: schema.required?.includes(propertyKey),
            subModel,
          };
        })
      : undefined,
  };
};
const getPropertyModel = (
  root: any,
  propertySchema: any,
  propertyKey: string,
): ISwaggerModel | undefined => {
  if (propertySchema.type === 'object') {
    return getModel(root, propertySchema, propertyKey);
  } else if (propertySchema.type === 'array') {
    if (propertySchema.items['$ref']) {
      const parts = propertySchema.items['$ref'].split('/');
      const name = parts[parts.length - 1];
      const subSchema = root.components.schemas[name];
      return getModel(root, subSchema, name);
    } else if (propertySchema.items.type) {
      if (propertySchema.items.type === 'object') {
        return getModel(root, propertySchema.items, '');
      }
      return {
        name: propertySchema.items.type,
        originalName: propertySchema.items.type,
        type: propertySchema.items.type,
      };
    }
    return getModel(root, propertySchema.items, 'items');
  } else if (propertySchema.enum) {
    return {
      name: propertySchema.type,
      originalName: propertySchema.type,
      enum: propertySchema.enum,
      type: 'string',
    };
  } else if (propertySchema['$ref']) {
    const parts = propertySchema['$ref'].split('/');
    const name = parts[parts.length - 1];
    const subSchema = root.components.schemas[name];
    return getModel(root, subSchema, name);
  }
  return undefined;
};

const capitalize = (s: string): string => {
  if (typeof s !== 'string') {
    return '';
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const getMethodName = (path: string, httpMethod: string): string => {
  return `${path}-${httpMethod}`
    .split(/[-/]/g)
    .map((f) => (f.indexOf('{') === -1 ? f : 'id'))
    .join('/')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .split('-')
    .filter((f) => f !== '-')
    .filter((s) => s !== 'api')
    .filter((s) => s !== 'chargebee')
    .map((s, index) => (index > 1 ? capitalize(s) : s.toLowerCase()))
    .join('');
};

const getMethodParameters = (
  content: any,
): ISwaggerMethodParameter[] | undefined => {
  return content.parameters
    ? content.parameters.map((p: any) => {
        return {
          name: p.name,
          in: p.in,
          required: p.required,
          type: p.schema.type === 'integer' ? 'number' : p.schema.type,
        } as ISwaggerMethodParameter;
      })
    : undefined;
};

const getSwaggerMethodReturn = (
  content: any,
  statusStr: string,
  models: ISwaggerModel[],
): ISwaggerMethodReturn | undefined => {
  const schema = content.responses[statusStr]?.content
    ? content.responses[statusStr]?.content['application/json']?.schema
    : undefined;

  if (schema?.type === 'array') {
    const res = models.find((x) => x.schema === schema?.items['$ref']);
    return {
      isArray: true,
      model: res,
      status: statusStr,
    };
  }
  return {
    isArray: false,
    status: statusStr,
    model: schema && models.find((x) => x.schema === schema['$ref']),
  };
};
