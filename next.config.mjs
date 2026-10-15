/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // makes deployment on the company server simpler later
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;