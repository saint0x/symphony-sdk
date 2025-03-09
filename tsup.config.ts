import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/symphony/index.ts',
    'src/types/sdk.ts',
    'src/types/components.ts'
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  bundle: true,
  outDir: 'dist',
  external: [
    'fsevents',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'openai',
    'winston',
    'dotenv',
    'uuid'
  ],
  noExternal: [
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'openai',
    'winston',
    'dotenv',
    'uuid'
  ],
  platform: 'node',
  target: 'node18'
}); 