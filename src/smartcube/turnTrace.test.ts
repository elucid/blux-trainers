import { createTurnTrace } from './turnTrace';
import { CubeMove } from './types';

const turn = (serial: number): CubeMove => ({ type: 'move', move: 'L', serial, cubeTimestamp: null, localTimestamp: null });

it('records only the requested sample, keeps unknown clocks, and distinguishes ignored input', () => {
    const trace = createTurnTrace();
    trace.receive(turn(0), 'pending');
    trace.start('test grip');
    for (let serial = 1; serial <= 25; serial++) trace.receive(turn(serial), 'ignored (no active case)');
    const report = trace.finish();
    expect(report.split('\n')).toHaveLength(25); // header + at most 24 rows
    expect(report).not.toMatch(/#[01] L/);
    expect(report).toContain('#25 L  cube=?  host=?  → ignored (no active case)');
    trace.start('next grip');
    expect(trace.finish()).toBe('next grip\nNo move events received.');
});
