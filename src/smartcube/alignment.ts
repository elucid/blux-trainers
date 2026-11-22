import { ColorScheme, CubieCube, Move } from '../lib/CubeLib';

// Trainer array order isn't the usual URFDLB. GAN reports turns by physical
// center (white U, green F); notation in the trainer is by *position*.
const positions = 'UDFBLR';
const ganColors = 'WYGBOR';
const names = ['white', 'yellow', 'green', 'blue', 'orange', 'red'];

// Where the physical centers are during a case attempt. Roux holds the cube by
// its left/right blocks, so every case starts in the selected orientation (e.g.
// yellow top, red front, green right for YR), whatever M-slice offset the
// scramble leaves in the virtual cube. Only slices turned since the case started
// move the physical centers.
export function physicalCenters(history: readonly Move[]) {
    return new CubieCube().apply([...history]).tp;
}

export function alignment(orientation: string, centers: number[]) {
    const scheme = ColorScheme.valid_schemes_map.get(orientation) || ganColors;
    const rawFaces = centers.map(i => positions[ganColors.indexOf(scheme[i])]).join('');
    return {
        top: names[positions.indexOf(rawFaces[0])],
        front: names[positions.indexOf(rawFaces[2])],
        right: names[positions.indexOf(rawFaces[5])],
        toTrainer(move: string) {
            return positions[rawFaces.indexOf(move[0])] + move.slice(1);
        },
        toSensor(move: string) {
            return rawFaces[positions.indexOf(move[0])] + move.slice(1);
        }
    };
}
