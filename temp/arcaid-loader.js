/// <reference path="arcaid-globals.d.ts" />
// ArcaidGlobal interface moved to arcaid-globals.d.ts
// declare global block moved to arcaid-globals.d.ts
(() => {
    "use strict";
    if (window.Arcaid && window.Arcaid.initCalled) {
        console.warn("ARCAID SDK: Loader already executed or init called.");
        // Potentially, if init was called but promise is pending, just return that.
        // Or, if fully init, allow re-init with new config or return existing instance.
        // For now, let's assume re-running the loader script itself is an issue.
        return;
    }
    let sdkInstancePromise = null;
    let sdkInitializationError = null;
    let initConfigOptions = null; // Store developer's initial config, now optional
    // const ARCAID_PLATFORM_ORIGIN = "https://gamedev.localhost:3000"; // Updated to use env var or default // TODO: Make this configurable for different environments without process.env
    // const ARCAID_PLATFORM_ORIGIN = "https://dev.arcaid.xyz";
    // const ARCAID_PLATFORM_ORIGIN_PATTERN = /^(http:\/\/localhost:3000|https:\/\/([a-zA-Z0-9-]+\.)*localhost:3000|https:\/\/([a-zA-Z0-9-]+\.)*arcaid\.xyz|https:\/\/arcaid-games\.s3\.us-east-2\.amazonaws\.com)$/;
    window.Arcaid = {
        initCalled: false,
        _coreSdkPromise: null, // Internal promise for core SDK loading and initialization
        init: function (devConfig) {
            this.initCalled = true;
            if (this._coreSdkPromise) {
                // console.warn("ARCAID SDK: init() called multiple times. Returning existing promise.");
                return this._coreSdkPromise;
            }
            if (sdkInitializationError) {
                return Promise.reject(sdkInitializationError);
            }
            initConfigOptions = devConfig || {}; // If no devConfig, use empty object
            this._coreSdkPromise = new Promise(async (resolve, reject) => {
                try {
                    let platformConfig = {};
                    const isInIframe = window.self !== window.top;
                    if (isInIframe) {
                        try {
                            // Request config from parent. 
                            // initConfigOptions.gameId might be undefined, which is fine.
                            // The platform will provide the authoritative gameId.
                            platformConfig = await requestConfigFromParent();
                        }
                        catch (e) {
                            console.warn("ARCAID SDK: Could not get config from parent. Proceeding with developer config.", e);
                        }
                    }
                    const mergedConfig = {
                        ...initConfigOptions, // Developer overrides (e.g., local coreSdkUrl)
                        ...platformConfig, // Platform config is base, including gameId, userSession etc.
                    };
                    if (platformConfig.userSession)
                        mergedConfig.userSession = platformConfig.userSession;
                    if (platformConfig.arcaidApiBaseUrl && !initConfigOptions?.arcaidApiBaseUrl) {
                        mergedConfig.arcaidApiBaseUrl = platformConfig.arcaidApiBaseUrl;
                    }
                    if (platformConfig.sdkVersion && !initConfigOptions?.sdkVersion) { // Platform version takes precedence if dev does not specify
                        mergedConfig.sdkVersion = platformConfig.sdkVersion;
                    }
                    // Core SDK URL determination: dev override > platform provided > dynamic default
                    const coreSdkUrl = initConfigOptions?.coreSdkUrl || platformConfig.coreSdkUrl || `https://cdn.arcaid.com/sdk/core/v${mergedConfig.sdkVersion || 'current'}/arcaid-core-sdk.js`;
                    mergedConfig.coreSdkUrl = coreSdkUrl;
                    console.log("ARCAID Loader: Final config for ArcaidCore.initialize:", JSON.parse(JSON.stringify(mergedConfig)));
                    await loadScript(coreSdkUrl, 3);
                    // Access ArcaidCore dynamically and cast its type
                    const coreSdkObject = window.ArcaidCore;
                    if (!coreSdkObject || typeof coreSdkObject.initialize !== 'function') {
                        throw new Error("ARCAID Core SDK failed to load or is invalid (initialize method not found).");
                    }
                    const sdkInstance = await coreSdkObject.initialize(mergedConfig);
                    resolve(sdkInstance);
                }
                catch (error) {
                    console.error("ARCAID SDK: Initialization failed.", error);
                    sdkInitializationError = error instanceof Error ? error : new Error(String(error)); // Store error for subsequent calls
                    reject(error);
                }
            });
            return this._coreSdkPromise;
        }
    };
    function requestConfigFromParent() {
        return new Promise((resolve, reject) => {
            const messageId = `arcaid-config-req-${Date.now()}-${Math.random()}`;
            const timeoutDuration = 5000;
            const timeoutHandle = setTimeout(() => {
                window.removeEventListener("message", messageListener);
                reject(new Error("Timeout waiting for platform config from parent."));
            }, timeoutDuration);
            function messageListener(event) {
                // No origin check, accept all messages
                const eventData = event.data;
                if (eventData && eventData.type === "ARCAID_PLATFORM_CONFIG_RESPONSE" && eventData.messageId === messageId) {
                    clearTimeout(timeoutHandle);
                    console.log("event origin CONFIG", event.origin);
                    window.removeEventListener("message", messageListener);
                    resolve(eventData.payload);
                }
            }
            window.addEventListener("message", messageListener);
            if (window.parent && window.parent !== window.self) {
                window.parent.postMessage({
                    source: "ARCAID_SDK_LOADER",
                    type: "REQUEST_ARCAID_PLATFORM_CONFIG",
                    messageId: messageId,
                    payload: {} // Send gameId for context
                }, '*'); // Use '*' as target origin
            }
            else {
                clearTimeout(timeoutHandle);
                window.removeEventListener("message", messageListener);
                resolve({});
            }
        });
    }
    function loadScript(src, retriesLeft) {
        return new Promise((resolve, reject) => {
            // Remove any existing script with the same src to handle retries correctly
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                existingScript.remove();
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                // console.log(`ARCAID SDK: Script ${src} loaded successfully.`);
                resolve();
            };
            script.onerror = (event, source, lineno, colno, error) => {
                console.error(`ARCAID SDK: Failed to load script ${src}. Retries left: ${retriesLeft - 1}`);
                if (retriesLeft > 0) {
                    // Wait a bit before retrying (e.g., exponential backoff or simple delay)
                    setTimeout(() => {
                        loadScript(src, retriesLeft - 1).then(resolve).catch(reject);
                    }, 1000); // 1 second delay
                }
                else {
                    reject(new Error(`Failed to load script ${src} after multiple retries. Error: ${error ? error.message : 'Unknown error'}`));
                }
            };
            (document.head || document.documentElement).appendChild(script);
        });
    }
    // Expose something globally if needed, like YaGamesLoader
    // ArcaidLoader = window.Arcaid;
})();
// Removed export {}; to make this a plain script
