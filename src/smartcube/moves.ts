import { Move } from '../lib/CubeLib';
import { CubeMove } from './types';

const faces = 'UDFBLR'; // CubeLib center indices
const quarter = /^[UDFBLR]'?$/;
export const DEFAULT_SLICE_WINDOW_MS = 60;
// Bluetooth may deliver the second live report late even when the two sensor
// timestamps are close. This is a host-side wait budget, NOT extra gesture time.
const DELIVERY_GRACE_MS = 60;

// Keyed by the unprimed outer turn, in trainer coordinates. The core turns
// opposite to the two sensed outer layers. In *this* CubeLib E turns like U
// (y = U E D'), not D; M turns like L and S turns like F.
const pairs: { [unprimed: string]: [string, string] } = {
    R: ["L'", 'M'], L: ["R'", "M'"],
    D: ["U'", 'E'], U: ["D'", "E'"],
    B: ["F'", 'S'], F: ["B'", "S'"],
};

function adjacent(first: number, second: number) {
    // Live GAN serials can be 16-bit; history and some sources use 8 bits.
    // Don't mask both down to a byte: e.g. 1 -> 258 isn't adjacent.
    return second === first + 1 || (second === 0 && (first === 255 || first === 65535));
}

type Alignment = (sensorFace: string) => string;
const identity: Alignment = face => face;

/**
 * Normalize one ordered session of sensor turns. A callback gets the trainer
 * move and its untouched source observation(s), including any null timestamps.
 * `toTrainer` describes the physical center alignment at session start only;
 * we snapshot it so subsequent trainer renders can't double-count a slice.
 * Unobserved regrips require manual realignment. Disable the heuristic when
 * literal rapid opposite turns are intended: the sensor can't distinguish them.
 */
export function createMoveNormalizer(
    emit: (move: string, source: readonly CubeMove[]) => void,
    { inferSlices = true, windowMs = DEFAULT_SLICE_WINDOW_MS, toTrainer = identity }: {
        inferSlices?: boolean; windowMs?: number; toTrainer?: Alignment;
    } = {},
) {
    if (!Number.isFinite(windowMs) || windowMs < 0) throw new Error('Expected a finite nonnegative slice window');
    let initial = Array.from(faces, toTrainer);
    // Trainer position occupied by each physical (sensor) center.
    let frame = initial;
    let session = 0;
    let pending: { event: CubeMove; move: string; timer: ReturnType<typeof setTimeout> } | null = null;

    function takePending() {
        const old = pending;
        if (old) clearTimeout(old.timer);
        pending = null;
        return old;
    }
    function flush() {
        const old = takePending();
        if (old) emit(old.move, [old.event]);
    }
    function reset(alignment?: Alignment) {
        session++;
        takePending(); // discard, never dispatch a delayed turn into a new case
        if (alignment) initial = Array.from(faces, alignment);
        frame = initial;
    }
    function push(event: CubeMove) {
        const old = takePending();
        const index = faces.indexOf(event.move[0]);
        const move = index < 0 ? event.move : frame[index] + event.move.slice(1);
        const time = event.cubeTimestamp;
        // Arrival times (especially for batched/history events) don't establish
        // physical simultaneity. Only compare measured times in the cube clock.
        if (inferSlices && quarter.test(move) && time !== null && Number.isFinite(time)) {
            if (old && adjacent(old.event.serial, event.serial)) {
                const dt = time - old.event.cubeTimestamp!;
                const [plain, prime] = move.length === 1 ? [move, old.move] : [old.move, move];
                const pair = pairs[plain];
                if (dt >= 0 && dt <= windowMs && pair && pair[0] === prime) {
                    const slice = pair[1];
                    const centers = Move.all[slice].tpc; // [source position, destination position]
                    frame = frame.map(face => {
                        const change = centers.find(([src]) => faces[src] === face);
                        return change ? faces[change[1]] : face;
                    });
                    emit(slice, [old.event, event]);
                    return;
                }
            }
            pending = { event, move, timer: setTimeout(flush, windowMs + DELIVERY_GRACE_MS) };
            if (old) emit(old.move, [old.event]);
        } else {
            const before = session;
            if (old) emit(old.move, [old.event]);
            // A synchronous dispatch of the pending turn may finish the case.
            if (session === before) emit(move, [event]);
        }
    }
    return { push, flush, reset };
}
