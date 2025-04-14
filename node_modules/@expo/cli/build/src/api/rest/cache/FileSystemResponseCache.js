"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FileSystemResponseCache", {
    enumerable: true,
    get: ()=>FileSystemResponseCache
});
function _cacache() {
    const data = /*#__PURE__*/ _interopRequireDefault(require("cacache"));
    _cacache = function() {
        return data;
    };
    return data;
}
function _stream() {
    const data = require("stream");
    _stream = function() {
        return data;
    };
    return data;
}
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
class FileSystemResponseCache {
    constructor(options){
        this.cacheDirectory = options.cacheDirectory;
        this.timeToLive = options.ttl;
    }
    /** Retrieve the cache response, if any */ async get(cacheKey) {
        const responseInfoKey = getResponseInfoKey(cacheKey);
        const responseInfoMeta = await _cacache().default.get.info(this.cacheDirectory, responseInfoKey);
        // Abort if the response info is not found
        if (!responseInfoMeta) {
            return undefined;
        }
        const responseInfoBuffer = await _cacache().default.get.byDigest(this.cacheDirectory, responseInfoMeta.integrity);
        const responseInfo = JSON.parse(responseInfoBuffer.toString());
        // Remove cache-specific data from the response info
        const { empty , expiration , bodyIntegrity  } = responseInfo;
        delete responseInfo.empty;
        delete responseInfo.expiration;
        delete responseInfo.bodyIntegrity;
        // Invalidate the response if it has expired, or there is no known body integrity
        if (!bodyIntegrity || expiration && expiration < Date.now()) {
            return undefined;
        }
        // Create a read-stream for the response body
        const responseBody = empty ? _stream().Readable.from(Buffer.alloc(0)) : _stream().Readable.from(_cacache().default.get.stream.byDigest(this.cacheDirectory, bodyIntegrity));
        return {
            body: _stream().Readable.toWeb(responseBody),
            info: responseInfo
        };
    }
    /** Store the response for caching */ async set(cacheKey, response) {
        const responseBodyKey = getResponseBodyKey(cacheKey);
        const responseInfoKey = getResponseInfoKey(cacheKey);
        // Create a copy of the response info, to add cache-specific data
        const responseInfo = {
            ...response.info
        };
        // Add expiration time if the "time to live" is set
        if (typeof this.timeToLive === "number") {
            responseInfo.expiration = Date.now() + this.timeToLive;
        }
        try {
            // Store the response body as stream, and calculate the stream integrity
            responseInfo.bodyIntegrity = await new Promise((fulfill, reject)=>{
                _stream().Readable.fromWeb(response.body).pipe(_cacache().default.put.stream(this.cacheDirectory, responseBodyKey)).on("integrity", (integrity)=>fulfill(integrity)).once("error", reject);
            });
        } catch (error) {
            if (error.code !== "ENODATA") {
                throw error;
            }
            // Mark the response as empty
            responseInfo.empty = true;
            responseInfo.bodyIntegrity = undefined;
        }
        // Store the response info
        const responseInfoBuffer = Buffer.from(JSON.stringify(responseInfo));
        await _cacache().default.put(this.cacheDirectory, responseInfoKey, responseInfoBuffer);
        return await this.get(cacheKey);
    }
    /** Remove the response from caching */ async remove(cacheKey) {
        await Promise.all([
            _cacache().default.rm.entry(this.cacheDirectory, getResponseBodyKey(cacheKey)),
            _cacache().default.rm.entry(this.cacheDirectory, getResponseBodyKey(cacheKey)), 
        ]);
    }
}
function getResponseBodyKey(cacheKey) {
    return `${cacheKey}UndiciBody`;
}
function getResponseInfoKey(cacheKey) {
    return `${cacheKey}UndiciInfo`;
}

//# sourceMappingURL=FileSystemResponseCache.js.map