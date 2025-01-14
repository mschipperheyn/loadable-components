"use strict";

exports.__esModule = true;
exports.default = void 0;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _uniq = _interopRequireDefault(require("lodash/uniq"));

var _uniqBy = _interopRequireDefault(require("lodash/uniqBy"));

var _flatMap = _interopRequireDefault(require("lodash/flatMap"));

var _react = _interopRequireDefault(require("react"));

var _sharedInternals = require("./sharedInternals");

var _ChunkExtractorManager = _interopRequireDefault(require("./ChunkExtractorManager"));

var _util = require("./util");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

const EXTENSION_SCRIPT_TYPES = {
  '.js': 'script',
  '.css': 'style'
};

function extensionToScriptType(extension) {
  return EXTENSION_SCRIPT_TYPES[extension] || null;
}

function getAssets(chunks, getAsset) {
  return (0, _uniqBy.default)((0, _flatMap.default)(chunks, chunk => getAsset(chunk)), 'url');
}

function handleExtraProps(asset, extraProps) {
  return typeof extraProps === 'function' ? extraProps(asset) : extraProps;
}

function extraPropsToString(asset, extraProps) {
  return Object.entries(handleExtraProps(asset, extraProps)).reduce((acc, [key, value]) => `${acc} ${key}="${value}"`, '');
}

function getSriHtmlAttributes(asset) {
  if (!asset.integrity) {
    return '';
  }

  return ` integrity="${asset.integrity}"`;
}

function assetToScriptTag(asset, extraProps) {
  return `<script async data-chunk="${asset.chunk}" src="${asset.url}"${getSriHtmlAttributes(asset)}${extraPropsToString(asset, extraProps)}></script>`;
}

function assetToScriptElement(asset, extraProps) {
  return _react.default.createElement("script", Object.assign({
    key: asset.url,
    async: true,
    "data-chunk": asset.chunk,
    src: asset.url
  }, handleExtraProps(asset, extraProps)));
}

function assetToStyleString(asset, {
  inputFileSystem
}) {
  return new Promise((resolve, reject) => {
    inputFileSystem.readFile(asset.path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(data);
    });
  });
}

function assetToStyleTag(asset, extraProps) {
  return `<link data-chunk="${asset.chunk}" rel="stylesheet" href="${asset.url}"${getSriHtmlAttributes(asset)}${extraPropsToString(asset, extraProps)}>`;
}

function assetToStyleTagInline(asset, extraProps, {
  inputFileSystem
}) {
  return new Promise((resolve, reject) => {
    inputFileSystem.readFile(asset.path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(`<style type="text/css" data-chunk="${asset.chunk}"${extraPropsToString(asset, extraProps)}>
${data}
</style>`);
    });
  });
}

function assetToStyleElement(asset, extraProps) {
  return _react.default.createElement("link", Object.assign({
    key: asset.url,
    "data-chunk": asset.chunk,
    rel: "stylesheet",
    href: asset.url
  }, handleExtraProps(asset, extraProps)));
}

function assetToStyleElementInline(asset, extraProps, {
  inputFileSystem
}) {
  return new Promise((resolve, reject) => {
    inputFileSystem.readFile(asset.path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(_react.default.createElement("style", Object.assign({
        key: asset.url,
        "data-chunk": asset.chunk,
        dangerouslySetInnerHTML: {
          __html: data
        }
      }, handleExtraProps(asset, extraProps))));
    });
  });
}

const LINK_ASSET_HINTS = {
  mainAsset: 'data-chunk',
  childAsset: 'data-parent-chunk'
};

function assetToLinkTag(asset, extraProps) {
  const hint = LINK_ASSET_HINTS[asset.type];
  return `<link ${hint}="${asset.chunk}" rel="${asset.linkType}" as="${asset.scriptType}" href="${asset.url}"${getSriHtmlAttributes(asset)}${extraPropsToString(asset, extraProps)}>`;
}

