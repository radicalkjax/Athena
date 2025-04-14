/**
 * Copyright © 2022 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MetroBundlerDevServer", {
    enumerable: true,
    get: ()=>MetroBundlerDevServer
});
function _config() {
    const data = require("@expo/config");
    _config = function() {
        return data;
    };
    return data;
}
function _paths() {
    const data = require("@expo/config/paths");
    _paths = function() {
        return data;
    };
    return data;
}
function _env() {
    const data = /*#__PURE__*/ _interopRequireWildcard(require("@expo/env"));
    _env = function() {
        return data;
    };
    return data;
}
function _assert() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("assert"));
    _assert = function() {
        return data;
    };
    return data;
}
function _chalk() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("chalk"));
    _chalk = function() {
        return data;
    };
    return data;
}
function _baseJSBundle() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("metro/src/DeltaBundler/Serializers/baseJSBundle"));
    _baseJSBundle = function() {
        return data;
    };
    return data;
}
function _sourceMapGenerator() {
    const data = require("metro/src/DeltaBundler/Serializers/sourceMapGenerator");
    _sourceMapGenerator = function() {
        return data;
    };
    return data;
}
function _bundleToString() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("metro/src/lib/bundleToString"));
    _bundleToString = function() {
        return data;
    };
    return data;
}
function _getGraphId() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("metro/src/lib/getGraphId"));
    _getGraphId = function() {
        return data;
    };
    return data;
}
function _path() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("path"));
    _path = function() {
        return data;
    };
    return data;
}
function _resolveFrom() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("resolve-from"));
    _resolveFrom = function() {
        return data;
    };
    return data;
}
const _createServerComponentsMiddleware = require("./createServerComponentsMiddleware");
const _createServerRouteMiddleware = require("./createServerRouteMiddleware");
const _fetchRouterManifest = require("./fetchRouterManifest");
const _instantiateMetro = require("./instantiateMetro");
const _metroErrorInterface = require("./metroErrorInterface");
const _metroPrivateServer = require("./metroPrivateServer");
const _metroWatchTypeScriptFiles = require("./metroWatchTypeScriptFiles");
const _router = require("./router");
const _serializeHtml = require("./serializeHtml");
const _waitForMetroToObserveTypeScriptFile = require("./waitForMetroToObserveTypeScriptFile");
const _log = require("../../../log");
const _env1 = require("../../../utils/env");
const _errors = require("../../../utils/errors");
const _filePath = require("../../../utils/filePath");
const _port = require("../../../utils/port");
const _bundlerDevServer = require("../BundlerDevServer");
const _getStaticRenderFunctions = require("../getStaticRenderFunctions");
const _contextModuleSourceMapsMiddleware = require("../middleware/ContextModuleSourceMapsMiddleware");
const _createFileMiddleware = require("../middleware/CreateFileMiddleware");
const _devToolsPluginMiddleware = require("../middleware/DevToolsPluginMiddleware");
const _domComponentsMiddleware = require("../middleware/DomComponentsMiddleware");
const _faviconMiddleware = require("../middleware/FaviconMiddleware");
const _historyFallbackMiddleware = require("../middleware/HistoryFallbackMiddleware");
const _interstitialPageMiddleware = require("../middleware/InterstitialPageMiddleware");
const _manifestMiddleware = require("../middleware/ManifestMiddleware");
const _reactDevToolsPageMiddleware = require("../middleware/ReactDevToolsPageMiddleware");
const _runtimeRedirectMiddleware = require("../middleware/RuntimeRedirectMiddleware");
const _serveStaticMiddleware = require("../middleware/ServeStaticMiddleware");
const _metroOptions = require("../middleware/metroOptions");
const _mutations = require("../middleware/mutations");
const _startTypescriptTypeGeneration = require("../type-generation/startTypescriptTypeGeneration");
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interopRequireWildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {};
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const debug = require("debug")("expo:start:server:metro");
/** Default port to use for apps running in Expo Go. */ const EXPO_GO_METRO_PORT = 8081;
/** Default port to use for apps that run in standard React Native projects or Expo Dev Clients. */ const DEV_CLIENT_METRO_PORT = 8081;
class MetroBundlerDevServer extends _bundlerDevServer.BundlerDevServer {
    metro = null;
    hmrServer = null;
    ssrHmrClients = new Map();
    get name() {
        return "metro";
    }
    async resolvePortAsync(options = {}) {
        const port = // If the manually defined port is busy then an error should be thrown...
        options.port ?? // Otherwise use the default port based on the runtime target.
        (options.devClient ? Number(process.env.RCT_METRO_PORT) || DEV_CLIENT_METRO_PORT : await (0, _port.getFreePortAsync)(EXPO_GO_METRO_PORT));
        return port;
    }
    async exportExpoRouterApiRoutesAsync({ includeSourceMaps , outputDir , prerenderManifest , platform  }) {
        const { routerRoot  } = this.instanceMetroOptions;
        (0, _assert().default)(routerRoot != null, "The server must be started before calling exportExpoRouterApiRoutesAsync.");
        const appDir = _path().default.join(this.projectRoot, routerRoot);
        const manifest = await this.getExpoRouterRoutesManifestAsync({
            appDir
        });
        const files = new Map();
        // Inject RSC middleware.
        const rscPath = "/_flight/[...rsc]";
        if (this.isReactServerComponentsEnabled && // If the RSC route is not already in the manifest, add it.
        !manifest.apiRoutes.find((route)=>route.page.startsWith("/_flight/"))) {
            debug("Adding RSC route to the manifest:", rscPath);
            // NOTE: This might need to be sorted to the correct spot in the future.
            manifest.apiRoutes.push({
                file: (0, _resolveFrom().default)(this.projectRoot, "@expo/cli/static/template/[...rsc]+api.ts"),
                page: rscPath,
                namedRegex: "^/_flight(?:/(?<rsc>.+?))?(?:/)?$",
                routeKeys: {
                    rsc: "rsc"
                }
            });
        }
        for (const route of manifest.apiRoutes){
            const filepath = _path().default.isAbsolute(route.file) ? route.file : _path().default.join(appDir, route.file);
            const contents = await this.bundleApiRoute(filepath, {
                platform
            });
            const artifactFilename = route.page === rscPath ? (0, _metroOptions.convertPathToModuleSpecifier)(_path().default.join(outputDir, "." + rscPath + ".js")) : (0, _metroOptions.convertPathToModuleSpecifier)(_path().default.join(outputDir, _path().default.relative(appDir, filepath.replace(/\.[tj]sx?$/, ".js"))));
            if (contents) {
                let src = contents.src;
                if (includeSourceMaps && contents.map) {
                    // TODO(kitten): Merge the source map transformer in the future
                    // https://github.com/expo/expo/blob/0dffdb15/packages/%40expo/metro-config/src/serializer/serializeChunks.ts#L422-L439
                    // Alternatively, check whether `sourcesRoot` helps here
                    const artifactBasename = encodeURIComponent(_path().default.basename(artifactFilename) + ".map");
                    src = src.replace(/\/\/# sourceMappingURL=.*/g, `//# sourceMappingURL=${artifactBasename}`);
                    const parsedMap = typeof contents.map === "string" ? JSON.parse(contents.map) : contents.map;
                    files.set(artifactFilename + ".map", {
                        contents: JSON.stringify({
                            version: parsedMap.version,
                            sources: parsedMap.sources.map((source)=>{
                                source = typeof source === "string" && source.startsWith(this.projectRoot) ? _path().default.relative(this.projectRoot, source) : source;
                                return (0, _metroOptions.convertPathToModuleSpecifier)(source);
                            }),
                            sourcesContent: new Array(parsedMap.sources.length).fill(null),
                            names: parsedMap.names,
                            mappings: parsedMap.mappings
                        }),
                        apiRouteId: route.page,
                        targetDomain: "server"
                    });
                }
                files.set(artifactFilename, {
                    contents: src,
                    apiRouteId: route.page,
                    targetDomain: "server"
                });
            }
            // Remap the manifest files to represent the output files.
            route.file = artifactFilename;
        }
        return {
            manifest: {
                ...manifest,
                htmlRoutes: prerenderManifest.htmlRoutes
            },
            files
        };
    }
    async getExpoRouterRoutesManifestAsync({ appDir  }) {
        var ref, ref1;
        // getBuiltTimeServerManifest
        const { exp  } = (0, _config().getConfig)(this.projectRoot);
        const manifest = await (0, _fetchRouterManifest.fetchManifest)(this.projectRoot, {
            ...(ref = exp.extra) == null ? void 0 : (ref1 = ref.router) == null ? void 0 : ref1.platformRoutes,
            asJson: true,
            appDir
        });
        if (!manifest) {
            throw new _errors.CommandError("EXPO_ROUTER_SERVER_MANIFEST", "Unexpected error: server manifest could not be fetched.");
        }
        return manifest;
    }
    async getServerManifestAsync() {
        // NOTE: This could probably be folded back into `renderStaticContent` when expo-asset and font support RSC.
        const { getBuildTimeServerManifestAsync , getManifest  } = await this.ssrLoadModule("expo-router/build/static/getServerManifest.js", {
            // Only use react-server environment when the routes are using react-server rendering by default.
            environment: this.isReactServerRoutesEnabled ? "react-server" : "node"
        });
        return {
            serverManifest: await getBuildTimeServerManifestAsync(),
            htmlManifest: await getManifest()
        };
    }
    async getStaticRenderFunctionAsync() {
        var ref;
        const url = this.getDevServerUrlOrAssert();
        const { getStaticContent , getManifest , getBuildTimeServerManifestAsync  } = await this.ssrLoadModule("expo-router/node/render.js", {
            // This must always use the legacy rendering resolution (no `react-server`) because it leverages
            // the previous React SSG utilities which aren't available in React 19.
            environment: "node"
        });
        const { exp  } = (0, _config().getConfig)(this.projectRoot);
        return {
            serverManifest: await getBuildTimeServerManifestAsync(),
            // Get routes from Expo Router.
            manifest: await getManifest({
                preserveApiRoutes: false,
                ...(ref = exp.extra) == null ? void 0 : ref.router
            }),
            // Get route generating function
            async renderAsync (path) {
                return await getStaticContent(new URL(path, url));
            }
        };
    }
    async getStaticResourcesAsync({ includeSourceMaps , mainModuleName , clientBoundaries =this.instanceMetroOptions.clientBoundaries ?? [] , platform ="web"  } = {}) {
        const { mode , minify , isExporting , baseUrl , reactCompiler , routerRoot , asyncRoutes  } = this.instanceMetroOptions;
        (0, _assert().default)(mode != null && isExporting != null && baseUrl != null && routerRoot != null && reactCompiler != null && asyncRoutes != null, "The server must be started before calling getStaticResourcesAsync.");
        const resolvedMainModuleName = mainModuleName ?? "./" + (0, _manifestMiddleware.resolveMainModuleName)(this.projectRoot, {
            platform
        });
        return await this.metroImportAsArtifactsAsync(resolvedMainModuleName, {
            splitChunks: isExporting && !_env1.env.EXPO_NO_BUNDLE_SPLITTING,
            platform,
            mode,
            minify,
            environment: "client",
            serializerIncludeMaps: includeSourceMaps,
            mainModuleName: resolvedMainModuleName,
            lazy: (0, _metroOptions.shouldEnableAsyncImports)(this.projectRoot),
            asyncRoutes,
            baseUrl,
            isExporting,
            routerRoot,
            clientBoundaries,
            reactCompiler,
            bytecode: false
        });
    }
    async getStaticPageAsync(pathname) {
        const { mode , isExporting , clientBoundaries , baseUrl , reactCompiler , routerRoot , asyncRoutes  } = this.instanceMetroOptions;
        (0, _assert().default)(mode != null && isExporting != null && baseUrl != null && reactCompiler != null && routerRoot != null && asyncRoutes != null, "The server must be started before calling getStaticPageAsync.");
        const platform = "web";
        const devBundleUrlPathname = (0, _metroOptions.createBundleUrlPath)({
            splitChunks: isExporting && !_env1.env.EXPO_NO_BUNDLE_SPLITTING,
            platform,
            mode,
            environment: "client",
            reactCompiler,
            mainModuleName: (0, _manifestMiddleware.resolveMainModuleName)(this.projectRoot, {
                platform
            }),
            lazy: (0, _metroOptions.shouldEnableAsyncImports)(this.projectRoot),
            baseUrl,
            isExporting,
            asyncRoutes,
            routerRoot,
            clientBoundaries,
            bytecode: false
        });
        const bundleStaticHtml = async ()=>{
            const { getStaticContent  } = await this.ssrLoadModule("expo-router/node/render.js", {
                // This must always use the legacy rendering resolution (no `react-server`) because it leverages
                // the previous React SSG utilities which aren't available in React 19.
                environment: "node",
                minify: false,
                isExporting,
                platform
            });
            const location = new URL(pathname, this.getDevServerUrlOrAssert());
            return await getStaticContent(location);
        };
        const [{ artifacts: resources  }, staticHtml] = await Promise.all([
            this.getStaticResourcesAsync({
                clientBoundaries: []
            }),
            bundleStaticHtml(), 
        ]);
        const content = (0, _serializeHtml.serializeHtmlWithAssets)({
            isExporting,
            resources,
            template: staticHtml,
            devBundleUrl: devBundleUrlPathname,
            baseUrl,
            hydrate: _env1.env.EXPO_WEB_DEV_HYDRATE
        });
        return {
            content,
            resources
        };
    }
    // Set when the server is started.
    instanceMetroOptions = {};
    ssrLoadModule = async (filePath, specificOptions = {}, extras = {})=>{
        const res = await this.ssrLoadModuleContents(filePath, specificOptions);
        if (// TODO: hot should be a callback function for invalidating the related SSR module.
        extras.hot && this.instanceMetroOptions.isExporting !== true) {
            // Register SSR HMR
            const serverRoot = (0, _paths().getMetroServerRoot)(this.projectRoot);
            const relativePath = _path().default.relative(serverRoot, res.filename);
            const url = new URL(relativePath, this.getDevServerUrlOrAssert());
            this.setupHmr(url);
        }
        return (0, _getStaticRenderFunctions.evalMetroAndWrapFunctions)(this.projectRoot, res.src, res.filename, specificOptions.isExporting ?? this.instanceMetroOptions.isExporting);
    };
    async metroImportAsArtifactsAsync(filePath, specificOptions = {}) {
        const results = await this.ssrLoadModuleContents(filePath, {
            serializerOutput: "static",
            ...specificOptions
        });
        // NOTE: This could potentially need more validation in the future.
        if (results.artifacts && results.assets) {
            return {
                artifacts: results.artifacts,
                assets: results.assets,
                src: results.src,
                filename: results.filename,
                map: results.map
            };
        }
        throw new _errors.CommandError("Invalid bundler results: " + results);
    }
    async metroLoadModuleContents(filePath, specificOptions, extraOptions = {}) {
        const { baseUrl  } = this.instanceMetroOptions;
        (0, _assert().default)(baseUrl != null, "The server must be started before calling metroLoadModuleContents.");
        const opts = {
            // TODO: Possibly issues with using an absolute path here...
            // mainModuleName: filePath,
            lazy: false,
            asyncRoutes: false,
            inlineSourceMap: false,
            engine: "hermes",
            minify: false,
            // bytecode: false,
            // Bundle in Node.js mode for SSR.
            environment: "node",
            // platform: 'web',
            // mode: 'development',
            //
            ...this.instanceMetroOptions,
            baseUrl,
            // routerRoot,
            // isExporting,
            ...specificOptions
        };
        const expoBundleOptions = (0, _metroOptions.getMetroDirectBundleOptions)(opts);
        const resolverOptions = {
            customResolverOptions: expoBundleOptions.customResolverOptions ?? {},
            dev: expoBundleOptions.dev ?? true
        };
        const transformOptions = {
            dev: expoBundleOptions.dev ?? true,
            hot: true,
            minify: expoBundleOptions.minify ?? false,
            type: "module",
            unstable_transformProfile: extraOptions.unstable_transformProfile ?? expoBundleOptions.unstable_transformProfile ?? "default",
            customTransformOptions: expoBundleOptions.customTransformOptions ?? Object.create(null),
            platform: expoBundleOptions.platform ?? "web",
            // @ts-expect-error: `runtimeBytecodeVersion` does not exist in `expoBundleOptions` or `TransformInputOptions`
            runtimeBytecodeVersion: expoBundleOptions.runtimeBytecodeVersion
        };
        const resolvedEntryFilePath = await this.resolveRelativePathAsync(filePath, {
            resolverOptions,
            transformOptions
        });
        // Use fully qualified URL with all options to represent the file path that's used for source maps and HMR. This prevents collisions.
        const filename = (0, _metroOptions.createBundleUrlOsPath)({
            ...opts,
            mainModuleName: resolvedEntryFilePath
        });
        // https://github.com/facebook/metro/blob/2405f2f6c37a1b641cc379b9c733b1eff0c1c2a1/packages/metro/src/lib/parseOptionsFromUrl.js#L55-L87
        const results = await this._bundleDirectAsync(resolvedEntryFilePath, {
            graphOptions: {
                lazy: expoBundleOptions.lazy ?? false,
                shallow: expoBundleOptions.shallow ?? false
            },
            resolverOptions,
            serializerOptions: {
                ...expoBundleOptions.serializerOptions,
                inlineSourceMap: expoBundleOptions.inlineSourceMap ?? false,
                modulesOnly: expoBundleOptions.modulesOnly ?? false,
                runModule: expoBundleOptions.runModule ?? true,
                // @ts-expect-error
                sourceUrl: expoBundleOptions.sourceUrl,
                // @ts-expect-error
                sourceMapUrl: extraOptions.sourceMapUrl ?? expoBundleOptions.sourceMapUrl
            },
            transformOptions
        });
        return {
            ...results,
            filename
        };
    }
    async ssrLoadModuleContents(filePath, specificOptions = {}) {
        const { baseUrl , routerRoot , isExporting  } = this.instanceMetroOptions;
        (0, _assert().default)(baseUrl != null && routerRoot != null && isExporting != null, "The server must be started before calling ssrLoadModuleContents.");
        const opts = {
            // TODO: Possibly issues with using an absolute path here...
            mainModuleName: (0, _metroOptions.convertPathToModuleSpecifier)(filePath),
            lazy: false,
            asyncRoutes: false,
            inlineSourceMap: false,
            engine: "hermes",
            minify: false,
            bytecode: false,
            // Bundle in Node.js mode for SSR unless RSC is enabled.
            environment: this.isReactServerComponentsEnabled ? "react-server" : "node",
            platform: "web",
            mode: "development",
            //
            ...this.instanceMetroOptions,
            // Mostly disable compiler in SSR bundles.
            reactCompiler: false,
            baseUrl,
            routerRoot,
            isExporting,
            ...specificOptions
        };
        // https://github.com/facebook/metro/blob/2405f2f6c37a1b641cc379b9c733b1eff0c1c2a1/packages/metro/src/lib/parseOptionsFromUrl.js#L55-L87
        const { filename , bundle , map , ...rest } = await this.metroLoadModuleContents(filePath, opts);
        const scriptContents = wrapBundle(bundle);
        if (map) {
            debug("Registering SSR source map for:", filename);
            _getStaticRenderFunctions.cachedSourceMaps.set(filename, {
                url: this.projectRoot,
                map
            });
        } else {
            debug("No SSR source map found for:", filename);
        }
        return {
            ...rest,
            src: scriptContents,
            filename,
            map
        };
    }
    async nativeExportBundleAsync(options, files, extraOptions = {}) {
        if (this.isReactServerComponentsEnabled) {
            return this.singlePageReactServerComponentExportAsync(options, files, extraOptions);
        }
        return this.legacySinglePageExportBundleAsync(options, extraOptions);
    }
    async singlePageReactServerComponentExportAsync(options, files, extraOptions = {}) {
        const getReactServerReferences = (artifacts)=>{
            // Get the React server action boundaries from the client bundle.
            return unique(artifacts.filter((a)=>a.type === "js").map((artifact)=>{
                var ref;
                return (ref = artifact.metadata.reactServerReferences) == null ? void 0 : ref.map((ref)=>(0, _createServerComponentsMiddleware.fileURLToFilePath)(ref));
            })// TODO: Segment by module for splitting.
            .flat().filter(Boolean));
        };
        // NOTE(EvanBacon): This will not support any code elimination since it's a static pass.
        let { reactClientReferences: clientBoundaries , reactServerReferences: serverActionReferencesInServer , cssModules ,  } = await this.rscRenderer.getExpoRouterClientReferencesAsync({
            platform: options.platform,
            domRoot: options.domRoot
        }, files);
        // TODO: The output keys should be in production format or use a lookup manifest.
        const processClientBoundaries = async (reactServerReferences)=>{
            debug("Evaluated client boundaries:", clientBoundaries);
            // Run metro bundler and create the JS bundles/source maps.
            const bundle = await this.legacySinglePageExportBundleAsync({
                ...options,
                clientBoundaries
            }, extraOptions);
            // Get the React server action boundaries from the client bundle.
            const newReactServerReferences = getReactServerReferences(bundle.artifacts);
            if (!newReactServerReferences) {
                // Possible issue with babel plugin / metro-config.
                throw new Error("Static server action references were not returned from the Metro client bundle");
            }
            debug("React server action boundaries from client:", newReactServerReferences);
            const allKnownReactServerReferences = unique([
                ...reactServerReferences,
                ...newReactServerReferences, 
            ]);
            // When we export the server actions that were imported from the client, we may need to re-bundle the client with the new client boundaries.
            const { clientBoundaries: nestedClientBoundaries  } = await this.rscRenderer.exportServerActionsAsync({
                platform: options.platform,
                domRoot: options.domRoot,
                entryPoints: allKnownReactServerReferences
            }, files);
            // TODO: Check against all modules in the initial client bundles.
            const hasUniqueClientBoundaries = nestedClientBoundaries.some((boundary)=>!clientBoundaries.includes(boundary));
            if (!hasUniqueClientBoundaries) {
                return bundle;
            }
            debug("Re-bundling client with nested client boundaries:", nestedClientBoundaries);
            clientBoundaries = unique(clientBoundaries.concat(nestedClientBoundaries));
            // Re-bundle the client with the new client boundaries that only exist in server actions that were imported from the client.
            // Run metro bundler and create the JS bundles/source maps.
            return processClientBoundaries(allKnownReactServerReferences);
        };
        const bundle = await processClientBoundaries(serverActionReferencesInServer);
        // Inject the global CSS that was imported during the server render.
        bundle.artifacts.push(...cssModules);
        const serverRoot = (0, _paths().getMetroServerRoot)(this.projectRoot);
        // HACK: Maybe this should be done in the serializer.
        const clientBoundariesAsOpaqueIds = clientBoundaries.map((boundary)=>// NOTE(cedric): relative module specifiers / IDs should always be POSIX formatted
            (0, _filePath.toPosixPath)(_path().default.relative(serverRoot, boundary)));
        const moduleIdToSplitBundle = bundle.artifacts.map((artifact)=>{
            var ref;
            return (artifact == null ? void 0 : (ref = artifact.metadata) == null ? void 0 : ref.paths) && Object.values(artifact.metadata.paths);
        }).filter(Boolean).flat().reduce((acc, paths)=>({
                ...acc,
                ...paths
            }), {});
        debug("SSR Manifest:", moduleIdToSplitBundle, clientBoundariesAsOpaqueIds);
        const ssrManifest = new Map();
        if (Object.keys(moduleIdToSplitBundle).length) {
            clientBoundariesAsOpaqueIds.forEach((boundary)=>{
                if (boundary in moduleIdToSplitBundle) {
                    ssrManifest.set(boundary, moduleIdToSplitBundle[boundary]);
                } else {
                    throw new Error(`Could not find boundary "${boundary}" in the SSR manifest. Available: ${Object.keys(moduleIdToSplitBundle).join(", ")}`);
                }
            });
        } else {
            // Native apps with bundle splitting disabled.
            debug("No split bundles");
            clientBoundariesAsOpaqueIds.forEach((boundary)=>{
                // @ts-expect-error
                ssrManifest.set(boundary, null);
            });
        }
        // Export the static RSC files
        await this.rscRenderer.exportRoutesAsync({
            platform: options.platform,
            ssrManifest
        }, files);
        // Save the SSR manifest so we can perform more replacements in the server renderer and with server actions.
        files.set(`_expo/rsc/${options.platform}/ssr-manifest.js`, {
            targetDomain: "server",
            contents: "module.exports = " + JSON.stringify(// TODO: Add a less leaky version of this across the framework with just [key, value] (module ID, chunk).
            Object.fromEntries(Array.from(ssrManifest.entries()).map(([key, value])=>[
                    _path().default.join(serverRoot, key),
                    [
                        key,
                        value
                    ], 
                ])))
        });
        return {
            ...bundle,
            files
        };
    }
    async legacySinglePageExportBundleAsync(options, extraOptions = {}) {
        const { baseUrl , routerRoot , isExporting  } = this.instanceMetroOptions;
        (0, _assert().default)(options.mainModuleName != null, "mainModuleName must be provided in options.");
        (0, _assert().default)(baseUrl != null && routerRoot != null && isExporting != null, "The server must be started before calling legacySinglePageExportBundleAsync.");
        const opts = {
            ...this.instanceMetroOptions,
            baseUrl,
            routerRoot,
            isExporting,
            ...options,
            environment: "client",
            serializerOutput: "static"
        };
        // https://github.com/facebook/metro/blob/2405f2f6c37a1b641cc379b9c733b1eff0c1c2a1/packages/metro/src/lib/parseOptionsFromUrl.js#L55-L87
        if (!opts.mainModuleName.startsWith("/") && !_path().default.isAbsolute(opts.mainModuleName)) {
            opts.mainModuleName = "./" + opts.mainModuleName;
        }
        const output = await this.metroLoadModuleContents(opts.mainModuleName, opts, extraOptions);
        return {
            artifacts: output.artifacts,
            assets: output.assets
        };
    }
    async watchEnvironmentVariables() {
        if (!this.instance) {
            throw new Error("Cannot observe environment variable changes without a running Metro instance.");
        }
        if (!this.metro) {
            // This can happen when the run command is used and the server is already running in another
            // process.
            debug("Skipping Environment Variable observation because Metro is not running (headless).");
            return;
        }
        const envFiles = _env().getFiles(process.env.NODE_ENV).map((fileName)=>_path().default.join(this.projectRoot, fileName));
        (0, _waitForMetroToObserveTypeScriptFile.observeFileChanges)({
            metro: this.metro,
            server: this.instance.server
        }, envFiles, ()=>{
            debug("Reloading environment variables...");
            // Force reload the environment variables.
            _env().load(this.projectRoot, {
                force: true
            });
        });
    }
    rscRenderer = null;
    async startImplementationAsync(options) {
        var ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, ref10;
        options.port = await this.resolvePortAsync(options);
        this.urlCreator = this.getUrlCreator(options);
        const config = (0, _config().getConfig)(this.projectRoot, {
            skipSDKVersionRequirement: true
        });
        const { exp  } = config;
        // NOTE: This will change in the future when it's less experimental, we enable React 19, and turn on more RSC flags by default.
        const isReactServerComponentsEnabled = !!((ref = exp.experiments) == null ? void 0 : ref.reactServerComponentRoutes) || !!((ref1 = exp.experiments) == null ? void 0 : ref1.reactServerFunctions);
        const isReactServerActionsOnlyEnabled = !((ref2 = exp.experiments) == null ? void 0 : ref2.reactServerComponentRoutes) && !!((ref3 = exp.experiments) == null ? void 0 : ref3.reactServerFunctions);
        this.isReactServerComponentsEnabled = isReactServerComponentsEnabled;
        this.isReactServerRoutesEnabled = !!((ref4 = exp.experiments) == null ? void 0 : ref4.reactServerComponentRoutes);
        const useServerRendering = [
            "static",
            "server"
        ].includes(((ref5 = exp.web) == null ? void 0 : ref5.output) ?? "");
        const hasApiRoutes = isReactServerComponentsEnabled || ((ref6 = exp.web) == null ? void 0 : ref6.output) === "server";
        const baseUrl = (0, _metroOptions.getBaseUrlFromExpoConfig)(exp);
        const asyncRoutes = (0, _metroOptions.getAsyncRoutesFromExpoConfig)(exp, options.mode ?? "development", "web");
        const routerRoot = (0, _router.getRouterDirectoryModuleIdWithManifest)(this.projectRoot, exp);
        const reactCompiler = !!((ref7 = exp.experiments) == null ? void 0 : ref7.reactCompiler);
        const appDir = _path().default.join(this.projectRoot, routerRoot);
        const mode = options.mode ?? "development";
        if (isReactServerComponentsEnabled && ((ref8 = exp.web) == null ? void 0 : ref8.output) === "static") {
            throw new _errors.CommandError(`Experimental server component support does not support 'web.output: ${exp.web.output}' yet. Use 'web.output: "server"' during the experimental phase.`);
        }
        // Error early about the window.location polyfill when React Server Components are enabled.
        if (isReactServerComponentsEnabled && (exp == null ? void 0 : (ref9 = exp.extra) == null ? void 0 : (ref10 = ref9.router) == null ? void 0 : ref10.origin) === false) {
            const configPath = config.dynamicConfigPath ?? config.staticConfigPath ?? "/app.json";
            const configFileName = _path().default.basename(configPath);
            throw new _errors.CommandError(`The Expo Router "origin" property in the Expo config (${configFileName}) cannot be "false" when React Server Components is enabled. Remove it from the ${configFileName} file and try again.`);
        }
        const instanceMetroOptions = {
            isExporting: !!options.isExporting,
            baseUrl,
            mode,
            routerRoot,
            reactCompiler,
            minify: options.minify,
            asyncRoutes
        };
        this.instanceMetroOptions = instanceMetroOptions;
        const parsedOptions = {
            port: options.port,
            maxWorkers: options.maxWorkers,
            resetCache: options.resetDevServer
        };
        // Required for symbolication:
        process.env.EXPO_DEV_SERVER_ORIGIN = `http://localhost:${options.port}`;
        const { metro , hmrServer , server , middleware , messageSocket  } = await (0, _instantiateMetro.instantiateMetroAsync)(this, parsedOptions, {
            isExporting: !!options.isExporting,
            exp
        });
        if (!options.isExporting) {
            const manifestMiddleware = await this.getManifestMiddlewareAsync(options);
            // Important that we noop source maps for context modules as soon as possible.
            (0, _mutations.prependMiddleware)(middleware, new _contextModuleSourceMapsMiddleware.ContextModuleSourceMapsMiddleware().getHandler());
            // We need the manifest handler to be the first middleware to run so our
            // routes take precedence over static files. For example, the manifest is
            // served from '/' and if the user has an index.html file in their project
            // then the manifest handler will never run, the static middleware will run
            // and serve index.html instead of the manifest.
            // https://github.com/expo/expo/issues/13114
            (0, _mutations.prependMiddleware)(middleware, manifestMiddleware.getHandler());
            middleware.use(new _interstitialPageMiddleware.InterstitialPageMiddleware(this.projectRoot, {
                // TODO: Prevent this from becoming stale.
                scheme: options.location.scheme ?? null
            }).getHandler());
            middleware.use(new _reactDevToolsPageMiddleware.ReactDevToolsPageMiddleware(this.projectRoot).getHandler());
            middleware.use(new _devToolsPluginMiddleware.DevToolsPluginMiddleware(this.projectRoot, this.devToolsPluginManager).getHandler());
            const deepLinkMiddleware = new _runtimeRedirectMiddleware.RuntimeRedirectMiddleware(this.projectRoot, {
                getLocation: ({ runtime  })=>{
                    if (runtime === "custom") {
                        var ref;
                        return (ref = this.urlCreator) == null ? void 0 : ref.constructDevClientUrl();
                    } else {
                        var ref1;
                        return (ref1 = this.urlCreator) == null ? void 0 : ref1.constructUrl({
                            scheme: "exp"
                        });
                    }
                }
            });
            middleware.use(deepLinkMiddleware.getHandler());
            const serverRoot = (0, _paths().getMetroServerRoot)(this.projectRoot);
            const domComponentRenderer = (0, _domComponentsMiddleware.createDomComponentsMiddleware)({
                metroRoot: serverRoot,
                projectRoot: this.projectRoot
            }, instanceMetroOptions);
            // Add support for DOM components.
            // TODO: Maybe put behind a flag for now?
            middleware.use(domComponentRenderer);
            middleware.use(new _createFileMiddleware.CreateFileMiddleware(this.projectRoot).getHandler());
            // Append support for redirecting unhandled requests to the index.html page on web.
            if (this.isTargetingWeb()) {
                // This MUST be after the manifest middleware so it doesn't have a chance to serve the template `public/index.html`.
                middleware.use(new _serveStaticMiddleware.ServeStaticMiddleware(this.projectRoot).getHandler());
                // This should come after the static middleware so it doesn't serve the favicon from `public/favicon.ico`.
                middleware.use(new _faviconMiddleware.FaviconMiddleware(this.projectRoot).getHandler());
            }
            if (useServerRendering || isReactServerComponentsEnabled) {
                (0, _waitForMetroToObserveTypeScriptFile.observeAnyFileChanges)({
                    metro,
                    server
                }, (events)=>{
                    if (hasApiRoutes) {
                        // NOTE(EvanBacon): We aren't sure what files the API routes are using so we'll just invalidate
                        // aggressively to ensure we always have the latest. The only caching we really get here is for
                        // cases where the user is making subsequent requests to the same API route without changing anything.
                        // This is useful for testing but pretty suboptimal. Luckily our caching is pretty aggressive so it makes
                        // up for a lot of the overhead.
                        this.invalidateApiRouteCache();
                    } else if (!(0, _router.hasWarnedAboutApiRoutes)()) {
                        for (const event of events){
                            var // If the user did not delete a file that matches the Expo Router API Route convention, then we should warn that
                            // API Routes are not enabled in the project.
                            ref;
                            if (((ref = event.metadata) == null ? void 0 : ref.type) !== "d" && // Ensure the file is in the project's routes directory to prevent false positives in monorepos.
                            event.filePath.startsWith(appDir) && (0, _router.isApiRouteConvention)(event.filePath)) {
                                (0, _router.warnInvalidWebOutput)();
                            }
                        }
                    }
                });
            }
            // If React 19 is enabled, then add RSC middleware to the dev server.
            if (isReactServerComponentsEnabled) {
                this.bindRSCDevModuleInjectionHandler();
                const rscMiddleware = (0, _createServerComponentsMiddleware.createServerComponentsMiddleware)(this.projectRoot, {
                    instanceMetroOptions: this.instanceMetroOptions,
                    rscPath: "/_flight",
                    ssrLoadModule: this.ssrLoadModule.bind(this),
                    ssrLoadModuleArtifacts: this.metroImportAsArtifactsAsync.bind(this),
                    useClientRouter: isReactServerActionsOnlyEnabled,
                    createModuleId: metro._createModuleId.bind(metro)
                });
                this.rscRenderer = rscMiddleware;
                middleware.use(rscMiddleware.middleware);
                this.onReloadRscEvent = rscMiddleware.onReloadRscEvent;
            }
            // Append support for redirecting unhandled requests to the index.html page on web.
            if (this.isTargetingWeb()) {
                if (!useServerRendering) {
                    // This MUST run last since it's the fallback.
                    middleware.use(new _historyFallbackMiddleware.HistoryFallbackMiddleware(manifestMiddleware.getHandler().internal).getHandler());
                } else {
                    var ref11;
                    middleware.use((0, _createServerRouteMiddleware.createRouteHandlerMiddleware)(this.projectRoot, {
                        appDir,
                        routerRoot,
                        config,
                        ...(ref11 = config.exp.extra) == null ? void 0 : ref11.router,
                        bundleApiRoute: (functionFilePath)=>this.ssrImportApiRoute(functionFilePath, {
                                platform: "web"
                            }),
                        getStaticPageAsync: async (pathname)=>{
                            // TODO: Add server rendering when RSC is enabled.
                            if (isReactServerComponentsEnabled) {
                                // NOTE: This is a temporary hack to return the SPA/template index.html in development when RSC is enabled.
                                // While this technically works, it doesn't provide the correct experience of server rendering the React code to HTML first.
                                const html = await manifestMiddleware.getSingleHtmlTemplateAsync();
                                return {
                                    content: html
                                };
                            }
                            // Non-RSC apps will bundle the static HTML for a given pathname and respond with it.
                            return this.getStaticPageAsync(pathname);
                        }
                    }));
                }
            }
        } else {
            // If React 19 is enabled, then add RSC middleware to the dev server.
            if (isReactServerComponentsEnabled) {
                this.bindRSCDevModuleInjectionHandler();
                const rscMiddleware1 = (0, _createServerComponentsMiddleware.createServerComponentsMiddleware)(this.projectRoot, {
                    instanceMetroOptions: this.instanceMetroOptions,
                    rscPath: "/_flight",
                    ssrLoadModule: this.ssrLoadModule.bind(this),
                    ssrLoadModuleArtifacts: this.metroImportAsArtifactsAsync.bind(this),
                    useClientRouter: isReactServerActionsOnlyEnabled,
                    createModuleId: metro._createModuleId.bind(metro)
                });
                this.rscRenderer = rscMiddleware1;
            }
        }
        // Extend the close method to ensure that we clean up the local info.
        const originalClose = server.close.bind(server);
        server.close = (callback)=>{
            return originalClose((err)=>{
                this.instance = null;
                this.metro = null;
                this.hmrServer = null;
                this.ssrHmrClients = new Map();
                callback == null ? void 0 : callback(err);
            });
        };
        (0, _metroPrivateServer.assertMetroPrivateServer)(metro);
        this.metro = metro;
        this.hmrServer = hmrServer;
        return {
            server,
            location: {
                // The port is the main thing we want to send back.
                port: options.port,
                // localhost isn't always correct.
                host: "localhost",
                // http is the only supported protocol on native.
                url: `http://localhost:${options.port}`,
                protocol: "http"
            },
            middleware,
            messageSocket
        };
    }
    onReloadRscEvent = null;
    async registerSsrHmrAsync(url, onReload) {
        if (!this.hmrServer || this.ssrHmrClients.has(url)) {
            return;
        }
        debug("[SSR] Register HMR:", url);
        const sendFn = (message)=>{
            const data = JSON.parse(String(message));
            switch(data.type){
                case "bundle-registered":
                case "update-done":
                case "update-start":
                    break;
                case "update":
                    {
                        const update = data.body;
                        const { isInitialUpdate , added , modified , deleted ,  } = update;
                        const hasUpdate = added.length || modified.length || deleted.length;
                        // NOTE: We throw away the updates and instead simply send a trigger to the client to re-fetch the server route.
                        if (!isInitialUpdate && hasUpdate) {
                            // Clear all SSR modules before sending the reload event. This ensures that the next event will rebuild the in-memory state from scratch.
                            // @ts-expect-error
                            if (typeof globalThis.__c === "function") globalThis.__c();
                            const allModuleIds = new Set([
                                ...added,
                                ...modified
                            ].map((m)=>m.module[0]).concat(deleted));
                            const platforms = unique(Array.from(allModuleIds).map((moduleId)=>{
                                var ref;
                                if (typeof moduleId !== "string") {
                                    return null;
                                }
                                // Extract platforms from the module IDs.
                                return ((ref = moduleId.match(/[?&]platform=([\w]+)/)) == null ? void 0 : ref[1]) ?? null;
                            }).filter(Boolean));
                            onReload(platforms);
                        }
                    }
                    break;
                case "error":
                    var ref;
                    // GraphNotFound can mean that we have an issue in metroOptions where the URL doesn't match the object props.
                    _log.Log.error("[SSR] HMR Error: " + JSON.stringify(data, null, 2));
                    if (((ref = data.body) == null ? void 0 : ref.type) === "GraphNotFoundError") {
                        var ref1;
                        _log.Log.error("Available SSR HMR keys:", // @ts-expect-error
                        ((ref1 = this.metro) == null ? void 0 : ref1._bundler._revisionsByGraphId).keys());
                    }
                    break;
                default:
                    debug("Unknown HMR message:", data);
                    break;
            }
        };
        const client = await this.hmrServer.onClientConnect(url, sendFn);
        this.ssrHmrClients.set(url, client);
        // Opt in...
        client.optedIntoHMR = true;
        await this.hmrServer._registerEntryPoint(client, url, sendFn);
    }
    async waitForTypeScriptAsync() {
        if (!this.instance) {
            throw new Error("Cannot wait for TypeScript without a running server.");
        }
        return new Promise((resolve)=>{
            if (!this.metro) {
                // This can happen when the run command is used and the server is already running in another
                // process. In this case we can't wait for the TypeScript check to complete because we don't
                // have access to the Metro server.
                debug("Skipping TypeScript check because Metro is not running (headless).");
                return resolve(false);
            }
            const off = (0, _metroWatchTypeScriptFiles.metroWatchTypeScriptFiles)({
                projectRoot: this.projectRoot,
                server: this.instance.server,
                metro: this.metro,
                tsconfig: true,
                throttle: true,
                eventTypes: [
                    "change",
                    "add"
                ],
                callback: async ()=>{
                    // Run once, this prevents the TypeScript project prerequisite from running on every file change.
                    off();
                    const { TypeScriptProjectPrerequisite  } = await Promise.resolve().then(()=>/*#__PURE__*/ _interopRequireWildcard(require("../../doctor/typescript/TypeScriptProjectPrerequisite.js")));
                    try {
                        const req = new TypeScriptProjectPrerequisite(this.projectRoot);
                        await req.bootstrapAsync();
                        resolve(true);
                    } catch (error) {
                        // Ensure the process doesn't fail if the TypeScript check fails.
                        // This could happen during the install.
                        _log.Log.log();
                        _log.Log.error(_chalk().default.red`Failed to automatically setup TypeScript for your project. Try restarting the dev server to fix.`);
                        _log.Log.exception(error);
                        resolve(false);
                    }
                }
            });
        });
    }
    async startTypeScriptServices() {
        var ref;
        return (0, _startTypescriptTypeGeneration.startTypescriptTypeGenerationAsync)({
            server: (ref = this.instance) == null ? void 0 : ref.server,
            metro: this.metro,
            projectRoot: this.projectRoot
        });
    }
    getConfigModuleIds() {
        return [
            "./metro.config.js",
            "./metro.config.json",
            "./rn-cli.config.js"
        ];
    }
    // API Routes
    pendingRouteOperations = new Map();
    // Bundle the API Route with Metro and return the string contents to be evaluated in the server.
    async bundleApiRoute(filePath, { platform  }) {
        if (this.pendingRouteOperations.has(filePath)) {
            return this.pendingRouteOperations.get(filePath);
        }
        const bundleAsync = async ()=>{
            try {
                debug("Bundle API route:", this.instanceMetroOptions.routerRoot, filePath);
                return await this.ssrLoadModuleContents(filePath, {
                    isExporting: this.instanceMetroOptions.isExporting,
                    platform
                });
            } catch (error) {
                var ref;
                const appDir = ((ref = this.instanceMetroOptions) == null ? void 0 : ref.routerRoot) ? _path().default.join(this.projectRoot, this.instanceMetroOptions.routerRoot) : undefined;
                const relativePath = appDir ? _path().default.relative(appDir, filePath) : filePath;
                // Expected errors: invalid syntax, missing resolutions.
                // Wrap with command error for better error messages.
                const err = new _errors.CommandError("API_ROUTE", (0, _chalk().default)`Failed to bundle API Route: {bold ${relativePath}}\n\n` + error.message);
                for(const key in error){
                    // @ts-expect-error
                    err[key] = error[key];
                }
                throw err;
            } finally{
            // pendingRouteOperations.delete(filepath);
            }
        };
        const route = bundleAsync();
        this.pendingRouteOperations.set(filePath, route);
        return route;
    }
    async ssrImportApiRoute(filePath, { platform  }) {
        // TODO: Cache the evaluated function.
        try {
            const apiRoute = await this.bundleApiRoute(filePath, {
                platform
            });
            if (!(apiRoute == null ? void 0 : apiRoute.src)) {
                return null;
            }
            return (0, _getStaticRenderFunctions.evalMetroNoHandling)(this.projectRoot, apiRoute.src, apiRoute.filename);
        } catch (error) {
            // Format any errors that were thrown in the global scope of the evaluation.
            if (error instanceof Error) {
                try {
                    const htmlServerError = await (0, _metroErrorInterface.getErrorOverlayHtmlAsync)({
                        error,
                        projectRoot: this.projectRoot,
                        routerRoot: this.instanceMetroOptions.routerRoot
                    });
                    return new Response(htmlServerError, {
                        status: 500,
                        headers: {
                            "Content-Type": "text/html"
                        }
                    });
                } catch (internalError) {
                    debug("Failed to generate Metro server error UI for API Route error:", internalError);
                    throw error;
                }
            } else {
                throw error;
            }
        }
    }
    invalidateApiRouteCache() {
        this.pendingRouteOperations.clear();
    }
    // Ensure the global is available for SSR CSS modules to inject client updates.
    bindRSCDevModuleInjectionHandler() {
        // Used by SSR CSS modules to broadcast client updates.
        // @ts-expect-error
        globalThis.__expo_rsc_inject_module = this.sendClientModule.bind(this);
    }
    // NOTE: This can only target a single platform at a time (web).
    // used for sending RSC CSS to the root client in development.
    sendClientModule({ code , id  }) {
        this.broadcastMessage("sendDevCommand", {
            name: "module-import",
            data: {
                code,
                id
            }
        });
    }
    // Metro HMR
    setupHmr(url) {
        const onReload = (platforms = [])=>{
            // Send reload command to client from Fast Refresh code.
            if (!platforms.length) {
                // TODO: When is this called?
                this.broadcastMessage("sendDevCommand", {
                    name: "rsc-reload"
                });
            } else {
                for (const platform of platforms){
                    var _obj, ref;
                    (ref = (_obj = this).onReloadRscEvent) == null ? void 0 : ref.call(_obj, platform);
                    this.broadcastMessage("sendDevCommand", {
                        name: "rsc-reload",
                        platform
                    });
                }
            }
        };
        this.registerSsrHmrAsync(url.toString(), onReload);
    }
    // Direct Metro access
    // Emulates the Metro dev server .bundle endpoint without having to go through a server.
    async _bundleDirectAsync(resolvedEntryFilePath, { transformOptions , resolverOptions , graphOptions , serializerOptions  }) {
        var ref;
        (0, _assert().default)(this.metro, "Metro server must be running to bundle directly.");
        const config = this.metro._config;
        const buildNumber = this.metro.getNewBuildNumber();
        const bundlePerfLogger = config.unstable_perfLoggerFactory == null ? void 0 : config.unstable_perfLoggerFactory("BUNDLING_REQUEST", {
            key: buildNumber
        });
        const onProgress = (transformedFileCount, totalFileCount)=>{
            var ref, ref1;
            (ref = this.metro) == null ? void 0 : (ref1 = ref._reporter) == null ? void 0 : ref1.update == null ? void 0 : ref1.update({
                buildID: getBuildID(buildNumber),
                type: "bundle_transform_progressed",
                transformedFileCount,
                totalFileCount
            });
        };
        const revPromise = this.getMetroRevision(resolvedEntryFilePath, {
            graphOptions,
            transformOptions,
            resolverOptions
        });
        bundlePerfLogger == null ? void 0 : bundlePerfLogger.point("resolvingAndTransformingDependencies_start");
        bundlePerfLogger == null ? void 0 : bundlePerfLogger.annotate({
            bool: {
                initial_build: revPromise == null
            }
        });
        (ref = this.metro) == null ? void 0 : ref._reporter.update({
            buildID: getBuildID(buildNumber),
            bundleDetails: {
                bundleType: transformOptions.type,
                dev: transformOptions.dev,
                entryFile: resolvedEntryFilePath,
                minify: transformOptions.minify,
                platform: transformOptions.platform,
                customResolverOptions: resolverOptions.customResolverOptions,
                customTransformOptions: transformOptions.customTransformOptions ?? {}
            },
            isPrefetch: false,
            type: "bundle_build_started"
        });
        try {
            var ref1;
            let delta;
            let revision;
            // TODO: Some bug in Metro/RSC causes this to break when changing imports in server components.
            // We should resolve the bug because it results in ~6x faster bundling to reuse the graph revision.
            if (((ref1 = transformOptions.customTransformOptions) == null ? void 0 : ref1.environment) === "react-server") {
                const props = await this.metro.getBundler().initializeGraph(// NOTE: Using absolute path instead of relative input path is a breaking change.
                // entryFile,
                resolvedEntryFilePath, transformOptions, resolverOptions, {
                    onProgress,
                    shallow: graphOptions.shallow,
                    lazy: graphOptions.lazy
                });
                delta = props.delta;
                revision = props.revision;
            } else {
                const props1 = await (revPromise != null ? this.metro.getBundler().updateGraph(await revPromise, false) : this.metro.getBundler().initializeGraph(// NOTE: Using absolute path instead of relative input path is a breaking change.
                // entryFile,
                resolvedEntryFilePath, transformOptions, resolverOptions, {
                    onProgress,
                    shallow: graphOptions.shallow,
                    lazy: graphOptions.lazy
                }));
                delta = props1.delta;
                revision = props1.revision;
            }
            bundlePerfLogger == null ? void 0 : bundlePerfLogger.annotate({
                int: {
                    graph_node_count: revision.graph.dependencies.size
                }
            });
            bundlePerfLogger == null ? void 0 : bundlePerfLogger.point("resolvingAndTransformingDependencies_end");
            bundlePerfLogger == null ? void 0 : bundlePerfLogger.point("serializingBundle_start");
            const shouldAddToIgnoreList = this.metro._shouldAddModuleToIgnoreList.bind(this.metro);
            const serializer = this.getMetroSerializer();
            const bundle = await serializer(// NOTE: Using absolute path instead of relative input path is a breaking change.
            // entryFile,
            resolvedEntryFilePath, revision.prepend, revision.graph, {
                asyncRequireModulePath: await this.metro._resolveRelativePath(config.transformer.asyncRequireModulePath, {
                    relativeTo: "project",
                    resolverOptions,
                    transformOptions
                }),
                // ...serializerOptions,
                processModuleFilter: config.serializer.processModuleFilter,
                createModuleId: this.metro._createModuleId,
                getRunModuleStatement: config.serializer.getRunModuleStatement,
                includeAsyncPaths: graphOptions.lazy,
                dev: transformOptions.dev,
                projectRoot: config.projectRoot,
                modulesOnly: serializerOptions.modulesOnly,
                runBeforeMainModule: config.serializer.getModulesRunBeforeMainModule(resolvedEntryFilePath),
                runModule: serializerOptions.runModule,
                sourceMapUrl: serializerOptions.sourceMapUrl,
                sourceUrl: serializerOptions.sourceUrl,
                inlineSourceMap: serializerOptions.inlineSourceMap,
                serverRoot: config.server.unstable_serverRoot ?? config.projectRoot,
                shouldAddToIgnoreList,
                // @ts-expect-error: passed to our serializer to enable non-serial return values.
                serializerOptions
            });
            this.metro._reporter.update({
                buildID: getBuildID(buildNumber),
                type: "bundle_build_done"
            });
            bundlePerfLogger == null ? void 0 : bundlePerfLogger.point("serializingBundle_end");
            let bundleCode = null;
            let bundleMap = null;
            // @ts-expect-error: If the output is multi-bundle...
            if (serializerOptions.output === "static") {
                try {
                    var ref2, ref3;
                    const parsed = typeof bundle === "string" ? JSON.parse(bundle) : bundle;
                    (0, _assert().default)("artifacts" in parsed && Array.isArray(parsed.artifacts), "Expected serializer to return an object with key artifacts to contain an array of serial assets.");
                    const artifacts = parsed.artifacts;
                    const assets = parsed.assets;
                    const bundleCode1 = artifacts.filter((asset)=>asset.type === "js")[0];
                    const bundleMap1 = ((ref2 = artifacts.filter((asset)=>asset.type === "map")) == null ? void 0 : (ref3 = ref2[0]) == null ? void 0 : ref3.source) ?? "";
                    return {
                        numModifiedFiles: delta.reset ? delta.added.size + revision.prepend.length : delta.added.size + delta.modified.size + delta.deleted.size,
                        lastModifiedDate: revision.date,
                        nextRevId: revision.id,
                        bundle: bundleCode1.source,
                        map: bundleMap1,
                        artifacts,
                        assets
                    };
                } catch (error) {
                    throw new Error("Serializer did not return expected format. The project copy of `expo/metro-config` may be out of date. Error: " + error.message);
                }
            }
            if (typeof bundle === "string") {
                bundleCode = bundle;
                // Create the source map in a second pass...
                let { prepend , graph  } = revision;
                if (serializerOptions.modulesOnly) {
                    prepend = [];
                }
                bundleMap = await sourceMapStringAsync([
                    //
                    ...prepend,
                    ...this.metro._getSortedModules(graph), 
                ], {
                    excludeSource: serializerOptions.excludeSource,
                    processModuleFilter: config.serializer.processModuleFilter,
                    shouldAddToIgnoreList
                });
            } else {
                bundleCode = bundle.code;
                bundleMap = bundle.map;
            }
            return {
                numModifiedFiles: delta.reset ? delta.added.size + revision.prepend.length : delta.added.size + delta.modified.size + delta.deleted.size,
                lastModifiedDate: revision.date,
                nextRevId: revision.id,
                bundle: bundleCode,
                map: bundleMap
            };
        } catch (error1) {
            // Mark the error so we know how to format and return it later.
            // @ts-expect-error
            error1[_metroErrorInterface.IS_METRO_BUNDLE_ERROR_SYMBOL] = true;
            this.metro._reporter.update({
                buildID: getBuildID(buildNumber),
                type: "bundle_build_failed"
            });
            throw error1;
        }
    }
    getMetroSerializer() {
        var ref, ref1;
        return ((ref = this.metro) == null ? void 0 : (ref1 = ref._config) == null ? void 0 : ref1.serializer.customSerializer) || ((entryPoint, preModules, graph, options)=>(0, _bundleToString().default)((0, _baseJSBundle().default)(entryPoint, preModules, graph, options)).code);
    }
    getMetroRevision(resolvedEntryFilePath, { graphOptions , transformOptions , resolverOptions  }) {
        (0, _assert().default)(this.metro, "Metro server must be running to bundle directly.");
        const config = this.metro._config;
        const graphId = (0, _getGraphId().default)(resolvedEntryFilePath, transformOptions, {
            unstable_allowRequireContext: config.transformer.unstable_allowRequireContext,
            resolverOptions,
            shallow: graphOptions.shallow,
            lazy: graphOptions.lazy
        });
        return this.metro.getBundler().getRevisionByGraphId(graphId);
    }
    async resolveRelativePathAsync(moduleId, { resolverOptions , transformOptions  }) {
        (0, _assert().default)(this.metro, "cannot invoke resolveRelativePathAsync without metro instance");
        return await this.metro._resolveRelativePath((0, _metroOptions.convertPathToModuleSpecifier)(moduleId), {
            relativeTo: "server",
            resolverOptions,
            transformOptions
        });
    }
}
function getBuildID(buildNumber) {
    return buildNumber.toString(36);
}
function wrapBundle(str) {
    // Skip the metro runtime so debugging is a bit easier.
    // Replace the __r() call with an export statement.
    // Use gm to apply to the last require line. This is needed when the bundle has side-effects.
    return str.replace(/^(__r\(.*\);)$/gm, "module.exports = $1");
}
async function sourceMapStringAsync(modules, options) {
    return (await (0, _sourceMapGenerator().sourceMapGeneratorNonBlocking)(modules, options)).toString(undefined, {
        excludeSource: options.excludeSource
    });
}
function unique(array) {
    return Array.from(new Set(array));
}

//# sourceMappingURL=MetroBundlerDevServer.js.map