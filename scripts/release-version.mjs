const tag = process.argv[2];

if (!tag) {
  console.error("Usage: node scripts/release-version.mjs <tag>");
  process.exit(2);
}

const match = /^v(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)([1-9]\d{0,2}))?$/.exec(tag);
if (!match) {
  console.error("Tag must match vMAJOR.MINOR.PATCH, optionally followed by -alphaN, -betaN, or -rcN (N=1..999).");
  process.exit(2);
}

const [, major, minor, patch, channel, sequenceText] = match;
const sequence = sequenceText ? Number(sequenceText) : undefined;
let build = 9999;
if (channel === "alpha") build = sequence;
if (channel === "beta") build = 1000 + sequence;
if (channel === "rc") build = 2000 + sequence;

const result = {
  tag,
  manifestVersion: `${major}.${minor}.${patch}.${build}`,
  prerelease: channel !== undefined,
  channel: channel ?? "stable"
};

if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT,
    `manifest_version=${result.manifestVersion}\nprerelease=${result.prerelease}\nchannel=${result.channel}\n`);
}

console.log(JSON.stringify(result));
