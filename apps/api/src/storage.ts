import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Binary } from 'mongodb';
import type { AssetRecord } from '@sports/db';
function store() {
  const bucket = process.env.S3_BUCKET;
  if (
    !bucket ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY
  )
    throw new Error('Object storage is not configured');
  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  return { client, bucket };
}
export async function writeAsset(
  auctionId: string,
  id: string,
  bytes: Buffer,
): Promise<{ bytes: Binary | null; objectKey?: string }> {
  if (process.env.STORAGE_DRIVER !== 's3') return { bytes: new Binary(bytes) };
  const { client, bucket } = store();
  const objectKey = 'auctions/' + auctionId + '/' + id + '.webp';
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: 'image/webp',
    }),
  );
  return { bytes: null, objectKey };
}
export async function readAsset(
  asset: Pick<AssetRecord, 'bytes' | 'objectKey'>,
) {
  if (!asset.objectKey) {
    if (!asset.bytes) throw new Error('Missing asset');
    return Buffer.from(asset.bytes.buffer);
  }
  const { client, bucket } = store();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: asset.objectKey }),
  );
  if (!result.Body || (result.ContentLength ?? 0) > 2 * 1024 * 1024)
    throw new Error('Invalid asset');
  const bytes = await result.Body.transformToByteArray();
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Invalid asset');
  return Buffer.from(bytes);
}
export async function discardAsset(objectKey: string) {
  const { client, bucket } = store();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
  );
}
