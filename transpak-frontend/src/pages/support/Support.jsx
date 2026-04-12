import React, { useMemo, useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import DemoVideoWatchButton from '../../components/demo/DemoVideoWatchButton.jsx';
import { useLanguage } from '../../hooks/useLanguage.js';

// FAQ / Help — includes full official walkthrough access (demo video not on dashboards).
const Support = () => {
  const { t } = useLanguage();
  const faqs = useMemo(
    () => [
      { q: 'How do I post a load?', a: 'Go to Loads → Post Load, fill details, choose pickup date and deadline, then publish.' },
      { q: 'How do bids work?', a: 'Carriers place bids with amount and ETA. Shippers accept the best bid to assign the load.' },
      { q: 'Why can’t I post loads?', a: 'Complete Profile (address + CNIC images) first. This is required for verification.' },
      { q: 'Why can’t I add a truck?', a: 'Truck front/back images are required for fleet verification.' }
    ],
    []
  );
  const [open, setOpen] = useState(0);

  return (
    <div className="container py-3">
      <h5 className="mb-3">Support</h5>
      <Card className="p-3">
        <p className="small mb-2">
          Email: <a href="mailto:support@transpak.pk">support@transpak.pk</a>
        </p>
        <p className="small mb-0">Hotline: +92-300-0000000</p>
      </Card>

      <div id="help-demo" className="mt-3">
        <h6 className="mb-2">{t('pages.support.demoSectionTitle')}</h6>
        <Card className="p-3">
          <p className="small text-muted mb-3">{t('pages.support.demoSectionBody')}</p>
          <DemoVideoWatchButton />
        </Card>
      </div>

      <div id="faq" className="mt-3">
        <h6 className="mb-2">FAQ</h6>
        <Card className="p-2">
          {faqs.map((f, idx) => (
            <button
              key={f.q}
              type="button"
              className="btn w-100 text-start"
              onClick={() => setOpen((p) => (p === idx ? -1 : idx))}
            >
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-semibold">{f.q}</span>
                <span className="text-muted">{open === idx ? '−' : '+'}</span>
              </div>
              {open === idx && <div className="small text-muted mt-2">{f.a}</div>}
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
};

export default Support;

