import '../../react/styles.css';
import './public.css';

export function NotFound() {
  return (
    <div className="of-host">
      <div className="of-root" data-layout="card">
        <div className="of-form of-notice">
          <p className="of-eyebrow">404</p>
          <h1 className="of-title">Page not found</h1>
        </div>
      </div>
    </div>
  );
}
