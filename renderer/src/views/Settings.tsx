import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useData } from '../components/store';
import { useUI, Field, ModalHeader, ModalBody, ModalFooter } from '../components/ui';
import { isoToday } from '../lib/schedule';

export default function SettingsView() {
  const { reload } = useData();
  const { toast, showModal, closeModal } = useUI();
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState('');
  const [anchor, setAnchor] = useState(isoToday());
  const [recovery, setRecovery] = useState<{ total: number; remaining: number }>({ total: 0, remaining: 0 });

  const loadRecovery = async () => setRecovery(await api.auth.recoveryStatus());

  useEffect(() => {
    (async () => {
      setHasPin(await api.auth.hasPin());
      setAnchor((await api.settings.get('anchor')) || isoToday());
      await loadRecovery();
    })();
  }, []);

  const savePin = async () => { await api.auth.setPin(pin); setHasPin(!!pin); setPin(''); toast('Šifra sačuvana.', 'ok'); };
  const saveAnchor = async () => { await api.settings.set('anchor', anchor); await reload(); toast('Anchor sačuvan.', 'ok'); };

  const generateRecovery = async () => {
    if (recovery.total > 0 && !window.confirm('Generisanje novih rezervnih šifri trajno poništava sve prethodne (i iskorišćene i neiskorišćene). Nastaviti?')) return;
    const codes = await api.auth.generateRecoveryCodes();
    await loadRecovery();
    showModal(
      <>
        <ModalHeader title="Rezervne (admin) šifre" onClose={closeModal} />
        <ModalBody>
          <div className="text-sm text-mut2">
            Sačuvajte ove šifre na sigurno mjesto — prikazuju se <b>samo sada</b> i neće više biti vidljive.
            Svaka šifra radi <b>samo jednom</b>: pošaljite jednu osobi koja je zaboravila svoju šifru da se prijavi,
            nakon čega ta šifra prestaje da važi. Nakon prijave preporučite im da postave novu ličnu šifru.
          </div>
          <div className="flex flex-col gap-1.5 font-mono text-base tracking-wide">
            {codes.map((c) => (
              <div key={c} className="bg-panel2 border border-bd rounded-md px-3 py-2">{c}</div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="btn btn-primary" onClick={closeModal}>Sačuvao/la sam ih</button>
        </ModalFooter>
      </>
    );
  };

  return (
    <div>
      <div className="mb-5"><div className="text-2xl font-bold tracking-tight">Postavke</div></div>
      <div className="card p-5 max-w-xl flex flex-col gap-6">
        <Field label="Šifra za pristup aplikaciji">
          <div className="text-xs text-mut2 mb-1.5">{hasPin ? 'Šifra je postavljena.' : 'Trenutno nema šifre — aplikacija se otvara bez prijave.'}</div>
          <input type="password" placeholder="Nova šifra (ostavite prazno da uklonite)" value={pin} onChange={(e) => setPin(e.target.value)} />
          <button className="btn btn-primary mt-2 self-start" onClick={savePin}>Sačuvaj šifru</button>
        </Field>

        {hasPin && (
          <Field label="Rezervne (admin) šifre za oporavak">
            <div className="text-xs text-mut2 mb-1.5">
              {recovery.total === 0
                ? 'Nema generisanih rezervnih šifri. Generišite ih unaprijed da biste mogli poslati jednu nekome ko zaboravi svoju šifru.'
                : `Preostalo neiskorišćenih: ${recovery.remaining} / ${recovery.total}.`}
            </div>
            <button className="btn mt-1 self-start" onClick={generateRecovery}>
              {recovery.total === 0 ? 'Generiši rezervne šifre' : 'Generiši nove (poništava stare)'}
            </button>
          </Field>
        )}

        <Field label="Početni datum rotacije (anchor)">
          <div className="text-xs text-mut2 mb-1.5">
            Određuje fazu ciklusa. Na ovaj dan grupa <b>crvena</b> radi PRVU smjenu. Mijenjajte oprezno — pomjera cijelu rotaciju.
          </div>
          <input type="date" className="max-w-[220px]" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          <button className="btn btn-primary mt-2 self-start" onClick={saveAnchor}>Sačuvaj anchor</button>
        </Field>

        <Field label="Pravilo rotacije">
          <div className="text-xs text-mut2 leading-relaxed">
            Svaki radnik: <b>PRVA → DRUGA → ODMOR → ODMOR</b> (ciklus 4 dana). 4 grupe su fazno pomjerene tako da svaki dan
            jedna grupa radi prvu, jedna drugu, dvije odmaraju. Bolovanje/odmor radnika ga automatski izuzima iz tih dana.
          </div>
        </Field>
      </div>
    </div>
  );
}
