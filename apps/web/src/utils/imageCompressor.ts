/**
 * Compresses and resizes an image file on the client-side.
 * @param file The original image File object.
 * @param maxDimension The maximum width or height allowed.
 * @param quality The quality of the output JPEG compression (0 to 1).
 * @returns A Promise resolving to a new File (compressed) or the original File if compression fails or isn't applicable.
 */
export async function compressImage(
  file: File,
  maxDimension: number = 1000,
  quality: number = 0.82
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

          // If PNG, we might want to preserve transparency, so keep it as image/png.
          // Otherwise, we convert to image/jpeg for optimal compression.
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Return a new File object
                const compressedFile = new File([blob], file.name, {
                  type: outputType,
                  lastModified: Date.now(),
                });
                // Only return the compressed file if it's actually smaller than original
                if (compressedFile.size < file.size) {
                  resolve(compressedFile);
                } else {
                  resolve(file);
                }
              } else {
                resolve(file);
              }
            },
            outputType,
            outputType === 'image/jpeg' ? quality : undefined
          );
        } catch (error) {
          console.error('Error during image compression:', error);
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
