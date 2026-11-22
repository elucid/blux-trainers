import { connectGanCube } from './gan';
import { createMoveNormalizer } from './moves';
import { CubeEvent, CubeMove } from './types';

// Synthetic on-wire transcripts, encrypted for the fictitious MAC below. Only
// Web Bluetooth is mocked; no copy of the SDK's parser, cipher or FIFO in the test.
const mac = '0A:1B:2C:3D:4E:5F';
const packets = {
    requestState: 'b8f1f08ce4fa565c734d1ac7e0a82cca28dfc6fa',   // DD 04 00 ED 00 00 + zeros
    state: '76d021fc6410b0ae60fd86bfb85bcf4291b480b7',          // solved FACELETS, serial 4
    requestHistory: '4d0f8dfc240f04b4fb5b5f1b5fcf1ac456b6c126', // D1 04 07 00 02 + zeros
    batch: '480aea8204963391c0d778c543292413434779fd',          // R' #5 @100000, L #6 @100030
    // Decrypted batch (two MOVE headers and two padding bytes):
    // 01 07 a0 86 01 00 05 00 60 | 01 07 be 86 01 00 06 00 10 | 00 00
    follow: 'f099b63ea25dcd2712d5983f344fa9d7587b9d21',         // F #7 @100400
    u: 'b526048c444129e7e2cd11a9b7f139c6878b2686',              // U #5 @3000 + zero padding
    dPrime: 'b824c62f6e4076c03371d1f26d2a4f9b2ceef73d',         // D' #6 @3100 + 0xA5 padding
    r: '352c3a7dcc68ea746d06a1eb2c1fa8e407c59c02',              // R #7 @3100
    historyFL: 'b5ca20e8496634e3ed1a64c0de22c49ac3f70d21',      // history: F #7, L #6
    historyRB: '6e901366bfe5e47e6da8884dca025a9b57ed0cae',      // history: R #7, B' #6
};

async function connect(historyReply = packets.historyFL) {
    let onNotify!: (event: Event) => Promise<void>;
    const state = {
        value: new DataView(new ArrayBuffer(0)),
        addEventListener: (_: string, listener: typeof onNotify) => { onNotify = listener; },
        removeEventListener: jest.fn(), startNotifications: jest.fn(), stopNotifications: async () => {},
    };
    const notify = async (hex: string) => {
        const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
        state.value = new DataView(bytes.buffer);
        await onNotify({ target: state } as unknown as Event);
    };
    const commands: string[] = [];
    let replies = Promise.resolve();
    const command = { writeValue: async (data: Uint8Array) => {
        const hex = Buffer.from(data).toString('hex');
        commands.push(hex);
        if (hex !== packets.requestState && hex !== packets.requestHistory) throw new Error('Unexpected command');
        replies = replies.then(() => notify(hex === packets.requestState ? packets.state : historyReply));
    } };
    const gatt = {
        connected: true, connect: async () => gatt, disconnect: jest.fn(),
        getPrimaryServices: async () => [{ uuid: '00000010-0000-fff7-fff6-fff5fff4fff0',
            getCharacteristic: async (uuid: string) => uuid.startsWith('0000fff5') ? command : state }],
    };
    const device = { id: 'fixture', name: 'GANic4_FAKE', gatt, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async () => device } });
    localStorage.setItem('blux.gan.mac.fixture', mac);
    const events: CubeEvent[] = [];
    const conn = await connectGanCube(e => events.push(e));
    return {
        conn, commands, moves: () => events.filter((e): e is CubeMove => e.type === 'move'),
        async send(packet: string, hostMs: number) {
            jest.spyOn(performance, 'now').mockReturnValue(hostMs);
            await notify(packet);
            await replies;
        }
    };
}

afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    delete (navigator as { bluetooth?: unknown }).bluetooth;
});

it('keeps both live turns and their clocks, rather than recovering the second without timing', async () => {
    const cube = await connect();
    await cube.send(packets.batch, 5000);
    await cube.send(packets.follow, 5400);
    expect(cube.moves()).toEqual([
        { type: 'move', move: "R'", serial: 5, cubeTimestamp: 100000, localTimestamp: 5000 },
        { type: 'move', move: 'L', serial: 6, cubeTimestamp: 100030, localTimestamp: 5000 },
        { type: 'move', move: 'F', serial: 7, cubeTimestamp: 100400, localTimestamp: 5400 },
    ]);
    expect(cube.commands).toEqual([packets.requestState]);
    const out: string[] = [];
    const mapper = createMoveNormalizer(m => out.push(m));
    cube.moves().forEach(mapper.push);
    mapper.flush();
    expect(out).toEqual(["M'", 'U']);
    await cube.conn.disconnect();
});

it('does not treat padding after a single turn as another turn', async () => {
    const cube = await connect();
    await cube.send(packets.u, 700);
    await cube.send(packets.dPrime, 800);
    expect(cube.moves().map(m => m.move)).toEqual(['U', "D'"]);
    expect(cube.commands).toEqual([packets.requestState]);
    await cube.conn.disconnect();
});

it('still recovers a genuinely missing turn in order without fabricating timestamps', async () => {
    const cube = await connect(packets.historyRB);
    await cube.send(packets.u, 900);
    await cube.send(packets.r, 1000);
    expect(cube.commands).toEqual([packets.requestState, packets.requestHistory]);
    expect(cube.moves().map(m => m.move)).toEqual(['U', "B'", 'R']);
    expect(cube.moves()[1]).toEqual({ type: 'move', move: "B'", serial: 6, cubeTimestamp: null, localTimestamp: null });
    await cube.conn.disconnect();
});
