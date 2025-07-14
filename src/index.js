// gr8r-r2sign-worker v1.3.0
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default {
  async fetch(request, env) {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const { filename, contentType } = await request.json();

      if (!filename || !contentType) {
        return new Response("Missing filename or contentType", { status: 400 });
      }

      const command = new PutObjectCommand({
        Bucket: "videos-gr8r",
        Key: filename,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 });

      return new Response(
        JSON.stringify({ signedUrl }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
