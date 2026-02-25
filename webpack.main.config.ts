import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  // node-pty is a native module with conpty.dll/winpty-agent.exe dependencies.
  // Exclude from webpack bundling so Node.js loads it directly from node_modules.
  externals: {
    'node-pty': 'commonjs node-pty',
  },
};
