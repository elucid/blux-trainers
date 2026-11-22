import { connectGanCube as openGan, GanCubeEvent, MacAddressProvider } from 'gan-web-bluetooth';
import { CubeConnection, CubeEvent } from './types';

const cacheKey = (id: string) => `blux.gan.mac.${id}`;
const needsCorrection = new Set<string>();

function normalizeMac(input: string): string | null {
    const s = input.trim().toUpperCase();
    if (!/^(?:[0-9A-F]{12}|[0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})$/.test(s)) return null;
    return s.replace(/[:-]/g, '').match(/../g)!.join(':');
}

function savedMac(id: string): string | null {
    try { return normalizeMac(localStorage.getItem(cacheKey(id)) || ''); }
    catch { return null; } // Storage is optional (e.g. private browsing).
}

/** Call directly in a user gesture: openGan invokes requestDevice before its first await. */
export async function connectGanCube(onEvent: (event: CubeEvent) => void): Promise<CubeConnection> {
    let selected: BluetoothDevice | undefined;
    const provideMac: MacAddressProvider = async (device, fallback) => {
        selected = device;
        const saved = savedMac(device.id);
        if (!needsCorrection.has(device.id) && !fallback) {
            if (saved) return saved;
            if (typeof device.watchAdvertisements === 'function') return null; // Try advertisement first.
        }
        // In 3.0.2 the advertisement helper doesn't return early when the API is missing.
        const input = window.prompt(`Enter the Bluetooth MAC address of ${device.name || 'this GAN cube'} (AA:BB:CC:DD:EE:FF):`, saved || '');
        if (input === null) throw new Error('MAC address entry cancelled.');
        const mac = normalizeMac(input);
        if (!mac) throw new Error('Invalid MAC address. Enter six hexadecimal byte pairs.');
        return mac;
    };

    const sdk = await openGan(provideMac).catch(error => {
        // The SDK can fail after GATT connects but before it returns a connection.
        if (selected && selected.gatt && selected.gatt.connected) selected.gatt.disconnect();
        throw error;
    });
    let closed = false;
    let ready = false;
    let accept!: () => void;
    let fail!: (reason: Error) => void;
    const initialState = new Promise<void>((resolve, reject) => { accept = resolve; fail = reject; });
    const sub = sdk.events$.subscribe((event: GanCubeEvent) => {
        if (closed) return;
        if (event.type === 'DISCONNECT') {
            closed = true; // SDK closes its Subject; never disconnect the same handle twice.
            if (ready) onEvent({ type: 'disconnect' });
            else fail(new Error('Cube disconnected before its initial state arrived.'));
        } else if (event.type === 'FACELETS' && /^[URFDLB]{54}$/.test(event.facelets)) {
            if (!ready) {
                ready = true;
                if (selected) {
                    needsCorrection.delete(selected.id);
                    try { localStorage.setItem(cacheKey(selected.id), sdk.deviceMAC); } catch { /* optional cache */ }
                }
                accept();
            }
            onEvent({ type: 'state', facelets: event.facelets });
        } else if (ready && event.type === 'MOVE') {
            const { move, serial, cubeTimestamp, localTimestamp } = event;
            onEvent({ type: 'move', move, serial, cubeTimestamp, localTimestamp });
        }
    });
    async function disconnect() {
        sub.unsubscribe();
        if (closed) return;
        closed = true;
        await sdk.disconnect();
    }

    // The Gen3/4 driver ignores moves until FACELETS initializes its serial. A GATT
    // write alone can't confirm that the supplied MAC actually decrypts packets.
    const timer = window.setTimeout(() => {
        if (selected) needsCorrection.add(selected.id);
        fail(new Error('No cube state received. Wake the cube, reconnect and check its MAC address.'));
    }, 6000);
    try {
        sdk.sendCubeCommand({ type: 'REQUEST_FACELETS' }).catch(fail);
        await initialState;
        return { name: sdk.deviceName, disconnect };
    } catch (error) {
        await disconnect();
        throw error;
    } finally {
        window.clearTimeout(timer);
    }
}
