// gr8r-r2sign-worker v1.0.2
// FIXED getSignatureKey logic to comply with Web Crypto API's sign() requirements.
// Replaced invalid CryptoKey reuse pattern that caused TypeError: parameter 3 is not of type 'Array'
// FIXED: Presigned PUT now uses path-style URL to avoid "PUT bucket route" errors
// gr8r-r2sign-worker v1.0.1 (HMAC presigned URL fallback)
// Minimal working version to test direct PUT to R2 without createPresignedUrl()

// Required secrets (add via dashboard or wrangler):
// R2_ACCESS_KEY_ID
// R2_SECRET_ACCESS_KEY
// R2_BUCKET
// R2_ACCOUNT_ID
// R2_REGION (e.g., "auto")
// R2_ENDPOINT

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || pathname !== "/generate-upload-url") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const { title, contentType } = await request.json();
      if (!title || !contentType) {
        return new Response("Missing title or contentType", { status: 400 });
      }

      const sanitize = (t) => t.trim().replace(/[\/\\?%*:|"<>']/g, '').replace(/\s+/g, '-').toLowerCase();
      const fileExt = contentType === "video/mp4" ? "mp4" : "mov";
      const objectKey = `${sanitize(title)}.${fileExt}`;

      const method = "PUT";
      const bucket = env.R2_BUCKET;
      const region = env.R2_REGION; 
      const service = "s3";
      const endpoint = env.R2_ENDPOINT.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const host = `${bucket}.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const url = `https://${host}/${objectKey}`;




      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const datestamp = amzDate.slice(0, 8);

      const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;
      const credential = `${env.R2_ACCESS_KEY_ID}/${credentialScope}`;

  const headers = {
  "host": host,
  "x-amz-date": amzDate,
  "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
};

      const canonicalHeaders = Object.entries(headers)
        .map(([k, v]) => `${k.toLowerCase()}:${v}\n`).join('');
      const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
      const canonicalRequest = [
        method,
       `/${objectKey}`,
        "",
        canonicalHeaders,
        signedHeaders,
        "UNSIGNED-PAYLOAD"
      ].join('\n');

      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest));
      const hashedCanonicalRequest = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');

      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        hashedCanonicalRequest
      ].join('\n');

      const getSignatureKey = async (key, dateStamp, regionName, serviceName) => {
  const encoder = new TextEncoder();
  const signHmac = async (keyData, msg) => {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(msg));
  };

  const kDate = await signHmac(encoder.encode("AWS4" + key), dateStamp);
  const kRegion = await signHmac(kDate, regionName);
  const kService = await signHmac(kRegion, serviceName);
  const kSigning = await signHmac(kService, "aws4_request");

  return crypto.subtle.importKey(
    "raw",
    kSigning,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
};


      const signingKey = await getSignatureKey(env.R2_SECRET_ACCESS_KEY, datestamp, region, service);
      const signatureBytes = await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(stringToSign));
      const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

      const signedUrl = `${url}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(credential)}&X-Amz-Date=${amzDate}&X-Amz-Expires=3600&X-Amz-SignedHeaders=${signedHeaders}&X-Amz-Signature=${signature}`;

      return Response.json({ uploadUrl: signedUrl, objectKey });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
