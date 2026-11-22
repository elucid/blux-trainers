import { ColorScheme } from '../lib/CubeLib';

// Trainer array order isn't the usual URFDLB. GAN reports turns by physical
// center (white U, green F); notation in the trainer is by *position*.
const positions = 'UDFBLR';
const ganColors = 'WYGBOR';
const names = ['white', 'yellow', 'green', 'blue', 'orange', 'red'];

export function alignment(orientation: string, centers: number[]) {
    const scheme = ColorScheme.valid_schemes_map.get(orientation) || ganColors;
    // CMLL setups can themselves contain M2, so the U/F selector alone
    // doesn't tell us which centers are currently shown on top and in front.
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
