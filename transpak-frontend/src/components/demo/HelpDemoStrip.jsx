import React from 'react';
import Card from '../ui/Card.jsx';
import DemoVideoWatchButton from './DemoVideoWatchButton.jsx';

const HelpDemoStrip = () => (
  <Card className="tp-help-strip p-3 mb-3 border-0 shadow-sm">
    <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
      <div className="small text-muted mb-0">
        <span className="fw-semibold text-body">Help ·</span> Watch the official TransPak demo anytime.
      </div>
      <DemoVideoWatchButton />
    </div>
  </Card>
);

export default HelpDemoStrip;
