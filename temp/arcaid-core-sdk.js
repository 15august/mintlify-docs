(() => {
    // Inside arcaid-core-sdk.js
    // Type definitions like UserSessionData and ArcaidConfigForCore are now expected to be globally available
    // from arcaid-globals.d.ts, or defined locally if not meant to be global.
    // Local UserState definition (if different from global) or rely on global UserState
    // interface UserState { ... } // Removed if identical to global UserState
    // Forward declaration for the instance type
    class ArcaidSDKInstanceImpl {
        constructor(initialConfig) {
            this.pendingRequests = new Map();
            this._internalConfig = initialConfig;
            if (!this._internalConfig.platformOrigin) {
                console.warn("Arcaid Core SDK: platformOrigin not set in config. Using '*' for postMessage targetOrigin, which is insecure for production. The parent platform should provide its origin during SDK initialization.");
                this._internalConfig.platformOrigin = '*';
            }
            this.auth = new AuthModule(this, this._internalConfig); // Modules get a reference to the instance
            this.stats = new StatsModule(this, this._internalConfig);
            this.payments = new PaymentsModule(this, this._internalConfig);
            this.wallet = new WalletModule(this);
            this.utils = new UtilsModule(this, this._internalConfig);
            this.multiplayer = new MultiplayerModule(this);
            this._readyPromise = new Promise((resolve, reject) => {
                this._resolveReadyPromise = resolve;
                this._rejectReadyPromise = reject;
            });
            // Initial check for readiness
            this._checkAndResolveReady();
        }
        _checkAndResolveReady() {
            // Define what makes the SDK "fully ready". 
            // For now, let's assume presence of userSession indicates readiness.
            // Adjust this condition based on actual minimal requirements for full functionality.
            if (this._internalConfig && this._internalConfig.userSession && this._internalConfig.userSession.sessionToken) {
                // console.log("Arcaid Core SDK is now fully ready with user session.");
                this._resolveReadyPromise();
            }
            else {
                // console.log("Arcaid Core SDK initialized, but awaiting full configuration (e.g., user session).");
            }
        }
        async ready() {
            return this._readyPromise;
        }
        // Method to be called by the parent frame if it has new/updated config
        _updatePlatformConfig(updatedConfigChunk) {
            console.log("Arcaid Core SDK: _updatePlatformConfig called with:", updatedConfigChunk);
            // Merge the new chunk into the existing config
            // A simple shallow merge, extend as needed for deep merge properties
            this._internalConfig = { ...this._internalConfig, ...updatedConfigChunk };
            // Update modules if they need to react to config changes directly
            // For example: this.auth.handleConfigUpdate(this._internalConfig);
            this.auth.updateConfig(this._internalConfig); // Assuming AuthModule has this method
            // ... update other modules as needed ...
            // No need to call updateConfig for WalletModule if it uses sdkInstance.currentConfig directly
            this._checkAndResolveReady(); // Re-check readiness based on the new complete config
        }
        async _initializeModules() {
            // Actual async setup for modules
            // await this.auth.initialize();
        }
        // Getter for modules to access the current config safely
        get currentConfig() {
            return this._internalConfig;
        }
        generateMessageId() {
            return `sdk-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }
        async requestParent(type, payload, timeoutMs = 30000) {
            const messageId = this.generateMessageId();
            const gameId = this.currentConfig.gameId;
            if (!gameId) {
                console.error("Arcaid SDK: gameId is not available in currentConfig for requestParent call.");
                // Proceeding as original WalletModule did, but this might be an issue for the platform.
            }
            const requestMessage = {
                source: "ARCAID_SDK",
                type,
                messageId,
                gameId: gameId || "",
                payload,
            };
            const deferred = createDeferred();
            this.pendingRequests.set(messageId, deferred);
            const targetOrigin = this.currentConfig.platformOrigin || '*';
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(requestMessage, targetOrigin);
            }
            else {
                console.warn("Arcaid SDK: No parent window found to send message to for requestParent.");
                deferred.reject(new Error("No parent window."));
                this.pendingRequests.delete(messageId);
                return deferred.promise;
            }
            setTimeout(() => {
                if (this.pendingRequests.has(messageId)) {
                    this.pendingRequests.get(messageId)?.reject(new Error(`Request timed out for ${type}: ${messageId}`));
                    this.pendingRequests.delete(messageId);
                }
            }, timeoutMs);
            return deferred.promise;
        }
        _resolvePendingRequest(data) {
            if (!data.messageId || !this.pendingRequests.has(data.messageId)) {
                return false;
            }
            const deferred = this.pendingRequests.get(data.messageId);
            const payload = data.payload;
            if (payload && typeof payload === 'object' && payload.hasOwnProperty('error') && payload.error !== undefined && payload.error !== null) {
                deferred.reject(payload.error instanceof Error ? payload.error : new Error(String(payload.error)));
            }
            else if (data.type.includes("ERROR") || data.type.endsWith("_FAILED") || data.type.endsWith("_ERROR_RESPONSE")) {
                const errorMessage = (payload && typeof payload === 'object' && payload.message) ? String(payload.message) :
                    (typeof payload === 'string' && payload) ? payload :
                        `Platform operation failed with type ${data.type}`;
                deferred.reject(new Error(errorMessage));
            }
            else {
                deferred.resolve(payload);
            }
            this.pendingRequests.delete(data.messageId);
            return true;
        }
        _handleMessageFromPlatform(data) {
            if (this._resolvePendingRequest(data)) {
                return;
            }
            if (data.type === "ARCAID_UPDATE_USER_SESSION") {
                console.log('[ArcaidCoreSDK] Received ARCAID_UPDATE_USER_SESSION from parent:', data.payload);
                this._updatePlatformConfig(data.payload);
            }
            else if (data.type && data.type.startsWith("MULTIPLAYER_")) {
                // Route to MultiplayerModule to handle its specific messages (likely events not caught by _resolvePendingRequest)
                this.multiplayer.handlePlatformMessage(data);
            }
            // Note: GET_USER_BALANCE_RESPONSE should be handled by _resolvePendingRequest if it has a messageId.
            // Other specific response types are also expected to be handled by _resolvePendingRequest.
            else {
                // console.log("[ArcaidCoreSDK] Received unhandled message from platform (not a direct response or known event):", data);
            }
        }
        _handleMultiplayerMessage(data) {
            // This method might be redundant if _handleMessageFromPlatform routes correctly to multiplayer.
            // For now, keeping it as it was, but multiplayer.handlePlatformMessage is the key.
            if (this.multiplayer) {
                this.multiplayer.handlePlatformMessage(data);
            }
        }
    }
    // UserState and ArcaidCoreSDKLocal are now in arcaid-globals.d.ts
    // declare global block is now in arcaid-globals.d.ts
    // Placeholder for module classes - replace with actual implementations
    class AuthModule {
        constructor(sdkInstance, initialConfig) {
            this.sdkInstance = sdkInstance;
            this.config = initialConfig;
        }
        // Method for the SDK instance to push updated config to the module
        updateConfig(newConfig) {
            this.config = newConfig;
            // console.log("AuthModule config updated.");
        }
        async getUserState() {
            // Wait for the SDK to be fully ready (including user session) before providing user state
            await this.sdkInstance.ready();
            console.log("Arcaid SDK: AuthModule.getUserState() called (SDK is ready)");
            const session = this.sdkInstance.currentConfig.userSession; // Use the getter
            console.log("Arcaid SDK: User session in AuthModule:", session);
            if (!session || !session.isLoggedIn || !session.sessionToken) {
                return {
                    isLoggedIn: false,
                    userId: null,
                    username: null,
                };
            }
            return {
                isLoggedIn: session.isLoggedIn,
                userId: session.userWalletAddress,
                username: session.userWalletAddress ? `user-${session.userWalletAddress.substring(0, 6)}` : null,
            };
        }
        async getPlayer() {
            const responsePayload = await this.sdkInstance.requestParent("GET_PLAYER_REQUEST", {});
            return responsePayload;
        }
        async login() {
            const responsePayload = await this.sdkInstance.requestParent("LOGIN_REQUEST", {});
            return responsePayload;
        }
    }
    class StatsModule {
        constructor(sdkInstance, initialConfig) { }
    }
    class PaymentsModule {
        constructor(sdkInstance, initialConfig) {
            this.sdkInstance = sdkInstance;
            // initialConfig is passed but may not be stored if all config access is via sdkInstance.currentConfig
        }
        /**
         * Initiates a bet in a game room via the platform.
         * @param roomDocId The ID of the room where the bet is being placed.
         * @param amount The amount of the bet (e.g., in the smallest unit of the token like wei).
         * @param reason An optional reason or description for the bet.
         * @returns A promise that resolves with the bet response from the platform.
         */
        async makeBet(roomDocId, amount, reason) {
            if (!this.sdkInstance.currentConfig.gameId) {
                const errorMsg = "Arcaid SDK (PaymentsModule): Cannot make bet. SDK not fully initialized or gameId missing.";
                console.error(errorMsg);
                // Ensure the rejection aligns with BetResponsePayload structure for consistency if caught by game developer
                return Promise.reject({ success: false, error: errorMsg });
            }
            if (!roomDocId || typeof amount !== 'number' || amount <= 0) {
                const errorMsg = "Arcaid SDK (PaymentsModule): Invalid parameters for makeBet. roomId and positive amount required.";
                console.error(errorMsg);
                return Promise.reject({
                    success: false,
                    error: errorMsg
                });
            }
            const payload = {
                roomDocId,
                amount,
                reason,
            };
            try {
                // Use the centralized requestParent method from the SDK instance.
                // The type "BET_REQUEST" must match what the parent platform expects.
                // The response payload will be BetResponsePayload, or an error will be thrown by requestParent.
                const response = await this.sdkInstance.requestParent("BET_REQUEST", payload);
                return response; // requestParent now handles parsing the success/error from the payload
            }
            catch (error) {
                // This catch block will now primarily handle timeouts or fundamental communication errors
                // from sdkInstance.requestParent, as payload-level errors are processed by _resolvePendingRequest.
                console.error("[ArcaidSDK PaymentsModule] makeBet request failed via sdkInstance.requestParent:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Ensure consistent error response structure for the game developer
                return Promise.reject({ success: false, error: errorMessage });
            }
        }
    }
    class WalletModule {
        // private pendingRequests: Map<string, Deferred<any>> = new Map(); // Moved to ArcaidSDKInstanceImpl
        constructor(sdkInstance) {
            this.sdkInstance = sdkInstance;
        }
        // generateMessageId, requestParent, and handlePlatformMessage are removed as they are centralized.
        // The main event listener in ArcaidSDKInstanceImpl will handle responses.
        async getUserBalance() {
            const payload = {};
            try {
                // Use the centralized requestParent method from the SDK instance
                const response = await this.sdkInstance.requestParent("GET_USER_BALANCE_REQUEST", payload);
                return response; // The promise resolves with UserBalanceResponsePayload directly or rejects with an error.
            }
            catch (error) {
                // console.error("[ArcaidSDK WalletModule] getUserBalance failed:", error);
                if (error instanceof Error) {
                    throw error;
                }
                else {
                    throw new Error(String(error));
                }
            }
        }
    }
    class UtilsModule {
        constructor(sdkInstance, initialConfig) { }
    }
    // Ensure ArcaidCore is defined on window before assigning to it
    if (!window.ArcaidCore) {
        window.ArcaidCore = {};
    }
    let sdkInstance = null;
    window.ArcaidCore.initialize = async (finalConfig) => {
        console.log("Arcaid Core SDK: Initializing with config:", finalConfig);
        sdkInstance = new ArcaidSDKInstanceImpl(finalConfig);
        await sdkInstance._initializeModules();
        // Expose the update function for the parent to call
        // Important: .bind(instance) ensures 'this' context is correct when called from parent
        window.ArcaidCore._updateSdkConfig = sdkInstance._updatePlatformConfig.bind(sdkInstance);
        console.log("Arcaid Core SDK: Instance created. Ready promise pending full config (e.g. user session).");
        return sdkInstance;
    };
    // The actual class ArcaidSDKInstance used by the loader is expected to be defined/typed
    // in a way that's compatible with ArcaidSDKInstanceImpl, ideally sharing a common interface.
    // For the purpose of this file, ArcaidSDKInstanceImpl is the concrete implementation.
    // Listen for configuration updates from the parent platform after initial load
    window.addEventListener('message', (event) => {
        const expectedOrigin = sdkInstance?.currentConfig?.platformOrigin;
        if (expectedOrigin && expectedOrigin !== '*' && event.origin !== expectedOrigin) {
            // console.warn(`[ArcaidCoreSDK] Message from origin ${event.origin} ignored. Expected ${expectedOrigin}.`);
            return;
        }
        const data = event.data;
        if (data && data.source === "ARCAID_PLATFORM" && sdkInstance) {
            sdkInstance._handleMessageFromPlatform(data);
        }
        // Old logic for routing, now handled by sdkInstance._handleMessageFromPlatform
        // if (data && data.source === "ARCAID_PLATFORM") {
        //     if (data.type === "ARCAID_UPDATE_USER_SESSION") {
        //         console.log('[ArcaidCoreSDK] Received ARCAID_UPDATE_USER_SESSION from parent:', data.payload);
        //         sdkInstance?._updatePlatformConfig(data.payload as Partial<ArcaidConfigForCore>);
        //     } else if (data.type && data.type.startsWith("MULTIPLAYER_")) {
        //         // MultiplayerModule handles its own messages (responses and events)
        //         sdkInstance?.multiplayer.handlePlatformMessage(data as PlatformResponseBase<string, any>);
        //     } else if (data.type === "GET_USER_BALANCE_RESPONSE") {
        //         // WalletModule handles its own messages (responses)
        //         sdkInstance?.wallet.handlePlatformMessage(data as PlatformResponseBase<string, any>);
        //     } else {
        //         // console.log("[ArcaidCoreSDK] Received unhandled message from platform:", data);
        //     }
        // }
    });
    class MultiplayerModule {
        constructor(sdkInstance) {
            // private pendingRequests: Map<string, Deferred<any>> = new Map(); // Moved to ArcaidSDKInstanceImpl
            // Specific event listeners
            this.onRoomUpdateListeners = new Set();
            this.onRoomMessageListeners = new Map(); // type -> listeners
            this.onGameStartedListeners = new Set();
            this.onGameFinishedListeners = new Set();
            this.onRoomErrorListeners = new Set();
            this.sdkInstance = sdkInstance;
        }
        // generateMessageId and requestParent are removed as they are centralized in ArcaidSDKInstanceImpl
        handlePlatformMessage(data) {
            // This method is now primarily for handling events or messages not caught by ArcaidSDKInstanceImpl._resolvePendingRequest.
            // If _resolvePendingRequest handled it (because it had a matching messageId in sdkInstance.pendingRequests),
            // this method won't be called for that specific message, or its effect would be pre-empted.
            // The routing in ArcaidSDKInstanceImpl._handleMessageFromPlatform directs MULTIPLAYER_ prefixed messages here.
            // If data.messageId exists AND was handled by sdkInstance._resolvePendingRequest, this logic here is redundant for that message.
            // We assume this is now mostly for events.
            if (data.messageId && this.sdkInstance['pendingRequests'].has(data.messageId)) {
                // This case should ideally not be hit if _resolvePendingRequest in SDK instance works correctly
                // and the main listener calls it first. This log helps identify if routing is imperfect.
                console.warn("[ArcaidSDK MultiplayerModule] handlePlatformMessage received a message that should have been handled by SDK instance's pending requests:", data);
                // Avoid double processing if the SDK instance already handled it.
                return;
            }
            // This is an event or a message not tied to a pending request known by the SDK instance.
            switch (data.type) {
                case "MULTIPLAYER_ROOM_UPDATE_EVENT":
                    console.log('[ArcaidSDK MultiplayerModule] Received MULTIPLAYER_ROOM_UPDATE_EVENT:', data.payload);
                    this.onRoomUpdateListeners.forEach(cb => cb(data.payload));
                    break;
                case "MULTIPLAYER_GAME_STARTED_EVENT":
                    console.log('[ArcaidSDK MultiplayerModule] Received MULTIPLAYER_GAME_STARTED_EVENT:', data.payload);
                    this.onGameStartedListeners.forEach(cb => cb(data.payload));
                    break;
                case "MULTIPLAYER_GAME_FINISHED_EVENT":
                    console.log('[ArcaidSDK MultiplayerModule] Received MULTIPLAYER_GAME_FINISHED_EVENT:', data.payload);
                    this.onGameFinishedListeners.forEach(cb => cb(data.payload));
                    break;
                case "MULTIPLAYER_ROOM_ERROR_EVENT":
                    console.log('[ArcaidSDK MultiplayerModule] Received MULTIPLAYER_ROOM_ERROR_EVENT:', data.payload);
                    this.onRoomErrorListeners.forEach(cb => cb(data.payload));
                    break;
                // Handle MULTIPLAYER_ROOM_MESSAGE_EVENT for onMessage listeners
                case "MULTIPLAYER_ROOM_MESSAGE_EVENT": // Assuming this is the type for incoming room messages
                    // console.log('[ArcaidSDK MultiplayerModule] Received MULTIPLAYER_ROOM_MESSAGE_EVENT:', data.payload);
                    if (data.payload && data.payload.messageType !== undefined) {
                        const messageType = data.payload.messageType;
                        const messageData = data.payload.messageData;
                        if (this.onRoomMessageListeners.has(messageType)) {
                            this.onRoomMessageListeners.get(messageType).forEach(cb => cb(messageData));
                        }
                        // Generic listener for all message types (e.g., if type was registered as '*')
                        if (this.onRoomMessageListeners.has('*')) {
                            this.onRoomMessageListeners.get('*').forEach(cb => cb({ type: messageType, data: messageData }));
                        }
                    }
                    break;
                default:
                    // This could be a response type that somehow bypassed the main handler, or an unknown event.
                    console.log("[ArcaidSDK MultiplayerModule] Received unhandled message/event or non-event message from platform:", data);
            }
        }
        async createRoom(roomType, options) {
            const responsePayload = await this.sdkInstance.requestParent("MULTIPLAYER_CREATE_ROOM_REQUEST", { roomType, options });
            // Assuming sdkInstance.requestParent rejects on error (e.g. payload.error is present).
            // If it resolves, responsePayload is the payload from the platform.
            if (!responsePayload || !responsePayload.room) {
                throw new Error("Create room response did not include room details in payload.");
            }
            return responsePayload.room;
        }
        async joinRoom(roomId, options) {
            const responsePayload = await this.sdkInstance.requestParent("MULTIPLAYER_JOIN_ROOM_REQUEST", { roomId, options });
            if (!responsePayload || !responsePayload.room) {
                throw new Error("Join room response did not include room details in payload.");
            }
            // TODO: Handle initialState if provided in responsePayload.initialState or responsePayload.room.initialState
            return responsePayload.room;
        }
        async reconnect(reconnectToken) {
            const responsePayload = await this.sdkInstance.requestParent("MULTIPLAYER_RECONNECT_ROOM_REQUEST", { reconnectToken });
            if (!responsePayload || !responsePayload.room) {
                throw new Error("Reconnect response did not include room details in payload.");
            }
            // Optionally handle initialState if needed
            return responsePayload.room;
        }
        async leaveRoom() {
            // Assuming the response payload for success is empty or not critically needed.
            // If there's an error, requestParent should reject.
            await this.sdkInstance.requestParent("MULTIPLAYER_LEAVE_ROOM_REQUEST", {});
            // No explicit error check here; relies on rejection for errors.
        }
        send(messageType, messageData) {
            // Fire and forget, but catch potential immediate errors from requestParent (e.g., no parent window)
            this.sdkInstance.requestParent("MULTIPLAYER_SEND_ROOM_MESSAGE_REQUEST", { messageType, messageData })
                .catch(err => console.warn("[ArcaidSDK Multiplayer] Send message failed:", err));
        }
        async getAvailableRooms(roomType) {
            const responsePayload = await this.sdkInstance.requestParent("MULTIPLAYER_GET_AVAILABLE_ROOMS_REQUEST", { roomType });
            // Relies on requestParent to reject on error.
            return responsePayload.rooms || [];
        }
        async startGame() {
            await this.sdkInstance.requestParent("MULTIPLAYER_START_GAME_REQUEST", {});
            // Relies on rejection for errors.
        }
        /**
         * Adds user input to the current game room.
         * @param playerInput The input data to be added
         * @param roomDocId The ID of the room document
         * @returns A promise that resolves with the response from the platform
         */
        async addUserInput(playerInput, roomDocId) {
            const responsePayload = await this.sdkInstance.requestParent("ADD_USER_INPUT_REQUEST", { playerInput, roomDocId });
            if (!responsePayload.success) {
                throw new Error(responsePayload.error || "Failed to add user input");
            }
            return responsePayload;
        }
        onRoomUpdate(callback) {
            this.onRoomUpdateListeners.add(callback);
            return () => this.onRoomUpdateListeners.delete(callback);
        }
        onMessage(type, callback) {
            if (!this.onRoomMessageListeners.has(type)) {
                this.onRoomMessageListeners.set(type, new Set());
            }
            this.onRoomMessageListeners.get(type).add(callback);
            return () => {
                this.onRoomMessageListeners.get(type)?.delete(callback);
                if (this.onRoomMessageListeners.get(type)?.size === 0) {
                    this.onRoomMessageListeners.delete(type);
                }
            };
        }
        onGameStarted(callback) {
            this.onGameStartedListeners.add(callback);
            return () => this.onGameStartedListeners.delete(callback);
        }
        onGameFinished(callback) {
            this.onGameFinishedListeners.add(callback);
            return () => this.onGameFinishedListeners.delete(callback);
        }
        onRoomError(callback) {
            this.onRoomErrorListeners.add(callback);
            return () => this.onRoomErrorListeners.delete(callback);
        }
    }
    function createDeferred() {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    }
})();
// Define ArcaidConfigForCore, UserState, UserSessionData if not globally available via a .d.ts file.
// These should align with types in the parent application (PlayGamePage.tsx)
// interface UserState { isLoggedIn: boolean; userId: string | null; username: string | null; }
// interface UserSessionData { isLoggedIn: boolean; userWalletAddress: string | null; sessionToken: string | null; }
// interface ArcaidConfigForCore { 
//   coreSdkUrl: string; 
//   arcaidApiBaseUrl: string; 
//   userSession: UserSessionData; 
//   gameId: string; 
//   platformOrigin: string; // Added: Origin of the parent platform for postMessage security
// }
