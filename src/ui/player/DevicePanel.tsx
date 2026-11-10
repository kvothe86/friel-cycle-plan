import { hasWebBluetooth } from '../../player/ble/devices';
import { usePlayerStore } from '../../player/store';

const STATE_TEXT = { connected: 'connected', reconnecting: 'reconnecting…', disconnected: 'disconnected' } as const;

export function DevicePanel({ ftp }: { ftp: number }) {
  const { trainer, hr, pm, deviceState, live, connect, disconnect, error } = usePlayerStore();
  const bt = hasWebBluetooth();

  const row = (slot: 'trainer' | 'hr' | 'pm', label: string, device: { name: string } | undefined, reading: string, optional = false) => (
    <li className="device">
      <span className="device-label">{label}{optional && <span className="muted small"> (optional)</span>}</span>
      {device ? (
        <>
          <span>{device.name} · <span className={deviceState[slot] === 'connected' ? 'ok' : 'warn'}>{STATE_TEXT[deviceState[slot] ?? 'connected']}</span></span>
          <span className="device-reading">{reading}</span>
          <button type="button" className="small-btn" onClick={() => disconnect(slot)}>Disconnect</button>
        </>
      ) : (
        <span className="device-actions">
          <button type="button" disabled={!bt} onClick={() => void connect(slot)}>Connect</button>
          {slot === 'trainer' && (
            <button type="button" onClick={() => void connect('trainer', ftp)}>Use demo trainer</button>
          )}
        </span>
      )}
    </li>
  );

  return (
    <div className="card">
      <h2>Devices</h2>
      {!bt && <p className="banner warn">This browser has no Web Bluetooth. Use desktop Chrome or Edge to connect a trainer; the demo trainer works anywhere.</p>}
      <ul className="plain devices">
        {row('trainer', 'Smart trainer', trainer, live.power !== undefined ? `${Math.round(live.power)} W · ${Math.round(live.cadence ?? 0)} rpm` : '')}
        {row('hr', 'Heart rate', hr, live.heartRate ? `${live.heartRate} bpm` : '', true)}
        {row('pm', 'Power meter', pm, pm && live.power !== undefined ? `${Math.round(live.power)} W` : '', true)}
      </ul>
      <p className="muted small">
        Elite Suito and other FTMS trainers: close Zwift / My E-Training first (a trainer accepts one controller at a time), and keep
        the trainer firmware up to date. A connected power meter replaces the trainer's power and cadence in the recording.
      </p>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
