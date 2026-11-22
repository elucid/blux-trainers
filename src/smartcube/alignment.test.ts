import { CubieCube, ColorScheme, MoveSeq } from '../lib/CubeLib';
import { alignment, physicalCenters } from './alignment';

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

test('the grip ignores the M-slice offset left by the scramble', () => {
    // A CMLL case can be set up with M2, so the virtual top center is white,
    // but the case still starts in the selected yellow-top/red-front grip.
    const a = alignment('YR', physicalCenters([]));
    expect([a.top, a.front, a.right]).toEqual(['yellow', 'red', 'green']);
    expect(a.toTrainer('D')).toBe('U'); // yellow center is GAN "D"
});

test('slices turned during the attempt move the physical centers', () => {
    const history = new MoveSeq("R M' U M2").moves;
    const a = alignment('YR', physicalCenters(history));
    expect(physicalCenters(history)).toEqual(solved.apply("M'").apply('M2').tp);
    expect([a.top, a.front, a.right]).toEqual(['orange', 'yellow', 'green']); // net M
});

test('all U/F schemes round trip sensor notation, even with rotated centers', () => {
    for (const ori of ColorScheme.valid_schemes_map.keys()) {
        const a = alignment(ori, solved.apply("M' E S'").tp);
        for (const face of 'URFDLB') expect(a.toTrainer(a.toSensor(face + "'"))).toBe(face + "'");
    }
});
