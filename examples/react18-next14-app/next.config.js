/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.example.com', 'cdn.example.com'],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = __dirname + '/src';
    return config;
  },
};

module.exports = nextConfig;
