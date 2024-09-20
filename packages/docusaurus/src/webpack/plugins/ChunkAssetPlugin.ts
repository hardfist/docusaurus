/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Compiler } from '@rspack/core';
import type webpack from '@rspack/core';

// Adds a custom Docusaurus Webpack runtime function `__webpack_require__.gca`
// gca = Get Chunk Asset, it converts a chunkName to a JS asset URL
// It is called in Core client/docusaurus.ts for chunk preloading/prefetching
// Example: gca("814f3328") = "/baseUrl/assets/js/814f3328.03fcc178.js"
// See also: https://github.com/facebook/docusaurus/pull/10485

// The name of the custom Docusaurus Webpack runtime function
const DocusaurusGetChunkAssetFn = '__webpack_require__.gca';

const PluginName = 'Docusaurus-ChunkAssetPlugin';


/*
 Note: we previously used `MainTemplate.hooks.requireExtensions.tap()`
 But it will be removed in Webpack 6 and is not supported by Rspack
 So instead we use equivalent code inspired by:
 - https://github.com/webpack/webpack/blob/v5.94.0/lib/RuntimePlugin.js#L462
 - https://github.com/webpack/webpack/blob/v5.94.0/lib/runtime/CompatRuntimeModule.js
 */
export default class ChunkAssetPlugin {
  apply(compiler: Compiler): void {
    
    const webpack = compiler.webpack;
    class ChunkAssetRuntimeModule extends webpack.RuntimeModule {
      constructor(chunk: any) {
        super('ChunkAssetRuntimeModule', webpack.RuntimeModule.STAGE_ATTACH);
        this.fullHash = true;
        (this as any).chunk = chunk
      }
      override generate() {
        let code = generateGetChunkAssetRuntimeCode((this as any).chunk!);
        console.log('code:', code);
        return code;
      }
    }
    // eslint-disable-next-line
    function generateGetChunkAssetRuntimeCode(chunk: webpack.Chunk): string {
      const chunkIdToName = chunk.getChunkMaps(false).name;
      const chunkNameToId = Object.fromEntries(
        Object.entries(chunkIdToName).map(([chunkId, chunkName]) => [
          chunkName,
          chunkId,
        ]),
      );

      const {
        // publicPath = __webpack_require__.p
        // Example: "/" or "/baseUrl/"
        // https://github.com/webpack/webpack/blob/v5.94.0/lib/runtime/PublicPathRuntimeModule.js
        publicPath,

        // getChunkScriptFilename = __webpack_require__.u
        // Example: getChunkScriptFilename("814f3328") = "814f3328.03fcc178.js"
        // https://github.com/webpack/webpack/blob/v5.94.0/lib/runtime/GetChunkFilenameRuntimeModule.js
        getChunkScriptFilename,
      } = webpack.RuntimeGlobals;

      const code = `// Docusaurus function to get chunk asset
${DocusaurusGetChunkAssetFn} = function(chunkId) { chunkId = ${JSON.stringify(
        chunkNameToId,
      )}[chunkId]||chunkId; return ${publicPath} + ${getChunkScriptFilename}(chunkId); };`;

      return webpack.Template.asString(code);
    }
    console.log('compiler')
    compiler.hooks.thisCompilation.tap(PluginName, (compilation) => {
      console.log('compilation:', compilation.compiler.name);
      compilation.hooks.runtimeRequirementInTree.tap(
        PluginName,
        // eslint-disable-next-line
        (chunk) => {
          console.log('runtidme dchunk');
          compilation.addRuntimeModule(chunk, new ChunkAssetRuntimeModule(chunk));
        },
      );
    });
  }
}

// Inspired by https://github.com/webpack/webpack/blob/v5.94.0/lib/runtime/CompatRuntimeModule.js

