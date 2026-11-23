import { Icon } from "./Icon";

/** The Stripes name and logo, so the sign-in screens say which app this is. */
export function Wordmark() {
  return (
    <div className="wordmark">
      <span className="wordmark-logo" aria-hidden="true">
        <Icon name="ride" />
      </span>
      <div>
        <span className="wordmark-name">STRIPES</span>
        <span className="small">Campus cart rides at Pacific</span>
      </div>
    </div>
  );
}
