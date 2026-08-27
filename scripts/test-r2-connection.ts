import { S3Client, CreateMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";

async function testR2Connectivity() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error("Missing R2 environment variables.");
    process.exit(1);
  }

  const endpointHost = process.env.R2_ENDPOINT 
    ? new URL(process.env.R2_ENDPOINT).hostname 
    : `${accountId.trim()}.r2.cloudflarestorage.com`;
  
  const endpoint = process.env.R2_ENDPOINT ?? `https://${endpointHost}`;

  console.log("Testing R2 Connectivity...");
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Region: auto`);
  console.log(`Bucket: ${bucketName}`);

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const testKey = `test-connectivity-${Date.now()}.bin`;
  let uploadId: string | undefined;

  try {
    console.log(`Initiating CreateMultipartUpload for key: ${testKey}...`);
    const initRes = await s3.send(
      new CreateMultipartUploadCommand({
        Bucket: bucketName,
        Key: testKey,
        ContentType: "application/octet-stream",
      })
    );

    uploadId = initRes.UploadId;
    console.log(`✅ Success! UploadId: ${uploadId}`);
    
    // Clean up
    console.log(`Aborting multipart upload...`);
    await s3.send(
      new AbortMultipartUploadCommand({
        Bucket: bucketName,
        Key: testKey,
        UploadId: uploadId,
      })
    );
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    console.error(`❌ Connectivity test failed:`);
    console.error(`Name: ${err?.name}`);
    console.error(`Code: ${err?.code}`);
    console.error(`Message: ${err?.message}`);
    console.error(`HTTP Status: ${err?.$metadata?.httpStatusCode}`);
    
    if (err?.code === "AccessDenied") {
      console.error("-> Interpretation: TLS succeeded, but credentials or permissions are invalid.");
    } else if (err?.code === "NoSuchBucket") {
      console.error("-> Interpretation: TLS succeeded, auth succeeded, but bucket does not exist.");
    } else if (err?.code === "EPROTO" || err?.name === "TimeoutError" || err?.code === "ENOTFOUND") {
      console.error("-> Interpretation: TLS/Network failure. Check endpoint configuration.");
    }
  }
}

testR2Connectivity();
