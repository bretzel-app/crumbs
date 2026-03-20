import { deflateSync } from 'zlib';

// Colors: [R, G, B, A]
const TRANSPARENT = [0, 0, 0, 0];
const GOLD = [0xc8, 0x86, 0x0a, 255]; // #C8860A — bretzel body
const DARK = [0x8b, 0x69, 0x14, 255]; // #8B6914 — shading
const SALT = [0xf0, 0xe6, 0xd3, 255]; // #F0E6D3 — salt dots
const HIGHLIGHT = [0xe8, 0xa0, 0x20, 255]; // #E8A020 — highlight

// Salt shaker colors
const SHAKER_BODY = [0xfa, 0xf5, 0xeb, 255]; // #FAF5EB — white body
const SHAKER_CAP = [0x6b, 0x62, 0x72, 255]; // #6B6272 — gray cap
const SHAKER_DOTS = [0xd4, 0xca, 0xbb, 255]; // #D4CABB — holes

function encodePng(width: number, height: number, pixels: number[][]): Buffer {
	// Build raw RGBA image data with filter byte per row
	const rawData: number[] = [];
	for (let y = 0; y < height; y++) {
		rawData.push(0); // filter: None
		for (let x = 0; x < width; x++) {
			const color = pixels[y][x];
			rawData.push(color[0], color[1], color[2], color[3]);
		}
	}

	const compressed = deflateSync(Buffer.from(rawData));

	// PNG signature
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	// IHDR chunk
	const ihdr = createChunk('IHDR', () => {
		const buf = Buffer.alloc(13);
		buf.writeUInt32BE(width, 0);
		buf.writeUInt32BE(height, 4);
		buf[8] = 8; // bit depth
		buf[9] = 6; // color type: RGBA
		buf[10] = 0; // compression
		buf[11] = 0; // filter
		buf[12] = 0; // interlace
		return buf;
	});

	// IDAT chunk
	const idat = createChunk('IDAT', () => compressed);

	// IEND chunk
	const iend = createChunk('IEND', () => Buffer.alloc(0));

	return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type: string, dataFn: () => Buffer): Buffer {
	const data = dataFn();
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);

	const typeBuffer = Buffer.from(type, 'ascii');
	const crcInput = Buffer.concat([typeBuffer, data]);

	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(crcInput), 0);

	return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf: Buffer): number {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		crc ^= buf[i];
		for (let j = 0; j < 8; j++) {
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 64x64 pixel-art bretzel in warm browns/golds.
 * Shape: classic pretzel knot with salt dots.
 */
export function generateBretzelPng(): Buffer {
	const S = 64;
	const pixels: number[][][] = Array.from({ length: S }, () =>
		Array.from({ length: S }, () => TRANSPARENT)
	);

	// Draw a pretzel shape using circles and arcs
	// The bretzel is two loops connected by a twist in the center

	function setPixel(x: number, y: number, color: number[]) {
		if (x >= 0 && x < S && y >= 0 && y < S) {
			pixels[y][x] = color;
		}
	}

	function fillCircle(cx: number, cy: number, r: number, color: number[]) {
		for (let y = -r; y <= r; y++) {
			for (let x = -r; x <= r; x++) {
				if (x * x + y * y <= r * r) {
					setPixel(cx + x, cy + y, color);
				}
			}
		}
	}

	function drawRing(cx: number, cy: number, outerR: number, innerR: number, color: number[]) {
		for (let y = -outerR; y <= outerR; y++) {
			for (let x = -outerR; x <= outerR; x++) {
				const d = x * x + y * y;
				if (d <= outerR * outerR && d >= innerR * innerR) {
					setPixel(cx + x, cy + y, color);
				}
			}
		}
	}

	// Main pretzel shape: two overlapping loops
	// Left loop
	drawRing(22, 28, 16, 11, GOLD);
	// Right loop
	drawRing(42, 28, 16, 11, GOLD);

	// Top arm going up to center crossing
	fillCircle(32, 14, 5, GOLD);
	// Connect top to loops with thicker arms
	for (let y = 12; y <= 22; y++) {
		const spread = Math.floor((22 - y) * 0.6);
		for (let x = -3; x <= 3; x++) {
			setPixel(22 + spread + x, y, GOLD);
			setPixel(42 - spread + x, y, GOLD);
		}
	}

	// Cross-over: two diagonal arms crossing at center
	for (let i = -8; i <= 8; i++) {
		for (let w = -2; w <= 2; w++) {
			// Left arm crosses to right bottom
			setPixel(32 + i, 24 + Math.floor(i * 0.5) + w, GOLD);
			// Right arm crosses to left bottom
			setPixel(32 + i, 24 - Math.floor(i * 0.5) + w, GOLD);
		}
	}

	// Bottom connection
	for (let x = 18; x <= 46; x++) {
		for (let y = 40; y <= 44; y++) {
			const dx = x - 32;
			const distFromCenter = Math.abs(dx);
			if (distFromCenter <= 14) {
				setPixel(x, y, GOLD);
			}
		}
	}

	// Add shading (darker on bottom-right edges)
	for (let y = 0; y < S; y++) {
		for (let x = 0; x < S; x++) {
			if (pixels[y][x] === GOLD) {
				// Check if near edge
				let nearEdge = false;
				for (const [dx, dy] of [
					[1, 0],
					[0, 1],
					[1, 1]
				]) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx >= S || ny >= S || pixels[ny][nx] === TRANSPARENT) {
						nearEdge = true;
						break;
					}
				}
				if (nearEdge) {
					setPixel(x, y, DARK);
				}
			}
		}
	}

	// Add highlight on top-left edges
	for (let y = 0; y < S; y++) {
		for (let x = 0; x < S; x++) {
			if (pixels[y][x] === GOLD) {
				let nearTopEdge = false;
				for (const [dx, dy] of [
					[-1, 0],
					[0, -1]
				]) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || pixels[ny][nx] === TRANSPARENT) {
						nearTopEdge = true;
						break;
					}
				}
				if (nearTopEdge) {
					setPixel(x, y, HIGHLIGHT);
				}
			}
		}
	}

	// Salt dots scattered on the bretzel
	const saltPositions = [
		[20, 24],
		[24, 20],
		[28, 16],
		[36, 16],
		[40, 20],
		[44, 24],
		[24, 32],
		[40, 32],
		[30, 28],
		[34, 28],
		[26, 40],
		[32, 42],
		[38, 40]
	];
	for (const [sx, sy] of saltPositions) {
		if (pixels[sy]?.[sx] && pixels[sy][sx] !== TRANSPARENT) {
			setPixel(sx, sy, SALT);
			setPixel(sx + 1, sy, SALT);
			setPixel(sx, sy + 1, SALT);
		}
	}

	return encodePng(S, S, pixels);
}

