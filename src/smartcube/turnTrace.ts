import { CubeMove } from './types';

// Opt-in, bounded and in memory. Render only after capture, so observing
// a tight gesture doesn't add a React render between its two notifications.
export function createTurnTrace() {
    let rows: { event: CubeMove; result: string }[] | null = null;
    let setup = '';
    return {
        start(cue: string) { setup = cue; rows = []; },
        receive(event: CubeMove, result: string) {
            if (!rows) return;
            if (rows.length === 24) rows.shift();
            rows.push({ event, result });
        },
        mapped(move: string, sources: readonly CubeMove[]) {
            if (!rows) return;
            const result = sources.length === 1 ? move : `${move} (pair #${sources[0].serial} + #${sources[1].serial})`;
            for (const row of rows) if (sources.includes(row.event)) row.result = result;
        },
        finish() {
            const lines = (rows || []).map(({ event: e, result }) =>
                `#${e.serial} ${e.move}  cube=${e.cubeTimestamp === null ? '?' : e.cubeTimestamp}  ` +
                `host=${e.localTimestamp === null ? '?' : e.localTimestamp}  → ${result}`);
            rows = null;
            return setup + '\n' + (lines.length ? lines.join('\n') : 'No move events received.');
        }
    };
}
