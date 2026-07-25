/**
 * Compresses, resizes, and converts any image file to WebP format on the client-side.
 * @param file The original image File object.
 * @param maxDimension The maximum width or height allowed (default 1200px).
 * @param quality The quality of the output WebP compression (0 to 1, default 0.80).
 * @returns A Promise resolving to a new WebP File object.
 */
export async function compressImage(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.80
): Promise<File> {
  // If it's not an image, return it unchanged
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Do not compress SVG
  if (file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions preserving aspect ratio
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert all images to webp format
          const outputType = 'image/webp';
          const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], newFileName, {
                  type: outputType,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            outputType,
            quality
          );
        } catch (error) {
          console.error('Error during WebP image compression:', error);
          resolve(file);
        }
      };
      img.onerror = () => {
        resolve(file);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve(file);
    };
    reader.readAsDataURL(file);
  });
}
