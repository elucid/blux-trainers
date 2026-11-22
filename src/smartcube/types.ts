// Only decoded events cross this boundary. The trainer never sees a Bluetooth
// device, GATT characteristic, encryption key or SDK subscription.
export type CubeMove = {
    type: 'move';
    move: string; // an outer turn in the cube's fixed center/color frame
    serial: number;
    cubeTimestamp: number | null;
    localTimestamp: number | null;
};

export type CubeEvent = CubeMove
    | { type: 'state'; facelets: string }
    | { type: 'disconnect' };

export interface CubeConnection {
    name: string;
    disconnect(): Promise<void>;
}

export type ConnectCube = (onEvent: (event: CubeEvent) => void) => CubeConnection | Promise<CubeConnection>;
