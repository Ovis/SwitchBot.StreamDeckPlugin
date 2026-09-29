import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  name.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return out;
}

function png(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) {
    row[1 + x * 4] = 40;
    row[2 + x * 4] = 40;
    row[3 + x * 4] = 40;
    row[4 + x * 4] = 255;
  }

  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outputDir = "com.esheep.switchbot.sdPlugin/imgs";
await mkdir(outputDir, { recursive: true });

// プラグイン本体とカテゴリはAction固有のアイコンではないため、既存の共通画像を維持する。
for (const [name, width, height] of [
  ["plugin.png", 256, 256],
  ["plugin@2x.png", 512, 512],
  ["action.png", 20, 20],
  ["action@2x.png", 40, 40],
  ["key.png", 72, 72],
  ["key@2x.png", 144, 144],
]) {
  await writeFile(`${outputDir}/${name}`, png(width, height));
}

const sourceDir = "assets/icons/monochrome";
const actions = [
  "bot",
  "power",
  "lighting",
  "climate",
  "security",
  "curtains-blinds",
  "cleaning",
  "infrared-remote",
  "get-status",
  "api-request",
];

const variants = [
  ["action", 20],
  ["action@2x", 40],
  ["key", 72],
  ["key@2x", 144],
];

for (const action of actions) {
  const sourcePath = `${sourceDir}/${action}.png`;
  const metadata = await sharp(sourcePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read action icon dimensions: ${sourcePath}`);
  }

  if (metadata.width !== metadata.height) {
    throw new Error(`Action icon master must be square: ${sourcePath} (${metadata.width}x${metadata.height})`);
  }

  for (const [suffix, size] of variants) {
    // 原本側で図柄の位置と余白を確定し、ビルドでは縮小だけを行う。
    // これによりActionごとの見た目調整を生成ロジックの座標指定から分離する。
    await sharp(sourcePath)
      .resize(size, size, { fit: "fill" })
      .png()
      .toFile(`${outputDir}/${action}-${suffix}.png`);
  }
}
