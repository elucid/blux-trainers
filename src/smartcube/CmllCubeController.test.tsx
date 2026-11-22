import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { getInitialState, reducer } from '../reducers/Reducer';
import { CubieCube } from '../lib/CubeLib';
import { connectGanCube } from './gan';
import { alignment, physicalCenters } from './alignment';
import { CmllCubeController } from './CmllCubeController';
import { CubeEvent, CubeConnection } from './types';

jest.mock('./gan', () => ({ connectGanCube: jest.fn() }));

function mountController(scramble = 'R U F M2') {
    const root = document.createElement('div');
    const state = getInitialState('cmll');
    state.name = 'solving';
    state.case.state = state.cube.state = new CubieCube().apply(scramble);
    let latest = state;
    function Trainer() {
        const [s, dispatch] = React.useReducer(reducer, state);
        latest = s;
        return <><CmllCubeController state={s} dispatch={dispatch} />
            <button onClick={() => dispatch({ type: 'key', content: '#enter' })}>Redo</button></>;
    }
    act(() => { ReactDOM.render(<Trainer />, root); });
    return {
        async click(text: string) {
            const button = Array.from(root.querySelectorAll('button')).find(b => b.textContent === text)!;
            await act(async () => { button.click(); });
        },
        setPairWindow(ms: number) {
            const select = root.querySelector('select')!;
            act(() => { select.value = String(ms); select.dispatchEvent(new Event('change', { bubbles: true })); });
        },
        trace: () => root.querySelector('pre')?.textContent,
        text: () => root.textContent || '',
        state: () => latest,
        unmount: () => act(() => { ReactDOM.unmountComponentAtNode(root); })
    };
}

test('simulated moves operate the existing CMLL case, including after a slice', async () => {
    jest.useFakeTimers();
    const controller = mountController();
    try {
        const initial = controller.state().cube.state;
        await controller.click('Try simulator');
        expect(controller.state().cube.state).toBe(initial); // ignore the solved FACELETS event
        await controller.click('Start turn trace');
        await controller.click("M'");
        await controller.click('U');
        act(() => { jest.advanceTimersByTime(500); });
        expect(controller.state().cube.history.map(m => m.name)).toEqual(["M'", 'U']);
        expect(controller.state().cube.state).toEqual(initial.apply("M' U"));
        await controller.click('Finish turn trace');
        expect(controller.trace()).toMatch(/#1 [URFDLB]' .*→ M' \(pair #1 \+ #2\)/);
        expect(controller.trace()).toMatch(/#3 [URFDLB] .*→ U/);
        await controller.click('U');
        await controller.click('Redo');
        act(() => { jest.advanceTimersByTime(500); });
        expect(controller.state().cube.state).toBe(initial);
        await controller.click('R');
        await controller.click('Disconnect');
        act(() => { jest.advanceTimersByTime(500); });
        expect(controller.state().cube.history).toEqual([]);
    } finally {
        controller.unmount();
        jest.useRealTimers();
    }
});

test('a scramble ending in M2 still expects the selected grip', async () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: {} });
    let receive!: (event: CubeEvent) => void;
    (connectGanCube as jest.Mock).mockImplementationOnce(listener => {
        receive = listener;
        return Promise.resolve({ name: 'GAN mock', disconnect: async () => {} });
    });
    const controller = mountController('R U F M2');
    controller.state().cube.ori = 'YR';
    try {
        await controller.click('Connect GAN cube');
        expect(controller.text()).toMatch(/top yellow.*front red.*right green/);
        // GAN calls the yellow center D and the red center R; in a YR grip they're U and F.
        act(() => {
            receive({ type: 'move', move: 'D', serial: 1, cubeTimestamp: 100, localTimestamp: 100 });
            receive({ type: 'move', move: 'R', serial: 5, cubeTimestamp: 500, localTimestamp: 500 });
            jest.advanceTimersByTime(500);
        });
        expect(controller.state().cube.history.map(m => m.name)).toEqual(['U', 'F']);
    } finally {
        controller.unmount();
        jest.useRealTimers();
    }
});

test('a controller turn can finish CMLL while the LSE edges are still unsolved', async () => {
    jest.useFakeTimers();
    const controller = mountController("M2 R'");
    try {
        await controller.click('Try simulator');
        await controller.click('R');
        act(() => { jest.advanceTimersByTime(500); });
        expect(controller.state().name).toBe('solved');
        expect(controller.state().cube.state).toEqual(new CubieCube().apply('M2'));
    } finally {
        controller.unmount();
        jest.useRealTimers();
    }
});

test('relaxed window pairs turns 85 ms apart without changing the 60 ms default', async () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: {} });
    let receive!: (event: CubeEvent) => void;
    (connectGanCube as jest.Mock).mockImplementationOnce(listener => {
        receive = listener;
        return Promise.resolve({ name: 'GAN mock', disconnect: async () => {} });
    });
    const controller = mountController();
    const { toSensor } = alignment(controller.state().cube.ori, physicalCenters([]));
    const attempt = () => act(() => {
        receive({ type: 'move', move: toSensor("R'"), serial: 3, cubeTimestamp: 100, localTimestamp: 250 });
        jest.advanceTimersByTime(85);
        receive({ type: 'move', move: toSensor('L'), serial: 4, cubeTimestamp: 185, localTimestamp: 335 });
        jest.advanceTimersByTime(150);
    });
    try {
        await controller.click('Connect GAN cube');
        attempt();
        expect(controller.state().cube.history.map(m => m.name)).toEqual(["R'", 'L']);
        await controller.click('Redo');
        controller.setPairWindow(120);
        attempt();
        expect(controller.state().cube.history.map(m => m.name)).toEqual(["M'"]);
    } finally {
        controller.unmount();
        jest.useRealTimers();
    }
});

test('leaving CMLL during pairing releases a late connection', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: {} });
    let resolve!: (c: CubeConnection) => void;
    let emit!: (e: CubeEvent) => void;
    (connectGanCube as jest.Mock).mockImplementationOnce(listener => {
        emit = listener;
        return new Promise(r => { resolve = r; });
    });
    const controller = mountController();
    await controller.click('Connect GAN cube');
    controller.unmount();
    const disconnect = jest.fn(async () => {});
    await act(async () => {
        emit({ type: 'move', move: 'U', serial: 1, cubeTimestamp: null, localTimestamp: null });
        resolve({ name: 'GANic4 (mock)', disconnect });
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(controller.state().cube.history).toEqual([]);
});
