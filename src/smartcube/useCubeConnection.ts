import { useLayoutEffect, useRef, useState } from 'react';
import { ConnectCube, CubeConnection, CubeEvent } from './types';

type Session = { connection?: CubeConnection };
type Status = 'idle' | 'connecting' | 'connected' | 'disconnecting';

// A pending browser chooser can outlive this view. Only events from the
// current session are delivered; close any handle that arrives after unmount.
export function useCubeConnection(onEvent: (event: CubeEvent) => void, reset: () => void) {
    const session = useRef<Session | null>(null);
    const [status, setStatus] = useState<Status>('idle');
    const [message, setMessage] = useState('Not connected');
    const handlers = useRef({ onEvent, reset });
    useLayoutEffect(() => { handlers.current = { onEvent, reset }; });
    useLayoutEffect(() => () => {
        const old = session.current;
        session.current = null;
        if (old && old.connection) void old.connection.disconnect().catch(() => {});
    }, []);

    async function connect(open: ConnectCube) {
        if (session.current) return;
        const current: Session = {};
        session.current = current;
        handlers.current.reset();
        setStatus('connecting');
        setMessage('Connecting…');
        try {
            // Call open immediately, while the button's user gesture is active.
            const connection = await open(event => {
                if (session.current !== current) return;
                if (event.type === 'disconnect') {
                    session.current = null;
                    handlers.current.reset();
                    setStatus('idle');
                    setMessage('Disconnected');
                } else {
                    handlers.current.onEvent(event);
                }
            });
            if (session.current !== current) {
                await connection.disconnect();
                return;
            }
            current.connection = connection;
            setStatus('connected');
            setMessage(`Connected: ${connection.name}`);
        } catch (error) {
            if (session.current !== current) return;
            session.current = null;
            handlers.current.reset();
            setStatus('idle');
            setMessage(error instanceof Error && error.name === 'NotFoundError' ? 'No cube selected.' :
                `Connection failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
        }
    }

    async function disconnect() {
        const old = session.current;
        if (!old || !old.connection) return;
        // Invalidate even if the transport never sends its disconnect event.
        const closing = {};
        session.current = closing;
        handlers.current.reset();
        setStatus('disconnecting');
        setMessage('Disconnecting…');
        let result = 'Disconnected';
        try { await old.connection.disconnect(); }
        catch { result = 'Could not confirm disconnection. Input stopped.'; }
        if (session.current === closing) {
            session.current = null;
            setStatus('idle');
            setMessage(result);
        }
    }
    return { connect, disconnect, status, message };
}
