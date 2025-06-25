import { Injectable } from '@nestjs/common';
import { Client } from 'minio';

@Injectable()
export class MinioService {
  private client: Client;

  constructor() {
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
  }

  async uploadFile(bucket: string, fileName: string, buffer: Buffer, mimeType: string) {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket);
      console.log(`✅ Bucket creado: ${bucket}`);
    }

    await this.client.putObject(bucket, fileName, buffer, buffer.length, {
      'Content-Type': mimeType
    });

    console.log(`✅ Archivo subido: ${bucket}/${fileName}`);
  }

  // Nuevo método: genera un URL firmado
  async getPresignedUrl(bucket: string, fileName: string, expirySeconds = 3600): Promise<string> {
    const url = await this.client.presignedGetObject(bucket, fileName, expirySeconds);
    console.log(`✅ Presigned URL generado: ${url}`);
    return url;
  }

  // Para descargas internas (ej. stream)
  getFileStream(bucket: string, fileName: string) {
    return this.client.getObject(bucket, fileName);
  }


  async deleteFile(bucket: string, fileName: string) {
    await this.client.removeObject(bucket, fileName);
  }

}
