/** Resize before upload. The API independently normalizes and strips metadata. */
export async function thumbnail(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 12_000_000
  )
    throw new Error("Choose a JPEG, PNG or WebP photo under 12 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 12_000_000)
      throw new Error("Choose a photo under 12 megapixels.");
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Photo preparation is unavailable. You can publish without a photo.",
      );
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.58, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 153600)
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () =>
            reject(new Error("The photo could not be prepared."));
          reader.readAsDataURL(blob);
        });
    }
    throw new Error(
      "This photo cannot be reduced to 150 KB. Try a simpler image or publish without a photo.",
    );
  } finally {
    bitmap.close();
  }
}