/**
 * 32x32 pixel-art salt shaker.
 */
export function generateSaltShakerPng(): Buffer {
	const S = 32;
	const pixels: number[][][] = Array.from({ length: S }, () =>
		Array.from({ length: S }, () => TRANSPARENT)
	);

	function setPixel(x: number, y: number, color: number[]) {
		if (x >= 0 && x < S && y >= 0 && y < S) {
			pixels[y][x] = color;
		}
	}

	function fillRect(x1: number, y1: number, x2: number, y2: number, color: number[]) {
		for (let y = y1; y <= y2; y++) {
			for (let x = x1; x <= x2; x++) {
				setPixel(x, y, color);
			}
		}
	}

	// Cap (top section)
	fillRect(11, 4, 20, 8, SHAKER_CAP);

	// Cap holes (salt comes out)
	setPixel(13, 5, SHAKER_DOTS);
	setPixel(16, 5, SHAKER_DOTS);
	setPixel(19, 5, SHAKER_DOTS);
	setPixel(14, 7, SHAKER_DOTS);
	setPixel(17, 7, SHAKER_DOTS);

	// Neck
	fillRect(12, 9, 19, 10, SHAKER_BODY);

	// Body (wider, tapered)
	fillRect(10, 11, 21, 26, SHAKER_BODY);

	// Body shading (right edge darker)
	for (let y = 11; y <= 26; y++) {
		setPixel(21, y, SHAKER_DOTS);
	}

	// Body outline
	for (let y = 11; y <= 26; y++) {
		setPixel(9, y, DARK);
		setPixel(22, y, DARK);
	}
	for (let x = 10; x <= 21; x++) {
		setPixel(x, 27, DARK);
	}

	// Bottom rim
	fillRect(9, 27, 22, 28, SHAKER_CAP);

	// "S" label on the body
	const sPattern = [
		[14, 16],
		[15, 16],
		[16, 16],
		[13, 17],
		[14, 18],
		[15, 18],
		[16, 19],
		[13, 20],
		[14, 20],
		[15, 20]
	];
	for (const [x, y] of sPattern) {
		setPixel(x, y, SHAKER_CAP);
	}

	// Falling salt particles
	setPixel(14, 2, SALT);
	setPixel(17, 1, SALT);
	setPixel(19, 3, SALT);
	setPixel(12, 1, SALT);

	return encodePng(S, S, pixels);
}
