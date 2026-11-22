import { CubeConnection, CubeEvent } from './types';

export interface SimulatedCube extends CubeConnection {
    turn(...rawTurns: string[]): void;
}

// A source of sensor events, not a second CMLL cube model. In particular,
// even this solved initial state must never replace the trainer's scramble.
export function connectSimulator(emit: (event: CubeEvent) => void): SimulatedCube {
    const start = performance.now();
    let connected = true;
    let serial = 0;
    emit({ type: 'state', facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB' });
    return {
        name: 'Simulated cube',
        turn(...rawTurns) {
            for (const move of rawTurns) {
                if (!connected) return;
                if (!/^[URFDLB]'?$/.test(move)) throw new Error('Expected a sensor quarter turn');
                serial = (serial + 1) & 0xff;
                emit({ type: 'move', move, serial,
                    cubeTimestamp: Math.round(performance.now() - start), localTimestamp: Date.now() });
            }
        },
        async disconnect() {
            if (connected) {
                connected = false;
                emit({ type: 'disconnect' });
            }
        }
    };
}
