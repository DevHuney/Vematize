/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // This is required for some platforms to properly handle dependencies.
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack: (config) => {
    // Exclude specific modules from bundling, as they are optional native dependencies
    // and may cause issues in non-Node.js environments.
    config.externals = [
      ...config.externals, 
      'kerberos', 
      'snappy', 
      'aws4', 
      '@mongodb-js/zstd', 
      'mongodb-client-encryption',
      // Adicionados para corrigir erros de compilação do middleware
      '@aws-sdk/credential-providers',
      'gcp-metadata',
      'socks'
    ];
    return config;
  },
};

export default nextConfig;
