/**
 * Configuration options for Arcaid.init() if the game client
 * needs to pass any (e.g., overriding coreSdkUrl for local dev).
 */
export interface ArcaidClientInitConfig {
  coreSdkUrl?: string;
  // Add any other client-side configurable options here in the future
}

/**
 * Represents the user's authentication state and basic info.
 * This aligns with what sdk.auth.getUserState() returns.
 */
export interface ArcaidUserState {
  isLoggedIn: boolean;
  userId: string | null;
  username: string | null;
}

/**
 * Defines the structure of the Arcaid Authentication module.
 */
export interface ArcaidAuthModule {
  getUserState: () => Promise<ArcaidUserState>;
  getPlayer: () => Promise<ArcaidPlayerResponse>;
  login?: () => Promise<any>; // Optionally update if you have login() response example
  // connectWallet: () => Promise<void>; // Example for future
  // logout: () => Promise<void>; // Example for future
}

/**
 * Defines the structure of the Arcaid Stats module.
 * (Current core implementation is a placeholder)
 */
export interface ArcaidStatsModule {
  trackEvent: (eventName: string, eventData?: Record<string, any>) => Promise<void>;
  // Define other stats methods
}

/**
 * Payload for a bet response from the PaymentsModule.
 */
export interface ArcaidBetResponsePayload {
  success: boolean;
  paymentId?: string;
  transactionHash?: string;
  message?: string;
  error?: string; // Error message if success is false
}

/**
 * Defines the structure of the Arcaid Payments module.
 */
export interface ArcaidPaymentsModule {
  /**
   * Initiates a bet in a game room via the platform.
   * @param roomId The ID of the room where the bet is being placed.
   * @param amount The amount of the bet.
   * @param reason An optional reason or description for the bet.
   * @returns A promise that resolves with the bet response from the platform.
   */
  makeBet: (roomId: string, amount: number, reason?: string) => Promise<ArcaidBetResponsePayload>;
}

/**
 * Payload for the user balance response from the WalletModule.
 */
export interface ArcaidUserBalanceResponsePayload {
  balance: string;
  ticker: string;
  tokenAddress: string;
  error?: string; // Optional error field
}

/**
 * Defines the structure of the Arcaid Wallet module.
 */
export interface ArcaidWalletModule {
  /**
   * Retrieves the user's game token balance.
   * @returns A promise that resolves with the user's balance information.
   */
  getUserBalance: () => Promise<ArcaidUserBalanceResponsePayload>;
}

/**
 * Defines the structure of the Arcaid Utils module.
 * (Current core implementation is a placeholder)
 */
export interface ArcaidUtilsModule {
  // Define utility methods as they are developed
  // e.g., performSomeUtility: () => any;
}

/**
 * Defines the structure for room details returned by the SDK.
 */
export interface ArcaidRoomDetails {
  roomId: string;
  name?: string;
  metadata?: any;
  sessionId?: string; // Player's session ID within the room
}

/**
 * Defines the structure for available room listings.
 */
export interface ArcaidAvailableRoom {
  roomId: string;
  name: string;
  clients: number;
  locked: boolean;
  private: boolean;
  maxClients: number | null;
  unlisted: boolean;
  createdAt: string;
  processId: string;
  metadata: {
    roomName: string;
    duration: number;
    maxPlayers: number;
    betAmount: number;
    gameId: string;
    roomDocId: string;
    [key: string]: any;
  };
}

// --- Multiplayer Event Payloads ---

/**
 * Payload for the onRoomUpdate event.
 */
export interface ArcaidRoomPlayer {
  sessionId: string;
  userId: string;
  name: string;
  isHost: boolean;
}

export interface ArcaidRoomBet {
  userId: string;
  amount: string;
  txHash: string;
}

export interface ArcaidRoomUpdatePayload {
  roomName: string;
  players: ArcaidRoomPlayer[];
  timeLeft: number;
  gameStarted: boolean;
  gameFinished: boolean;
  maxPlayers: number;
  betAmount: number;
  roomId: string;
  gameId: string;
  hostUserId: string;
  roomDocId: string;
  bets: ArcaidRoomBet[];
}

/**
 * Payload for the onGameStarted event.
 */
export interface ArcaidGameStartedPayload {
  roomId: string;
  initialState?: any; // Initial state of the game
}

/**
 * Payload for the onGameFinished event.
 */
export interface ArcaidGameFinishedPayload {
  roomId: string;
  results?: any; // Game results
}

/**
 * Payload for the onRoomError event.
 */
export interface ArcaidRoomErrorPayload {
  roomId?: string; // May not always be present if error is not room-specific
  code: number;
  message?: string;
}

/**
 * Defines the structure of the Arcaid Multiplayer module.
 */
