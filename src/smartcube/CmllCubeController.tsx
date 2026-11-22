import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Paper, Typography } from '@mui/material';
import { Action, AppState } from '../Types';
import { connectGanCube } from './gan';
import { alignment, physicalCenters } from './alignment';
import { createMoveNormalizer, DEFAULT_SLICE_WINDOW_MS } from './moves';
import { connectSimulator, SimulatedCube } from './simulator';
import { useCubeConnection } from './useCubeConnection';
import { createTurnTrace } from './turnTrace';

export function CmllCubeController({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
    const [inferSlices, setInferSlices] = useState(true);
    const [windowMs, setWindowMs] = useState(DEFAULT_SLICE_WINDOW_MS);
    const trace = useMemo(createTurnTrace, []);
    const [tracing, setTracing] = useState(false);
    const [report, setReport] = useState('');
    const sim = useRef<SimulatedCube | null>(null);
    const history = state.cube.history;
    const centers = useMemo(() => physicalCenters(history), [history]);
    const grip = alignment(state.cube.ori, centers);
    const latestGrip = useRef(grip);
    useLayoutEffect(() => { latestGrip.current = grip; });
    const mapper = useMemo(() => createMoveNormalizer((move, sources) => {
        trace.mapped(move, sources);
        dispatch({ type: 'key', content: move });
    }, { inferSlices, windowMs }), [dispatch, inferSlices, windowMs, trace]);
    const realign = useCallback(() => mapper.reset(latestGrip.current.toTrainer), [mapper]);
    // Space / Enter, solving a case, and leaving CMLL all end an input window.
    // A delayed half-gesture must never become the first turn of the next case.
    useLayoutEffect(() => {
        realign();
        return () => mapper.reset();
    }, [mapper, realign, state.case, state.name]);

    const connection = useCubeConnection(event => {
        // The trainer owns the virtual scramble and solved predicate. A state
        // snapshot, including the one that bootstraps GAN move history, is not input.
        if (event.type === 'move') {
            const ignored = state.name !== 'solving' ? 'ignored (no active case)' :
                !/^[URFDLB]'?$/.test(event.move) ? 'ignored (not a quarter turn)' : '';
            trace.receive(event, ignored || 'pending');
            if (!ignored) mapper.push(event);
        }
    }, realign);
    const { status, message } = connection;
    const connected = status === 'connected';
    const canPair = window.isSecureContext && 'bluetooth' in navigator;
    const active = state.name === 'solving';
    function simulate(...moves: string[]) {
        if (sim.current) sim.current.turn(...moves.map(grip.toSensor));
    }

    return <Box mb={1} onKeyDown={e => {
        // Keyboard activation of a controller button isn't Space/Enter for the trainer.
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
    }} onClick={e => {
        // After a mouse click, give Space/Enter back to the trainer shortcuts.
        if (e.detail && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }}>
        <Paper variant="outlined">
            <Box px={2} py={1}>
                <Typography variant="subtitle2">Smart cube controller <small>· experimental</small></Typography>
                <Typography variant="body2" role="status">{message}</Typography>
                {status === 'idle' && <>
                    <Button size="small" disabled={!canPair} onClick={() => {
                        sim.current = null;
                        void connection.connect(connectGanCube);
                    }}>Connect GAN cube</Button>
                    <Button size="small" onClick={() => void connection.connect(emit => {
                        sim.current = connectSimulator(emit);
                        return sim.current;
                    })}>Try simulator</Button>
                    {!canPair && <Typography variant="caption" component="div">Pairing needs Chrome on HTTPS or localhost. The simulator needs no Bluetooth.</Typography>}
                </>}
                {connected && <>
                    <Typography variant="body2">
                        {active ? <>Expected physical centers: <b>top {grip.top}</b> · <b>front {grip.front}</b> (toward you) · <b>right {grip.right}</b>.</> : 'Press Next to start a case.'}
                        {history.length > 0 && ` Last move: ${history[history.length - 1].name}`}
                    </Typography>
                    <details>
                        <summary>How to hold the cube</summary>
                        <Typography variant="body2">Match the centers, not the scrambled stickers. Every case starts in the selected orientation, even when the on-screen top center is the opposite color: hold by the left and right blocks, and ignore where the scramble left the M slice. In the default 3D view the two side faces you see are front (on the left of the picture) and right. Dragging the camera does not change which face is front.</Typography>
                        <Typography variant="body2">For M′, hold the left and right layers still and turn the middle so the front center comes to the top. M takes the top center to the front. Keep that new grip; don’t rotate the whole cube back. The cue updates to match a recognized slice.</Typography>
                        <Typography variant="body2">The i Carry 4 cannot sense a whole-cube rotation. After a regrip, match the cue and click Realign to display. If a move was wrong, press Enter to redo the case first; realignment doesn’t undo turns.</Typography>
                    </details>
                    {sim.current && <Box aria-label="Simulated gestures">
                        <Typography variant="caption">Simulate a turn: </Typography>
                        {['U', 'R', 'M\''].map(move => <Button key={move} disabled={!active} size="small"
                            onClick={() => move === "M'" ? simulate("R'", 'L') : simulate(move)}>{move}</Button>)}
                    </Box>}
                    <FormControlLabel control={<Checkbox size="small" checked={inferSlices}
                        onChange={e => setInferSlices(e.target.checked)} />} label="Infer slices from quick opposite turns" />
                    {inferSlices && <label>Pair window: <select value={windowMs}
                        onChange={e => setWindowMs(Number(e.target.value))} onKeyDown={e => e.stopPropagation()}>
                        <option value={DEFAULT_SLICE_WINDOW_MS}>{DEFAULT_SLICE_WINDOW_MS} ms</option>
                        <option value={120}>120 ms</option>
                    </select></label>}
                    <Button size="small" onClick={realign}>Realign to display</Button>
                    <Button size="small" onClick={() => void connection.disconnect()}>Disconnect</Button>
                </>}
                {(connected || tracing) && <Button size="small" onClick={() => {
                    if (tracing) setReport(trace.finish());
                    else {
                        setReport('');
                        trace.start(`Start: ${grip.top} top / ${grip.front} front; pairing ${inferSlices ? `${windowMs} ms` : 'off'}`);
                    }
                    setTracing(!tracing);
                }}>{tracing ? 'Finish turn trace' : 'Start turn trace'}</Button>}
                {tracing && <Typography variant="caption">Make one slice, pause, then finish the trace.</Typography>}
                {report && <Box>
                    <Typography variant="caption">Sensor turns → trainer moves (last 24; clocks in ms; ? = unknown)</Typography>
                    <pre style={{ overflowX: 'auto' }}>{report}</pre>
                </Box>}
            </Box>
        </Paper>
    </Box>;
}
