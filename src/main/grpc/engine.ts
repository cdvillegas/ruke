import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type {
  ProtoDefinition,
  ProtoService,
  ProtoMethod,
  ProtoField,
  ProtoMessageType,
  GrpcMethodType,
  GrpcResponse,
  GrpcStreamMessage,
} from '../../shared/types';
import { nanoid } from 'nanoid';

interface LoadedProto {
  definition: ProtoDefinition;
  packageDefinition: protoLoader.PackageDefinition;
  grpcObject: grpc.GrpcObject;
}

interface GrpcCallRequest {
  serverUrl: string;
  protoFilePath: string;
  serviceName: string;
  methodName: string;
  message: string;
  metadata?: Array<{ key: string; value: string; enabled: boolean }>;
  tlsEnabled?: boolean;
  deadline?: number;
}

export class GrpcEngine {
  private loadedProtos: Map<string, LoadedProto> = new Map();
  private activeStreams: Map<string, grpc.ClientReadableStream<any>> = new Map();

  async loadProto(filePath: string): Promise<ProtoDefinition> {
    const cached = this.loadedProtos.get(filePath);
    if (cached) return cached.definition;

    const packageDefinition = await protoLoader.load(filePath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [filePath.substring(0, filePath.lastIndexOf('/'))],
    });

    const grpcObject = grpc.loadPackageDefinition(packageDefinition);
    const definition = this.parsePackageDefinition(packageDefinition, filePath);

