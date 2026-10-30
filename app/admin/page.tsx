import { ServiceSwitch } from "@/components/ServiceSwitch";

export default function AdminHome() {
  return (
    <main className="page wide stack">
      <h1>Service board</h1>
      <ServiceSwitch />
    </main>
  );
}
