import { CubieCube, ColorScheme } from '../lib/CubeLib';
import { alignment } from './alignment';

const solved = new CubieCube();

test('default YR grip: a GAN yellow-center turn is U, not D', () => {
    const a = alignment('YR', solved.tp);
    expect([a.top, a.front, a.right]).toEqual(['yellow', 'red', 'green']);
    expect(a.toTrainer("D'")).toBe("U'");
    expect(a.toTrainer('R')).toBe('F');
});

test('a physical M-prime in YR brings the red front center up without moving the green right center', () => {
    const a = alignment('YR', solved.apply("M'").tp);
    expect([a.top, a.front, a.right]).toEqual(['red', 'white', 'green']);
});

test('an M2 in the virtual setup changes which physical centers to hold', () => {
    const a = alignment('WG', solved.apply('M2').tp);
    expect([a.top, a.front]).toEqual(['yellow', 'blue']);
    expect(a.toTrainer('D')).toBe('U');
    expect(a.toTrainer('B')).toBe('F');
});

test('all U/F schemes round trip sensor notation, even with rotated centers', () => {
    for (const ori of ColorScheme.valid_schemes_map.keys()) {
        const a = alignment(ori, solved.apply("M' E S'").tp);
        for (const face of 'URFDLB') expect(a.toTrainer(a.toSensor(face + "'"))).toBe(face + "'");
    }
});