    this.loadedProtos.set(filePath, { definition, packageDefinition, grpcObject });
    return definition;
  }

  async sendRequest(request: GrpcCallRequest): Promise<GrpcResponse> {
    const startTime = performance.now();

    try {
      const loaded = this.loadedProtos.get(request.protoFilePath);
      if (!loaded) {
        await this.loadProto(request.protoFilePath);
      }
      const proto = this.loadedProtos.get(request.protoFilePath)!;
      const serviceClient = this.getServiceClient(proto, request);

      const client = new serviceClient(
        request.serverUrl,
        request.tlsEnabled
          ? grpc.credentials.createSsl()
          : grpc.credentials.createInsecure()
      );

      const metadata = new grpc.Metadata();
      if (request.metadata) {
        for (const m of request.metadata) {
          if (m.enabled && m.key) {
            metadata.set(m.key, m.value);
          }
        }
      }

      let messageObj: any;
      try {
        messageObj = JSON.parse(request.message || '{}');
      } catch {
        throw new Error('Invalid JSON message body');
      }

      const methodDef = this.findMethodDefinition(proto.packageDefinition, request.serviceName, request.methodName);
      const isServerStreaming = methodDef?.responseStream ?? false;

      const callOptions: grpc.CallOptions = {};
      if (request.deadline && request.deadline > 0) {
        callOptions.deadline = new Date(Date.now() + request.deadline);
      }

      if (isServerStreaming) {
        return await this.handleServerStream(client, request.methodName, messageObj, metadata, callOptions, startTime);
      }
      return await this.handleUnary(client, request.methodName, messageObj, metadata, callOptions, startTime);
    } catch (error: any) {
      const duration = performance.now() - startTime;
      return {
        status: error.code ?? 2,
        statusMessage: error.details || error.message || 'Unknown error',
        metadata: {},
        trailers: {},
        body: JSON.stringify({ error: error.message }, null, 2),
        messages: [],
        duration: Math.round(duration),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async serverReflection(serverUrl: string, tlsEnabled: boolean): Promise<ProtoDefinition> {
    const credentials = tlsEnabled
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    const client = new grpc.Client(serverUrl, credentials);

    return new Promise((resolve, reject) => {
      const stream = client.makeServerStreamRequest(
        '/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo',
        (arg: any) => arg,
        (buf: any) => buf,
        Buffer.from(JSON.stringify({ list_services: '' })),
        new grpc.Metadata(),
        {}
      );

      const services: ProtoService[] = [];

      stream.on('data', (response: any) => {
        try {
          const parsed = JSON.parse(response.toString());
          if (parsed.list_services_response?.service) {
            for (const svc of parsed.list_services_response.service) {
              services.push({
                name: svc.name.split('.').pop() || svc.name,
                fullName: svc.name,
                methods: [],
              });
            }
          }
        } catch {
          // non-JSON reflection response
        }
      });

      stream.on('error', (err: any) => {
        client.close();
        reject(new Error(`Server reflection failed: ${err.message}. Server may not support reflection — try loading a .proto file instead.`));
      });

      stream.on('end', () => {
        client.close();
        resolve({
          packageName: 'reflected',
          services,
          messageTypes: [],
          filePath: `reflection://${serverUrl}`,
        });
      });
    });
  }

  cancelStream(streamId: string): void {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.cancel();
      this.activeStreams.delete(streamId);
    }
  }

  private handleUnary(
    client: any,
    methodName: string,
    message: any,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    startTime: number,
  ): Promise<GrpcResponse> {
    return new Promise((resolve) => {
      client[methodName](message, metadata, options, (error: grpc.ServiceError | null, response: any) => {
        const duration = performance.now() - startTime;

        if (error) {
          resolve({
            status: error.code ?? 2,
            statusMessage: error.details || error.message,
            metadata: this.metadataToRecord(error.metadata),
            trailers: {},
            body: JSON.stringify({ error: error.details || error.message }, null, 2),
            messages: [],
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          });
          return;
        }

        const body = JSON.stringify(response, null, 2);
        resolve({
          status: 0,
          statusMessage: 'OK',
          metadata: {},
          trailers: {},
          body,
          messages: [{
            id: nanoid(),
            direction: 'received',
            data: body,
            timestamp: new Date().toISOString(),
            index: 0,
          }],
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        });

        client.close();
      });
    });
  }

  private handleServerStream(
    client: any,
    methodName: string,
    message: any,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    startTime: number,
  ): Promise<GrpcResponse> {
    return new Promise((resolve) => {
      const stream = client[methodName](message, metadata, options);
      const streamId = nanoid();
      this.activeStreams.set(streamId, stream);

      const messages: GrpcStreamMessage[] = [];
      let index = 0;

      stream.on('data', (data: any) => {
        messages.push({
          id: nanoid(),
          direction: 'received',
          data: JSON.stringify(data, null, 2),
          timestamp: new Date().toISOString(),
          index: index++,
        });
      });

      stream.on('error', (error: grpc.ServiceError) => {
        const duration = performance.now() - startTime;
        this.activeStreams.delete(streamId);
        resolve({
          status: error.code ?? 2,
          statusMessage: error.details || error.message,
          metadata: this.metadataToRecord(error.metadata),
          trailers: {},
          body: messages.length > 0
            ? JSON.stringify(messages.map(m => JSON.parse(m.data)), null, 2)
            : JSON.stringify({ error: error.details || error.message }, null, 2),
          messages,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        });
        client.close();
      });

      stream.on('end', () => {
        const duration = performance.now() - startTime;
        this.activeStreams.delete(streamId);
        resolve({
          status: 0,
          statusMessage: 'OK',
          metadata: {},
          trailers: {},
          body: JSON.stringify(messages.map(m => JSON.parse(m.data)), null, 2),
          messages,
          duration: Math.round(duration),
          timestamp: new Date().toISOString(),
        });
        client.close();
      });
    });
  }

  private getServiceClient(proto: LoadedProto, request: GrpcCallRequest): any {
    const parts = request.serviceName.split('.');
    let obj: any = proto.grpcObject;

    for (const part of parts) {
      if (obj[part]) {
        obj = obj[part];
      }
    }

    if (typeof obj !== 'function') {
      throw new Error(`Service "${request.serviceName}" not found in proto definition`);
    }

    return obj;
  }

  private findMethodDefinition(
    pkgDef: protoLoader.PackageDefinition,
    serviceName: string,
    methodName: string,
  ): { requestStream: boolean; responseStream: boolean } | undefined {
    for (const [key, def] of Object.entries(pkgDef)) {
      if (key === serviceName || key.endsWith(`.${serviceName}`)) {
        const svcDef = def as any;
        if (svcDef && typeof svcDef === 'object') {
          for (const [mKey, mDef] of Object.entries(svcDef)) {
            if (mKey === methodName && mDef && typeof mDef === 'object') {
              return mDef as any;
            }
          }
        }
      }
    }
    return undefined;
  }

  private parsePackageDefinition(pkgDef: protoLoader.PackageDefinition, filePath: string): ProtoDefinition {
    const services: ProtoService[] = [];
    const messageTypes: ProtoMessageType[] = [];
    const seenMessages = new Set<string>();
    let packageName = '';

    for (const [fullName, definition] of Object.entries(pkgDef)) {
      const typeDef = definition as any;

      if (typeDef.format && typeDef.type) {
        // Message type
        if (!seenMessages.has(fullName)) {
          seenMessages.add(fullName);
          const fields = this.extractFieldsFromType(typeDef);
          messageTypes.push({
            name: fullName.split('.').pop() || fullName,
            fullName,
            fields,
          });
        }
        continue;
      }

      // Service definition: check if it has method-like entries
      const methods: ProtoMethod[] = [];
      let isService = false;

      for (const [methodName, methodDef] of Object.entries(typeDef)) {
        const md = methodDef as any;
        if (md && md.path && typeof md.requestStream === 'boolean') {
          isService = true;

          let methodType: GrpcMethodType = 'unary';
          if (md.requestStream && md.responseStream) methodType = 'bidi_streaming';
          else if (md.requestStream) methodType = 'client_streaming';
          else if (md.responseStream) methodType = 'server_streaming';

          const inputTypeName = md.requestType?.type?.name || 'unknown';
          const outputTypeName = md.responseType?.type?.name || 'unknown';

          methods.push({
            name: methodName,
            fullName: `${fullName}.${methodName}`,
            serviceName: fullName,
            inputType: inputTypeName,
            outputType: outputTypeName,
            methodType,
            inputFields: md.requestType?.type ? this.extractFieldsFromType(md.requestType.type) : [],
            outputFields: md.responseType?.type ? this.extractFieldsFromType(md.responseType.type) : [],
          });
        }
      }

      if (isService) {
        const parts = fullName.split('.');
        const serviceName = parts.pop() || fullName;
        if (!packageName && parts.length > 0) {
          packageName = parts.join('.');
        }

        services.push({
          name: serviceName,
          fullName,
          methods,
        });
      }
    }

    return {
      packageName: packageName || 'default',
      services,
      messageTypes,
      filePath,
    };
  }

  private extractFieldsFromType(typeDef: any): ProtoField[] {
    const fields: ProtoField[] = [];

    if (!typeDef || !typeDef.field) return fields;

    for (const f of typeDef.field) {
      const field: ProtoField = {
        name: f.name,
        type: this.protoTypeToString(f.type, f.typeName),
        repeated: f.label === 'LABEL_REPEATED',
      };

      if (f.typeName && f.type === 'TYPE_MESSAGE') {
        // Nested message — try to resolve fields
        field.type = f.typeName.split('.').pop() || f.typeName;
      }

      if (f.type === 'TYPE_ENUM') {
        field.type = f.typeName?.split('.').pop() || 'enum';
      }

      if (f.oneofIndex !== undefined) {
        field.oneofGroup = `oneof_${f.oneofIndex}`;
      }

      fields.push(field);
    }

    return fields;
  }

  private protoTypeToString(type: string | number, typeName?: string): string {
    const typeMap: Record<string, string> = {
      TYPE_DOUBLE: 'double',
      TYPE_FLOAT: 'float',
      TYPE_INT64: 'int64',
      TYPE_UINT64: 'uint64',
      TYPE_INT32: 'int32',
      TYPE_FIXED64: 'fixed64',
      TYPE_FIXED32: 'fixed32',
      TYPE_BOOL: 'bool',
      TYPE_STRING: 'string',
      TYPE_BYTES: 'bytes',
      TYPE_UINT32: 'uint32',
      TYPE_SFIXED32: 'sfixed32',
      TYPE_SFIXED64: 'sfixed64',
      TYPE_SINT32: 'sint32',
      TYPE_SINT64: 'sint64',
      TYPE_MESSAGE: typeName?.split('.').pop() || 'message',
      TYPE_ENUM: typeName?.split('.').pop() || 'enum',
    };

    return typeMap[String(type)] || String(type);
  }

  private metadataToRecord(metadata?: grpc.Metadata): Record<string, string> {
    if (!metadata) return {};
    const result: Record<string, string> = {};
    const map = metadata.getMap();
    for (const [key, value] of Object.entries(map)) {
      result[key] = String(value);
    }
    return result;
  }
}
