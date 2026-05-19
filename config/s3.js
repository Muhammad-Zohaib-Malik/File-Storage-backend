import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  profile: "nodejs",
});

export const createUploadSignedUrl = async ({ key, ContentType }) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ContentType: ContentType,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
    signableHeaders: new Set(["Content-type"]),
  });
  return url;
};

export const createGetSignedUrl = async ({
  key,
  download = false,
  filename,
}) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename=${encodeURIComponent(filename)}`,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300,
  });
  return url;
};

export const getS3FileMetaData = async ({ key }) => {
  const command = new HeadObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });
  return await s3Client.send(command);
};

export const deleteS3FileFromAws = async ({ key }) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });
  await s3Client.send(command);
};

export const deleteS3FilesFromAws = async ({ keys }) => {
  const command=new DeleteObjectsCommand({
    Bucket:process.env.AWS_BUCKET_NAME,
    Delete:{
      Objects:keys,
      Quiet:false
    }
  })
  return await s3Client.send(command)
}