export interface ArcaidMultiplayerModule {
  createRoom: (roomType: string, options: any) => Promise<ArcaidRoomDetails>;
  joinRoom: (roomId: string, options?: any) => Promise<ArcaidRoomDetails>;
  getAvailableRooms: (roomType?: string) => Promise<ArcaidAvailableRoom[]>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<void>; // For host/logic to start the game
  reconnect: (reconnectToken: string) => Promise<ArcaidRoomDetails>;

  /**
   * Sends a message to the current room. Fire-and-forget.
   * @param messageType A string identifying the type of message.
   * @param messageData The data payload of the message.
   */
  send: (messageType: string, messageData: any) => void;

  // Event listeners - each returns an unsubscribe function

  /**
   * Registers a callback for room state updates.
   * @param callback Function to call when a room update event is received.
   * @returns A function to unsubscribe the listener.
   */
  onRoomUpdate: (callback: (payload: ArcaidRoomUpdatePayload) => void) => () => void;

  /**
   * Registers a callback for messages sent within the room.
   * @param messageType The specific message type to listen for, or "*" to listen for all message types.
   * @param callback Function to call when a message is received.
   *   - If messageType is specific (e.g., "PLAYER_MOVE"), the callback receives `messageData`.
   *   - If messageType is "*", the callback receives an object `{ type: string, data: any }`.
   * @returns A function to unsubscribe the listener.
   */
  onMessage: (messageType: string | "*", callback: (data: any) => void) => () => void;

  /**
   * Registers a callback for when a game starts in the room.
   * @param callback Function to call when a game started event is received.
   * @returns A function to unsubscribe the listener.
   */
  onGameStarted: (callback: (payload: ArcaidGameStartedPayload) => void) => () => void;

  /**
   * Registers a callback for when a game finishes in the room.
   * @param callback Function to call when a game finished event is received.
   * @returns A function to unsubscribe the listener.
   */
  onGameFinished: (callback: (payload: ArcaidGameFinishedPayload) => void) => () => void;

  /**
   * Registers a callback for errors occurring in the multiplayer room or system.
   * @param callback Function to call when a room error event is received.
   * @returns A function to unsubscribe the listener.
   */
  onRoomError: (callback: (payload: ArcaidRoomErrorPayload) => void) => () => void;
}

/**
 * This is the main Arcaid SDK instance type your game will interact with.
 */
export interface ArcaidSDKInstance {
  /**
   * A promise that resolves when the SDK is fully ready, particularly
   * after receiving the complete user session from the platform.
   * ALWAYS await this before using features dependent on a full user session.
   */
  ready: () => Promise<void>;

  auth: ArcaidAuthModule;
  stats: ArcaidStatsModule;
  payments: ArcaidPaymentsModule;
  wallet: ArcaidWalletModule;
  utils: ArcaidUtilsModule;
  multiplayer: ArcaidMultiplayerModule;

  // getGameId: () => string | null; // Example if gameId needs to be exposed
}

/**
 * Declares the global Arcaid object that the arcaid-loader.js script exposes.
 */
declare global {
  interface Window {
    Arcaid?: {
      /**
       * Initializes the Arcaid SDK.
       * @param config Optional configuration for the SDK.
       * @returns A promise that resolves with the ArcaidSDKInstance.
       */
      init: (config?: ArcaidClientInitConfig) => Promise<ArcaidSDKInstance>;
    };
  }
}

// This export makes the file a module, which is good practice.
// TypeScript will pick up the `declare global` for window augmentation.
export {};

export interface ArcaidPlayerLinkedAccount {
  id?: string | null;
  address: string;
  type: string;
  imported?: boolean;
  delegated?: boolean;
  verifiedAt: string;
  firstVerifiedAt: string;
  latestVerifiedAt: string;
  chainType: string;
  walletClientType: string;
  connectorType: string;
  recoveryMethod?: string;
  walletIndex?: number;
}

export interface ArcaidPlayerUser {
  id: string;
  lastLogin: string;
  uid: string;
  address: string;
  linkedAccounts: ArcaidPlayerLinkedAccount[];
  updatedAt: string;
}

export interface ArcaidPlayerLobby {
  id: string;
  name: string;
  gameId: string;
  betAmount: string;
  roomId: string;
  bets: any[];
  status: string;
  createdAt: { _seconds: number; _nanoseconds: number };
  updatedAt: { _seconds: number; _nanoseconds: number };
  reconnectToken: string;
}

export interface ArcaidPlayerBalance {
  tokenBalance: string;
  tokenAddress: string;
  tokenSymbol: string;
}

export interface ArcaidPlayerResponse {
  auth: boolean;
  user?: ArcaidPlayerUser;
  currentLobby?: ArcaidPlayerLobby | null;
  balance?: ArcaidPlayerBalance;
} 