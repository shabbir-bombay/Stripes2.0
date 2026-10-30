/** Pickup, drop-off and party size, as a card. */
export function RideSummary({ pickup, dropoff, partySize }: { pickup: string; dropoff: string; partySize: number }) {
  return (
    <dl className="card summary">
      <dt>Pickup</dt>
      <dd>{pickup}</dd>
      <dt>Drop-off</dt>
      <dd>{dropoff}</dd>
      <dt>Riders</dt>
      <dd>{partySize}</dd>
    </dl>
  );
}
