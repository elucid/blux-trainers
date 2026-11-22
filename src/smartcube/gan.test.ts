import { connectGanCube as sdkOpen, MacAddressProvider } from 'gan-web-bluetooth';
import { connectGanCube } from './gan';

jest.mock('gan-web-bluetooth', () => ({ connectGanCube: jest.fn() }));
const open = sdkOpen as jest.Mock;
const facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const state = { type: 'FACELETS', facelets };
const device = { id: 'cube-1', name: 'GAN test' } as BluetoothDevice;
function fakeCube() {
    let emit: (event: object) => void = () => {};
    const unsubscribe = jest.fn();
    return {
        deviceName: 'GAN test', deviceMAC: '11:22:33:44:55:66',
        events$: { subscribe(next: typeof emit) { emit = next; return { unsubscribe }; } },
        sendCubeCommand: jest.fn(async () => emit(state)),
        disconnect: jest.fn(async () => emit({ type: 'DISCONNECT' })),
        emit: (event: object) => emit(event), unsubscribe,
    };
}

afterEach(() => { localStorage.clear(); jest.restoreAllMocks(); open.mockReset(); jest.useRealTimers(); });

it('opens in the click stack, subscribes before requesting state, and preserves recovered vs live move clocks', async () => {
    const cube = fakeCube();
    open.mockResolvedValue(cube);
    const recv = jest.fn();
    const connecting = connectGanCube(recv);
    expect(open).toHaveBeenCalledTimes(1);
    const conn = await connecting;
    expect(cube.sendCubeCommand).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' });
    expect(conn.name).toBe(cube.deviceName);
    const recovered = { move: 'R', serial: 255, cubeTimestamp: null, localTimestamp: null };
    const live = { move: "L'", serial: 0, cubeTimestamp: 0, localTimestamp: 123 };
    cube.emit({ type: 'MOVE', ...recovered, timestamp: 999 });
    cube.emit({ type: 'MOVE', ...live, timestamp: 999 });
    cube.emit({ type: 'BATTERY' });
    cube.emit({ type: 'DISCONNECT' });
    await conn.disconnect();
    expect(cube.disconnect).not.toHaveBeenCalled(); // SDK subject is already closed
    expect(recv.mock.calls.map(call => call[0])).toEqual([
        { type: 'state', facelets }, { type: 'move', ...recovered }, { type: 'move', ...live }, { type: 'disconnect' },
    ]);
});

it('caches only a confirmed MAC per device and lets the user correct it after a silent handshake', async () => {
    const cube = fakeCube();
    const prompt = jest.spyOn(window, 'prompt').mockReturnValue('112233445566');
    open.mockImplementation(async (provide: MacAddressProvider) => {
        cube.deviceMAC = (await provide(device, false))!;
        return cube;
    });
    const conn = await connectGanCube(jest.fn());
    await conn.disconnect(); await conn.disconnect();
    expect(cube.disconnect).toHaveBeenCalledTimes(1);
    expect(cube.deviceMAC).toBe('11:22:33:44:55:66');
    expect(localStorage.getItem('blux.gan.mac.cube-1')).toBe(cube.deviceMAC);

    jest.useFakeTimers();
    // Resolve this latch after subscription and timer setup to avoid wall-clock waits.
    let writing!: () => void;
    const written = new Promise<void>(resolve => { writing = resolve; });
    cube.sendCubeCommand.mockImplementationOnce(async () => writing());
    const stalled = connectGanCube(jest.fn());
    await written;
    expect(prompt).toHaveBeenCalledTimes(1); // Used the cache, no prompt
    jest.runOnlyPendingTimers();
    await expect(stalled).rejects.toThrow(/check its MAC/);
    expect(cube.disconnect).toHaveBeenCalledTimes(2);
    prompt.mockReturnValue('aa-bb-cc-dd-ee-ff');
    await (await connectGanCube(jest.fn())).disconnect();
    expect(prompt.mock.calls[1][1]).toBe('11:22:33:44:55:66');
    expect(localStorage.getItem('blux.gan.mac.cube-1')).toBe('AA:BB:CC:DD:EE:FF');

    const other = { ...device, id: 'cube-2', watchAdvertisements: jest.fn() };
    open.mockImplementation(async (provide: MacAddressProvider) => {
        expect(await provide(other, false)).toBeNull(); // Other cube: try advertisement, not cube-1's cache
        await provide(other, true);
    });
    prompt.mockReturnValue('invalid');
    await expect(connectGanCube(jest.fn())).rejects.toThrow(/Invalid MAC/);
    expect(localStorage.getItem('blux.gan.mac.cube-2')).toBeNull();
});

it('ignores moves before valid state, and rejects a disconnect during the handshake without double-closing', async () => {
    const cube = fakeCube();
    open.mockResolvedValue(cube);
    cube.sendCubeCommand.mockImplementation(async () => {
        cube.emit({ type: 'FACELETS', facelets: 'incomplete' });
        cube.emit({ type: 'MOVE', move: 'U', serial: 1, cubeTimestamp: 10, localTimestamp: 20 });
        cube.emit({ type: 'DISCONNECT' });
    });
    const recv = jest.fn();
    await expect(connectGanCube(recv)).rejects.toThrow(/disconnected before its initial state/);
    cube.emit(state); // late notification after teardown
    expect(recv).not.toHaveBeenCalled();
    expect(cube.unsubscribe).toHaveBeenCalledTimes(1);
    expect(cube.disconnect).not.toHaveBeenCalled();
});

it('preserves chooser cancellation, and connects via advertisement with storage blocked', async () => {
    const cancelled = new DOMException('Chooser dismissed', 'NotFoundError');
    open.mockRejectedValueOnce(cancelled);
    await expect(connectGanCube(jest.fn())).rejects.toBe(cancelled);
    const prompt = jest.spyOn(window, 'prompt');
    const blocked = () => { throw new DOMException('Blocked', 'SecurityError'); };
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    const cube = fakeCube();
    open.mockImplementation(async (provide: MacAddressProvider) => {
        expect(await provide({ ...device, watchAdvertisements: jest.fn() }, false)).toBeNull();
        return cube; // SDK resolved MAC from advertisement
    });
    const conn = await connectGanCube(jest.fn());
    expect(prompt).not.toHaveBeenCalled();
    await conn.disconnect();
});

it('closes partial GATT on SDK failure, and unsubscribes/closes on initial command failure', async () => {
    const gatt = { connected: true, disconnect: jest.fn() };
    open.mockImplementationOnce(async (provide: MacAddressProvider) => {
        await provide({ ...device, gatt, watchAdvertisements: jest.fn() } as unknown as BluetoothDevice, false);
        throw new Error('Notifications failed');
    });
    await expect(connectGanCube(jest.fn())).rejects.toThrow('Notifications failed');
    expect(gatt.disconnect).toHaveBeenCalledTimes(1);
    const cube = fakeCube();
    cube.sendCubeCommand.mockRejectedValue(new Error('Write failed'));
    open.mockResolvedValue(cube);
    await expect(connectGanCube(jest.fn())).rejects.toThrow('Write failed');
    expect(cube.unsubscribe).toHaveBeenCalledTimes(1);
    expect(cube.disconnect).toHaveBeenCalledTimes(1);
});
