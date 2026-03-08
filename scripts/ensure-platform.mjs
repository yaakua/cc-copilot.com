const expectedPlatform = process.argv[2];

if (!expectedPlatform) {
  console.error("Expected platform argument.");
  process.exit(1);
}

if (process.platform !== expectedPlatform) {
  console.error(
    `This build script must run on ${expectedPlatform}, current platform is ${process.platform}.`,
  );
  process.exit(1);
}