function assetToLinkElement(asset, extraProps) {
  const hint = LINK_ASSET_HINTS[asset.type];

  const props = _extends({
    key: asset.url,
    [hint]: asset.chunk,
    rel: asset.linkType,
    as: asset.scriptType,
    href: asset.url
  }, handleExtraProps(asset, extraProps));

  return _react.default.createElement("link", props);
}

function joinTags(tags) {
  return tags.join('\n');
}

const HOT_UPDATE_REGEXP = /\.hot-update\.js$/;

function isValidChunkAsset(chunkAsset) {
  return chunkAsset.scriptType && !HOT_UPDATE_REGEXP.test(chunkAsset.filename);
}

class ChunkExtractor {
  constructor({
    statsFile,
    stats,
    entrypoints = ['main'],
    namespace = '',
    outputPath,
    publicPath,
    inputFileSystem = _fs.default
  } = {}) {
    this.namespace = namespace;
    this.stats = stats || (0, _util.smartRequire)(statsFile);
    this.publicPath = publicPath || this.stats.publicPath;
    this.outputPath = outputPath || this.stats.outputPath;
    this.statsFile = statsFile;
    this.entrypoints = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
    this.chunks = [];
    this.inputFileSystem = inputFileSystem;
  }

  resolvePublicUrl(filename) {
    return (0, _util.joinURLPath)(this.publicPath, filename);
  }

  getChunkGroup(chunk) {
    const chunkGroup = this.stats.namedChunkGroups[chunk];
    (0, _sharedInternals.invariant)(chunkGroup, `cannot find ${chunk} in stats`);
    return chunkGroup;
  }

  createChunkAsset({
    filename,
    chunk,
    type,
    linkType
  }) {
    return {
      filename,
      scriptType: extensionToScriptType(_path.default.extname(filename).split('?')[0].toLowerCase()),
      chunk,
      url: this.resolvePublicUrl(filename),
      path: _path.default.join(this.outputPath, filename),
      type,
      linkType
    };
  }

  getChunkAssets(chunks) {
    const one = chunk => {
      const chunkGroup = this.getChunkGroup(chunk);
      return chunkGroup.assets.map(filename => this.createChunkAsset({
        filename,
        chunk,
        type: 'mainAsset',
        linkType: 'preload'
      })).filter(isValidChunkAsset);
    };

    if (Array.isArray(chunks)) {
      return getAssets(chunks, one);
    }

    return one(chunks);
  }

  getChunkChildAssets(chunks, type) {
    const one = chunk => {
      const chunkGroup = this.getChunkGroup(chunk);
      const assets = chunkGroup.childAssets[type] || [];
      return assets.map(filename => this.createChunkAsset({
        filename,
        chunk,
        type: 'childAsset',
        linkType: type
      })).filter(isValidChunkAsset);
    };

    if (Array.isArray(chunks)) {
      return getAssets(chunks, one);
    }

    return one(chunks);
  }

  getChunkDependencies(chunks) {
    const one = chunk => {
      const chunkGroup = this.getChunkGroup(chunk);
      return chunkGroup.chunks;
    };

    if (Array.isArray(chunks)) {
      return (0, _uniq.default)((0, _flatMap.default)(chunks, one));
    }

    return one(chunks);
  }

  getRequiredChunksScriptContent() {
    return JSON.stringify(this.getChunkDependencies(this.chunks));
  }

  getRequiredChunksScriptTag(extraProps) {
    return `<script id="${(0, _sharedInternals.getRequiredChunkKey)(this.namespace)}" type="application/json"${extraPropsToString(null, extraProps)}>${this.getRequiredChunksScriptContent()}</script>`;
  }

  getRequiredChunksScriptElement(extraProps) {
    return _react.default.createElement("script", Object.assign({
      key: "required",
      id: (0, _sharedInternals.getRequiredChunkKey)(this.namespace),
      type: "application/json",
      dangerouslySetInnerHTML: {
        __html: this.getRequiredChunksScriptContent()
      }
    }, handleExtraProps(null, extraProps)));
  } // Public methods
  // -----------------
  // Collect


