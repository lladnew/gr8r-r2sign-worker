function sanitizeTitleForFilename(title) {
  return title
    .trim()
    .replace(/[\/\\?%*:|"<>']/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/generate-upload-url") {
      const { title, contentType } = await request.json();
      if (!title || !contentType) {
        return new Response("Missing title or contentType", { status: 400 });
      }

      const fileExt = contentType === "video/mp4" ? "mp4" : "mov";
      const objectKey = `${sanitizeTitleForFilename(title)}.${fileExt}`;

      const signed = await env.VIDEO_BUCKET.createPresignedUrl(objectKey, {
        method: "PUT",
        contentType,
        expiresIn: 3600,
      });

      return Response.json({ uploadUrl: signed.url, objectKey });
    }

    return new Response("Not found", { status: 404 });
  }
};
