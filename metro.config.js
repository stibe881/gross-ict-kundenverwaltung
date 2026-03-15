const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ensure that asset Exts are fully comprehensive
config.resolver.assetExts.push("ttf", "png");

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
