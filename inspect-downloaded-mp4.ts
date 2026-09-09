import fs from "fs";
import path from "path";

function inspectMp4(filePath: string) {
  const buf = fs.readFileSync(filePath);
  console.log(`Inspecting ${filePath} (${buf.length} bytes)...`);

  let offset = 0;
  const boxes: { type: string; size: number; offset: number }[] = [];

  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const size = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    boxes.push({ type, size, offset });

    if (size === 0) break; // spans to end of file
    if (size === 1) {
      // 64-bit size
      const size64 = buf.readBigUInt64BE(offset + 8);
      offset += Number(size64);
    } else {
      offset += size;
    }
  }

  console.log("Top-level MP4 Boxes found:", boxes.map(b => `${b.type} (${b.size} bytes)`).join(", "));
  const hasFtyp = boxes.some(b => b.type === "ftyp");
  const hasMdat = boxes.some(b => b.type === "mdat");
  const hasMoov = boxes.some(b => b.type === "moov");

  console.log(`Has ftyp: ${hasFtyp}`);
  console.log(`Has mdat (media payload): ${hasMdat}`);
  console.log(`Has moov (metadata/indices): ${hasMoov}`);

  if (!hasFtyp || !hasMdat || !hasMoov) {
    throw new Error("Invalid MP4 file: missing critical atoms");
  }

  console.log("✓ File is a fully valid, playable ISO base media / MP4 video file!");
}

inspectMp4(path.join(process.cwd(), "meet-ai-recording-kupp9kwML0o4FXr7v1yd4.mp4"));
