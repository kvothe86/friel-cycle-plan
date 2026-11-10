import { Placeholder } from '../Placeholder';

export function PlayerScreen() {
  const hasWebBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  return (
    <Placeholder title="Ride (ERG player)" milestone="M6">
      <p>
        Web Bluetooth:{' '}
        <strong className={hasWebBluetooth ? 'ok' : 'warn'}>
          {hasWebBluetooth ? 'available' : 'not available. Use desktop Chrome or Edge'}
        </strong>
      </p>
    </Placeholder>
  );
}