  addChunk(chunk) {
    if (this.chunks.indexOf(chunk) !== -1) return;
    this.chunks.push(chunk);
  }

  collectChunks(app) {
    return _react.default.createElement(_ChunkExtractorManager.default, {
      extractor: this
    }, app);
  } // Utilities


  requireEntrypoint(entrypoint) {
    entrypoint = entrypoint || this.entrypoints[0];
    const assets = this.getChunkAssets(entrypoint);
    const mainAsset = assets.find(asset => asset.scriptType === 'script');
    (0, _sharedInternals.invariant)(mainAsset, 'asset not found');
    this.stats.assets.filter(({
      name
    }) => {
      const type = extensionToScriptType(_path.default.extname(name).split('?')[0].toLowerCase());
      return type === 'script';
    }).forEach(({
      name
    }) => {
      (0, _util.smartRequire)(_path.default.join(this.outputPath, name.split('?')[0]));
    });
    return (0, _util.smartRequire)(mainAsset.path);
  } // Main assets


  getMainAssets(scriptType) {
    const chunks = [...this.entrypoints, ...this.chunks];
    const assets = this.getChunkAssets(chunks);

    if (scriptType) {
      return assets.filter(asset => asset.scriptType === scriptType);
    }

    return assets;
  }

  getScriptTags(extraProps = {}) {
    const requiredScriptTag = this.getRequiredChunksScriptTag(extraProps);
    const mainAssets = this.getMainAssets('script');
    const assetsScriptTags = mainAssets.map(asset => assetToScriptTag(asset, extraProps));
    return joinTags([requiredScriptTag, ...assetsScriptTags]);
  }

  getScriptElements(extraProps = {}) {
    const requiredScriptElement = this.getRequiredChunksScriptElement(extraProps);
    const mainAssets = this.getMainAssets('script');
    const assetsScriptElements = mainAssets.map(asset => assetToScriptElement(asset, extraProps));
    return [requiredScriptElement, ...assetsScriptElements];
  }

  getCssString() {
    const mainAssets = this.getMainAssets('style');
    const promises = mainAssets.map(asset => assetToStyleString(asset, this).then(data => data));
    return Promise.all(promises).then(results => joinTags(results));
  }

  getStyleTags(extraProps = {}) {
    const mainAssets = this.getMainAssets('style');
    return joinTags(mainAssets.map(asset => assetToStyleTag(asset, extraProps)));
  }

  getInlineStyleTags(extraProps = {}) {
    const mainAssets = this.getMainAssets('style');
    const promises = mainAssets.map(asset => assetToStyleTagInline(asset, extraProps, this).then(data => data));
    return Promise.all(promises).then(results => joinTags(results));
  }

  getStyleElements(extraProps = {}) {
    const mainAssets = this.getMainAssets('style');
    return mainAssets.map(asset => assetToStyleElement(asset, extraProps));
  }

  getInlineStyleElements(extraProps = {}) {
    const mainAssets = this.getMainAssets('style');
    const promises = mainAssets.map(asset => assetToStyleElementInline(asset, extraProps, this).then(data => data));
    return Promise.all(promises).then(results => results);
  } // Pre assets


  getPreAssets() {
    const mainAssets = this.getMainAssets();
    const chunks = [...this.entrypoints, ...this.chunks];
    const preloadAssets = this.getChunkChildAssets(chunks, 'preload');
    const prefetchAssets = this.getChunkChildAssets(chunks, 'prefetch');
    return [...mainAssets, ...preloadAssets, ...prefetchAssets];
  }

  getLinkTags(extraProps = {}) {
    const assets = this.getPreAssets();
    const linkTags = assets.map(asset => assetToLinkTag(asset, extraProps));
    return joinTags(linkTags);
  }

  getLinkElements(extraProps = {}) {
    const assets = this.getPreAssets();
    return assets.map(asset => assetToLinkElement(asset, extraProps));
  }

}

var _default = ChunkExtractor;
exports.default = _default;