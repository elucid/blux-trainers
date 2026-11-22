import { CubieCube } from '../lib/CubeLib';
import { createMoveNormalizer } from './moves';
import { CubeMove } from './types';

const event = (move: string, serial: number, cubeTimestamp: number | null = serial): CubeMove =>
    ({ type: 'move', move, serial, cubeTimestamp, localTimestamp: null });

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

function stream(options?: Parameters<typeof createMoveNormalizer>[1]) {
    const moves: string[] = [];
    return { moves, ...createMoveNormalizer(move => moves.push(move), options) };
}

// Raw opposition plus a rotation of the core, expressed in the room frame,
// must equal the slice alone. Check all cubies, not just the four centers.
const cases = [
    ["R'", 'L', "M'", 'x'], ['R', "L'", 'M', "x'"],
    ["U'", 'D', 'E', 'y'], ['U', "D'", "E'", "y'"],
    ["F'", 'B', 'S', 'z'], ['F', "B'", "S'", "z'"],
];
for (const [a, b, slice, rotation] of cases) {
    for (const [first, second] of [[a, b], [b, a]]) {
        test(`${first} ${second} becomes ${slice} and correctly remaps every next sensor face`, () => {
            const sim = stream();
            const cube = new CubieCube().apply("F R2 U' L");
            sim.push(event(first, 10));
            sim.push(event(second, 11));
            expect(sim.moves).toEqual([slice]);
            const raw = cube.apply(`${first} ${second}`);
            expect(raw.apply(rotation)).toEqual(cube.apply(slice));
            // Each raw follow-up is in core coordinates: raw rawFace coreRotation
            // must equal slice trainerFace. Priming the raw turn tests handedness.
            for (const face of 'UDFBLR') {
                sim.push(event(face + "'", 12));
                sim.flush();
                const trainerFace = sim.moves[sim.moves.length - 1];
                expect(cube.apply(`${slice} ${trainerFace}`)).toEqual(raw.apply(`${face}' ${rotation}`));
            }
        });
    }
}

test('successive slices use the updated frame for recognition and compose their frame changes', () => {
    const sim = stream();
    ["R'", 'L', "U'", 'D', 'F'].forEach((move, i) => sim.push(event(move, i)));
    sim.flush();
    expect(sim.moves).toEqual(["M'", "S'", 'L']);
});

test('uses a snapshot of the initial sensor-to-trainer alignment, including on realignment', () => {
    const toTrainer = (face: string) => 'UDLRBF'['UDFBLR'.indexOf(face)]; // y
    const sim = stream({ toTrainer });
    ['F', "B'", 'L'].forEach((move, i) => sim.push(event(move, i)));
    sim.flush();
    expect(sim.moves).toEqual(["M'", 'D']);
    sim.reset();
    sim.push(event('L', 20, null));
    expect(sim.moves[2]).toBe('B');
    sim.reset(face => face);
    sim.push(event('L', 21, null));
    expect(sim.moves[3]).toBe('L');
});

test('unmatched turns are delivered in order; next eligible turn can begin a pair', () => {
    const sim = stream();
    ['F', 'F', "R'", 'L'].forEach((move, i) => sim.push(event(move, i)));
    expect(sim.moves).toEqual(['F', 'F', "M'"]);
});

test('same sign, doubles, same face, and nonopposites stay literal', () => {
    const sim = stream();
    const raw = ['R', 'L', "F'", 'F', 'B2', "F'"];
    raw.forEach((move, i) => sim.push(event(move, i)));
    sim.flush();
    expect(sim.moves).toEqual(raw);
});

test('timeout delivers a lone move exactly once; its belated partner cannot pair with it', () => {
    const sim = stream({ windowMs: 50 });
    sim.push(event("R'", 255, 400));
    jest.advanceTimersByTime(109); // 50 ms gesture window + 60 ms delivery grace, minus one
    expect(sim.moves).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(sim.moves).toEqual(["R'"]);
    sim.push(event('L', 0, 405));
    sim.flush();
    jest.runAllTimers();
    expect(sim.moves).toEqual(["R'", 'L']);
});

test.each([["R'", 'L', "M'", 'F'], ['R', "L'", 'M', 'B']])(
    'matches %s %s despite delivery jitter and updates the frame before the next U', (a, b, slice, nextTop) => {
        const sim = stream();
        sim.push(event(a, 12, 53457));
        // Synthetic late delivery: 12 ms apart on the cube, but across the old 60 ms browser timeout.
        jest.advanceTimersByTime(95);
        expect(sim.moves).toEqual([]);
        sim.push(event(b, 13, 53469));
        sim.push(event(nextTop, 14, 53875));
        sim.flush();
        expect(sim.moves).toEqual([slice, 'U']);
    });

test('cube time can rule out pairing even if notifications arrive together', () => {
    for (const gap of [51, -1]) {
        const sim = stream({ windowMs: 50 });
        sim.push(event("R'", 255, 400));
        sim.push(event('L', 0, 400 + gap));
        sim.flush();
        expect(sim.moves).toEqual(["R'", 'L']);
    }
});

test('accepts adjacent moves across counter wrap but not gaps, duplicates or reversals', () => {
    for (const [a, b] of [[255, 0], [65535, 0], [255, 256], [501, 502]]) {
        const sim = stream({ windowMs: 50 });
        sim.push(event("R'", a, 0));
        sim.push(event('L', b, 50)); // inclusive boundary, zero is a valid start time
        expect(sim.moves).toEqual(["M'"]);
    }
    for (const [a, b] of [[1, 3], [2, 2], [10, 9], [1, 258]]) {
        const sim = stream();
        sim.push(event("R'", a, 10));
        sim.push(event('L', b, 11));
        sim.flush();
        expect(sim.moves).toEqual(["R'", 'L']);
    }
});

test('never substitutes host arrival times or fills in missing timestamps', () => {
    const emit = jest.fn();
    const sim = createMoveNormalizer(emit);
    const a = { ...event("R'", 1, 1000), localTimestamp: 4000 };
    const b = { ...event('L', 2, null), localTimestamp: 4001 };
    const c = event("R'", 3, null); // recovered history
    sim.push(a); sim.push(b); sim.push(c);
    expect(emit.mock.calls).toEqual([["R'", [a]], ['L', [b]], ["R'", [c]]]);
    expect(b.cubeTimestamp).toBeNull();
    expect(c.localTimestamp).toBeNull();
    const d = event("R'", 4, 1003), e = event('L', 5, 1005);
    sim.push(d); sim.push(e);
    expect(emit.mock.calls[3]).toEqual(["M'", [d, e]]);
    expect(d.move).toBe("R'");
});

test('session reset drops pending turns, cancels timers, and restores the starting frame', () => {
    const sim = stream();
    ["R'", 'L', 'F'].forEach((move, i) => sim.push(event(move, i)));
    sim.reset();
    sim.push(event("B'", 3));
    sim.flush();
    jest.runAllTimers();
    expect(sim.moves).toEqual(["M'", "B'"]);
});

test('reset from inside a dispatch prevents trailing input from leaking into the next case', () => {
    const moves: string[] = [];
    const sim = createMoveNormalizer(move => { moves.push(move); sim.reset(); });
    sim.push(event('U', 1));
    sim.push(event('F', 2, null));
    jest.runAllTimers();
    expect(moves).toEqual(['U']);
});

test('disabled inference delivers immediate literal turns without rotating the frame', () => {
    const sim = stream({ inferSlices: false });
    ["R'", 'L', 'F'].forEach((move, i) => {
        sim.push(event(move, i));
        expect(sim.moves[i]).toBe(move);
    });
});
