/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack: (config) => {
    config.externals = [
      ...config.externals, 
      'kerberos', 
      'snappy', 
      'aws4', 
      '@mongodb-js/zstd', 
      'mongodb-client-encryption',
      '@aws-sdk/credential-providers',
      'gcp-metadata',
      'socks'
    ];
    return config;
  },
};

export default nextConfig;
