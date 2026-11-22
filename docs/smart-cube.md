# CMLL smart cube controller

**Target: GAN i Carry 4 (`GANic4`), not GAN i4.** Pairing has been reported on hardware; reliable slice recognition has not yet been confirmed.

## Try it

1. Run `npm ci --legacy-peer-deps` and `npm start`. Open **CMLL** (`#cmll`). Under **Visualize as** choose **3D** if desired; the controller does not depend on the renderer.
2. Choose **Try simulator**, then **Next**. Click **M'**: the simulator sends two outer-face observations, but **Last move** should show one `M'`. Click **U** next to check that it still turns the on-screen top layer.
3. For a device instead, use **Connect GAN cube** in Chrome on macOS, on HTTPS or localhost. Wake the cube and select it in the browser chooser. If Chrome cannot read the MAC from advertisements, enter the cube's Bluetooth MAC (not the browser device ID). The app caches a working address locally per device, after receiving initial facelets. No account, server, or key from GAN is needed.
4. Hold the physical centers named in the controller's top/front cue. Do **not** solve or scramble the hardware. Match the cue again after **Next** or **Enter** (redo); CMLL setups can change the visible centers. Orbiting the 3D camera doesn't redefine the axes. Keyboard controls still work. After a manual regrip or a keyboard rotation, match the indicated centers and use **Realign to display**.

**Example grip:** If the cue says yellow top / red front, point the red center toward your chest; green is on your right. On a physical `M'`, the middle layer brings red from front to top and white from bottom to front; green stays on the right. Don't rotate the whole cube to put yellow back on top. A following `U` now turns the **red** layer. `M` does the reverse (top center moves to front). The cue is a prediction based on trainer moves, not a measurement of your grip. If a slice was registered as two faces, redo the case with **Enter**, then match the restored cue before continuing.

Leaving CMLL disconnects the controller. After a disconnect, reconnect explicitly. If the initial state times out, check the address, wake the cube, and ensure it isn't connected to another app.

## What is (and isn't) sensed

The cube reports outer turns relative to its fixed centers. It has no gyro. With **Infer slices** on, two consecutive, opposite-signed turns on opposite faces can stand for a slice. For instance, in trainer coordinates, `R' L` or `L R'` followed closely enough produces **one `M'`**, and the mapper updates the center frame for subsequent turns. It does not send `x` to the trainer. The default pair window is 60 ms **on the cube clock**. The host holds a pending turn for at most the configured window plus 60 ms of delivery grace before committing it as a lone turn (or commits it earlier when another turn rules out a pair). This allows some Bluetooth jitter without merging gestures that were farther apart on the cube. If the trace shows the expected opposite turns arriving a little farther apart, try **Pair window: 120 ms**. It also delays lone turns longer and makes intentional opposite turns easier to mistake for slices; it won't fix missing records or unknown clocks. Turn inference off for immediate literal outer turns.

A genuine slice and two intentionally quick outer turns can produce identical observations. A wide turn can look like one outer turn plus an invisible rotation; it is **not** automatically recognized. Use the keyboard for explicit wide turns and rotations. Recovered turns without cube timestamps are applied literally, never paired using packet arrival time. Realign and redo if a gesture was misinterpreted.

### If a slice is missed

With **Infer slices** checked, start a case, match the indicated grip and choose **Start turn trace**. Make one physical `M'`, pause, turn `U`, pause, then **Finish turn trace**. The trace is local; it contains up to 24 decoded turns, serial numbers, cube/host timestamps and their mappings, not device identifiers. For `M'`, look for two consecutive sensor rows both mapped to the **same** `M' (pair …)` and a third row mapped to `U`. Raw face letters depend on the grip. Two literal turns, a missing row, a `?` clock, or a wrong follow-up face point to different problems. Share those few rows plus the grip cue and intended moves when reporting a miss.

## Implementation notes

- The transport boundary is [`src/smartcube/types.ts`](../src/smartcube/types.ts): open a source with an event callback, receive moves/state/disconnect, close the returned handle. Real and simulated inputs share the same normalizer. Ignore physical facelets in the trainer; the GAN driver needs the first state to initialize its move sequence. Preserve serials and nullable host/cube timestamps at the boundary. No clock fit or timing statistics for controller input.
- The only CMLL view change is mounting `CmllCubeController`. Each logical turn goes through the same `{type: 'key', content: move}` action as csTimer-style keys. The existing `CmllSolvingStateM` owns virtual move history and `CubeUtil.is_cmll_solved` (blocks and corners, up to AUF). No changes to the reducer, case generation, renderer, or other modes.
- Chosen foundation: MIT-licensed [`gan-web-bluetooth` 3.0.2](https://github.com/afedotov/gan-web-bluetooth/tree/3.0.2). The `GAN` chooser prefix covers `GANic4`. [Connection code](https://github.com/afedotov/gan-web-bluetooth/blob/3.0.2/src/gan-smart-cube.ts) selects the driver by service UUID. Its Gen4 service/write/notify UUIDs match the i Carry 4 evidence. Encryption, subscription, sequence gaps, history requests and wrap handling stay in the library. The [sample](https://github.com/afedotov/gan-cube-sample) illustrates subscribing before requesting facelets. [poliva's MIT multi-brand library](https://github.com/poliva/smartcube-web-bluetooth) exposes `connectSmartCube` and common events; the broader protocol registry isn't needed for this first controller.
- Important driver difference: the upstream 3.0.2 [Gen4 decoder](https://github.com/afedotov/gan-web-bluetooth/blob/3.0.2/src/gan-cube-protocol.ts) reads only **one live move record** per notification, so the second of two concatenated 9-byte records (e.g. the `L` of a fast `R' L`) is withheld until history recovery and then arrives without clocks. [`patches/gan-web-bluetooth+3.0.2.patch`](../patches/gan-web-bluetooth+3.0.2.patch) ports the MIT loop from [poliva/smartcube-web-bluetooth@d517e49](https://github.com/poliva/smartcube-web-bluetooth/commit/d517e49ca1460761b92595d05a11b1fecef42f33): every record goes through the same FIFO, with its own serial and cube timestamp and the notification's host timestamp. `patch-package` applies it on `npm ci`/`npm install` (root `postinstall`); `src/smartcube/gen4.test.ts` fails without it. Upgrading the SDK means re-creating or dropping the patch. It also uses `writeValue`, not an explicit serialized write-without-response queue. Do not infer that it has all the behavior of Acubemy's driver or that recovery guarantees no lost turns. No proprietary application bundle was copied.

## Before calling the hardware supported

In Chrome on macOS with an actual **i Carry 4**:

- Verify chooser visibility, Gen4 service discovery, advertisement/manual address paths, wrong-address retry, initial state receipt, and no change to the virtual scramble on connect.
- Compare all six face directions and inverses in different grips, both signs of M, M2 as two gestures, and the next U after a slice. Include M2-center setups and intentional rapid `R' L` with inference off.
- Compare a counted fast sequence against delivered serials and moves, including wrap and recovery. Check whether one notification carries multiple live records. Verify host/cube timestamps are present for live turns and stay unknown when absent from history. `gen4.test.ts` replays synthetic encrypted notifications for a two-turn slice, single turns with padding, and a real gap answered from history. Compare the hardware trace against these cases before treating the decoder regression test as a hardware guarantee.
- Test sleep, unexpected disconnect, manual reconnect, leaving the tab/mode, and Next/Redo during a pending turn. Check for duplicate input or stale subscriptions. Tune the slice window against actual turns, not just the simulator.

Focused regressions: `CI=true npm test -- --watchAll=false --runInBand src/smartcube`.
