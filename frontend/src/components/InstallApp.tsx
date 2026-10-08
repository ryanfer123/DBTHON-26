import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function InstallApp() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    function available(event: Event) {
      event.preventDefault();
      setInstall(event as InstallEvent);
    }
    function done() {
      setInstalled(true);
      setInstall(null);
    }
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function prompt() {
    if (!install) return;
    await install.prompt();
    const result = await install.userChoice;
    if (result.outcome === "accepted") setInstalled(true);
    setInstall(null);
  }
  return (
    <section className="settings-section">
      <h2>Use NomNom on your phone</h2>
      {install && (
        <button className="button button-outline" onClick={() => void prompt()}>
          Install NomNom
        </button>
      )}
      <p>
        {installed
          ? "Installed. Open NomNom from your home screen."
          : "On iPhone, open in Safari and choose Share → Add to Home Screen. Other browsers may offer Install in their menu."}
      </p>
      <p className="field-help">
        The offline shell provides collection guidance. Account data stays
        online; pickup and delivery confirmations require a live connection.
      </p>
    </section>
  );
}
