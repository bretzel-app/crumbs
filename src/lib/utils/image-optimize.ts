const MAX_DIMENSION = 1920;
const THUMB_SIZE = 200;
const QUALITY = 0.8;
const THUMB_QUALITY = 0.6;
const SKIP_THRESHOLD = 200 * 1024; // 200KB

interface OptimizeResult {
	optimized: Blob;
	thumbnail: Blob;
}

/**
 * Check if a PNG has transparency by examining the alpha channel.
 * Reads a sample of pixels to determine if any are non-opaque.
 */
function hasTransparency(canvas: HTMLCanvasElement | OffscreenCanvas, ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number): boolean {
	const imageData = ctx.getImageData(0, 0, width, height);
	const data = imageData.data;
	// Check every 4th value (alpha channel) with stride for performance
	const stride = Math.max(1, Math.floor(data.length / (4 * 10000))) * 4;
	for (let i = 3; i < data.length; i += stride) {
		if (data[i] < 255) return true;
	}
	return false;
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
	if (typeof OffscreenCanvas !== 'undefined') {
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext('2d')!;
		return { canvas, ctx };
	}
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	return { canvas, ctx };
}

async function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality: number): Promise<Blob> {
	if (canvas instanceof OffscreenCanvas) {
		return canvas.convertToBlob({ type, quality });
	}
	return new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob!), type, quality);
	});
}

async function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(img.src);
			resolve(img);
		};
		img.onerror = reject;
		img.src = URL.createObjectURL(file);
	});
}

function fitDimensions(width: number, height: number, maxDim: number): { width: number; height: number } {
	if (width <= maxDim && height <= maxDim) return { width, height };
	const ratio = Math.min(maxDim / width, maxDim / height);
	return {
		width: Math.round(width * ratio),
		height: Math.round(height * ratio)
	};
}

/**
 * Optimize an image file for upload:
 * - Resize to fit within 1920x1920 (preserve aspect ratio)
 * - Skip optimization if already < 200KB and within size limits
 * - Compress JPEG/WebP to ~80% quality
 * - Convert non-transparent PNG/BMP to WebP; keep transparent PNG as PNG
 * - Pass GIF/SVG through unmodified
 * - Generate a 200x200 thumbnail at 60% quality WebP
 */
export async function optimizeImage(file: File): Promise<OptimizeResult> {
	const type = file.type;

	// GIF and SVG pass through unmodified (but still generate thumbnail for GIF)
	if (type === 'image/svg+xml') {
		return { optimized: file, thumbnail: file };
	}

	const img = await loadImage(file);
	const { width, height } = img;

	// Generate thumbnail
	const thumbDims = fitDimensions(width, height, THUMB_SIZE);
	const { canvas: thumbCanvas, ctx: thumbCtx } = createCanvas(thumbDims.width, thumbDims.height);
	thumbCtx.drawImage(img, 0, 0, thumbDims.width, thumbDims.height);
	const thumbnail = await canvasToBlob(thumbCanvas, 'image/webp', THUMB_QUALITY);

	// GIF: pass original through but use generated thumbnail
	if (type === 'image/gif') {
		return { optimized: file, thumbnail };
	}

	// Check if optimization can be skipped
	const fittedDims = fitDimensions(width, height, MAX_DIMENSION);
	const needsResize = fittedDims.width !== width || fittedDims.height !== height;

	if (!needsResize && file.size < SKIP_THRESHOLD) {
		return { optimized: file, thumbnail };
	}

	// Draw at target size
	const { canvas, ctx } = createCanvas(fittedDims.width, fittedDims.height);
	ctx.drawImage(img, 0, 0, fittedDims.width, fittedDims.height);

	// Determine output format
	let outputType = 'image/webp';
	let quality = QUALITY;

	if (type === 'image/png' && hasTransparency(canvas, ctx, fittedDims.width, fittedDims.height)) {
		outputType = 'image/png';
		quality = 1; // PNG is lossless, quality param ignored but set for clarity
	}

	const optimized = await canvasToBlob(canvas, outputType, quality);
	return { optimized, thumbnail };
}
